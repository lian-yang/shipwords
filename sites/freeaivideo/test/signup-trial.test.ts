import { env } from 'cloudflare:test';
import type { WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import { grantSignupBonus } from '@shipwords/core/auth/server';
import type { SessionUser } from '@shipwords/core/billing/handlers';
import { getBalance, grantCredits } from '@shipwords/core/credits/ledger';
import { createDb } from '@shipwords/core/db/client';
import { ipBucket } from '@shipwords/core/http';
import { dayWindow } from '@shipwords/core/quota/counters';
import { ensureGuestId } from '@shipwords/core/quota/guest';
import type { Core } from '@shipwords/core/server';
import { loadJob, markFailed, markSubmitted } from '@shipwords/jobs/lifecycle';
import { partsOf } from '@shipwords/jobs/runner';
import { buildYirRequest, YirAdapter } from '@shipwords/jobs/yir';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import site from '../site.config';
import { createSiteJob } from '../src/create-job.server';
import { GenerationWorkflow } from '../src/generation-workflow.server';
import models, { guestModels } from '../src/models.server';
import type { TrialStatus } from '../src/trial-types';
import { claimSignupTrial, getTrialStatus, SIGNUP_TRIAL_START } from '../src/trials.server';

const db = createDb(env.DB);
const BASE = 'https://www.freeaivideo.app';
const NOW = Date.UTC(2035, 0, 15, 12);
const DAY = 86_400_000;
const IP = '203.0.113.41';

function fakeCore(user: SessionUser | null = null) {
  const dispatch = vi.fn(async (_input: { id: string; params: { jobId: string } }) => ({}));
  const getUser = vi.fn<Core['getUser']>().mockResolvedValue(user);
  const core = {
    db,
    site,
    env: {
      DB: env.DB,
      OUTPUTS: env.OUTPUTS,
      APP_URL: BASE,
      GUEST_COOKIE_SECRET: 'test-only-cookie-secret',
      TURNSTILE_SITE_KEY: 'test-only-site-key',
      TURNSTILE_SECRET_KEY: 'test-only-secret-key',
      GENERATION_WORKFLOW: { create: dispatch },
    },
    getUser,
    log: vi.fn(),
  } as unknown as Core;
  return { core, dispatch, getUser };
}

async function newUser(
  options: { verified?: boolean; createdAt?: number; credits?: number; signupIp?: string } = {},
): Promise<SessionUser> {
  const id = `u_${crypto.randomUUID().replaceAll('-', '')}`;
  const value = { id, email: `${id}@example.test`, name: 'Trial customer' };
  const createdAt = options.createdAt ?? NOW - 1000;
  await env.DB.prepare(
    'INSERT INTO user (id,name,email,email_verified,created_at,updated_at) VALUES (?,?,?,?,?,?)',
  )
    .bind(id, value.name, value.email, options.verified === false ? 0 : 1, createdAt, createdAt)
    .run();
  await env.DB.prepare('INSERT INTO user_attribution (user_id,signup_ip,created_at) VALUES (?,?,?)')
    .bind(id, options.signupIp ?? IP, createdAt)
    .run();
  if (options.credits) {
    await grantCredits(db, {
      userId: id,
      amount: options.credits,
      idemKey: `purchase:${id}`,
      source: 'purchase',
    });
  }
  return value;
}

function trialRequest(
  method: 'GET' | 'POST' = 'POST',
  options: { cookie?: string; ip?: string; origin?: string } = {},
) {
  return new Request(`${BASE}/api/trials`, {
    method,
    headers: {
      origin: options.origin ?? BASE,
      'content-type': 'application/json',
      'cf-connecting-ip': options.ip ?? IP,
      ...(options.cookie ? { cookie: options.cookie } : {}),
    },
    ...(method === 'POST' ? { body: '{}' } : {}),
  });
}

function generationRequest(
  mode: string | undefined = 'daily-trial',
  options: {
    cookie?: string;
    ip?: string;
    token?: string | null;
    prompt?: unknown;
    parameters?: Record<string, unknown>;
    references?: unknown;
    origin?: string;
  } = {},
) {
  return new Request(`${BASE}/api/jobs/`, {
    method: 'POST',
    headers: {
      origin: options.origin ?? BASE,
      'content-type': 'application/json',
      'cf-connecting-ip': options.ip ?? IP,
      ...(options.cookie ? { cookie: options.cookie } : {}),
    },
    body: JSON.stringify({
      ...(mode === undefined ? {} : { mode }),
      modelId: 'seedance-2-5',
      prompt: options.prompt ?? 'A boat crossing a quiet lake',
      parameters: options.parameters ?? { aspect_ratio: '16:9' },
      references: options.references,
      recaptchaToken: options.token === undefined ? 'test-only-verification-token' : options.token,
    }),
  });
}

async function quotaCount(key: string, window = 'lifetime') {
  const result = await env.DB.prepare('SELECT count FROM quota_counters WHERE key=? AND window=?')
    .bind(key, window)
    .first<{ count: number }>();
  return result?.count ?? 0;
}

async function totalJobs() {
  return (await env.DB.prepare('SELECT count(*) AS count FROM jobs').first<{ count: number }>())!.count;
}

async function storedJob(response: Response) {
  expect(response.status).toBe(201);
  const data = (await response.json()) as { job: { id: string; costCredits: number } };
  expect(data.job.id).toMatch(/^job_/);
  const job = await loadJob(db, data.job.id);
  expect(job).not.toBeNull();
  return job!;
}

const responseCode = async (response: Response) =>
  ((await response.json()) as { error: { code: string } }).error.code;

function pauseVerification() {
  let resume!: () => void;
  let entered!: () => void;
  const paused = new Promise<void>((resolve) => {
    resume = resolve;
  });
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  vi.mocked(fetch).mockImplementationOnce(async (input: RequestInfo | URL) => {
    entered();
    const url = input instanceof Request ? input.url : String(input);
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    await paused;
    return Response.json({ success: true });
  });
  return { started, resume: () => resume() };
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  await env.DB.batch(
    [
      'DELETE FROM jobs',
      'DELETE FROM quota_counters',
      'DELETE FROM credit_allocations',
      'DELETE FROM credit_ledger',
      'DELETE FROM credit_lots',
      'DELETE FROM credit_accounts',
      'DELETE FROM user_attribution',
      'DELETE FROM user',
    ].map((query) => env.DB.prepare(query)),
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url !== 'https://challenges.cloudflare.com/turnstile/v0/siteverify') {
        throw new Error(`Test must not access an external service: ${url}`);
      }
      return Response.json({ success: true });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('verified signup trial entitlement', () => {
  it('issues one 30-day voucher with no credit grant and repeat claims do not use more shared slots', async () => {
    const user = await newUser();
    const { core } = fakeCore(user);
    const before = await getTrialStatus(core, trialRequest('GET'));
    expect(await before.json()).toMatchObject({ signup: { status: 'claimable' } });
    const claimed = await claimSignupTrial(core, trialRequest());
    expect(claimed.status).toBe(200);
    expect(await claimed.json()).toMatchObject({
      signup: { status: 'available', expiresAt: NOW - 1000 + 30 * DAY },
    });
    expect((await getBalance(db, user.id)).available).toBe(0);
    await claimSignupTrial(core, trialRequest());
    expect(await quotaCount(`signup-trial:grant:${user.id}`)).toBe(1);
    expect(await quotaCount('signup-bonus:site', dayWindow())).toBe(1);
  });

  it('concurrent claims by one account reserve exactly one shared issuance slot', async () => {
    const user = await newUser();
    const { core } = fakeCore(user);
    const responses = await Promise.all(
      Array.from({ length: 6 }, () => claimSignupTrial(core, trialRequest())),
    );
    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(await quotaCount(`signup-trial:grant:${user.id}`)).toBe(1);
    expect(await quotaCount('signup-bonus:site', dayWindow())).toBe(1);
  });

  it('caps daily issuance at two across accounts and preserves the budget consumed by old gifts', async () => {
    await env.DB.prepare('INSERT INTO quota_counters (key,window,count) VALUES (?,?,1)')
      .bind('signup-bonus:site', dayWindow())
      .run();
    const first = await newUser({ signupIp: '192.0.2.1' });
    const second = await newUser({ signupIp: '198.51.100.1' });
    const responses = await Promise.all([
      claimSignupTrial(fakeCore(first).core, trialRequest('POST', { ip: '192.0.2.1' })),
      claimSignupTrial(fakeCore(second).core, trialRequest('POST', { ip: '198.51.100.1' })),
    ]);
    const states = await Promise.all(responses.map((response) => response.json() as Promise<TrialStatus>));
    expect(states.filter((value) => value.signup.status === 'available')).toHaveLength(1);
    expect(states.filter((value) => value.signup.status === 'daily_limit')).toHaveLength(1);
    expect(await quotaCount('signup-bonus:site', dayWindow())).toBe(2);
    expect(
      (await quotaCount(`signup-trial:grant:${first.id}`)) +
        (await quotaCount(`signup-trial:grant:${second.id}`)),
    ).toBe(1);
  });

  it('keeps an old 100-credit gift intact and does not issue another signup entitlement', async () => {
    const user = await newUser();
    await grantCredits(db, { userId: user.id, amount: 100, idemKey: `signup:${user.id}`, source: 'signup' });
    const { core } = fakeCore(user);
    const response = await claimSignupTrial(core, trialRequest());
    expect(await response.json()).toMatchObject({ signup: { status: 'ineligible' } });
    expect(await quotaCount(`signup-trial:grant:${user.id}`)).toBe(0);
    expect((await getBalance(db, user.id)).available).toBe(100);
  });

  it('respects the registration IP issuance cap without consuming an unrelated site slot', async () => {
    const user = await newUser();
    await env.DB.prepare('INSERT INTO quota_counters (key,window,count) VALUES (?,?,2)')
      .bind(`signup-bonus:ip:${ipBucket(IP)}`, dayWindow())
      .run();
    const response = await claimSignupTrial(fakeCore(user).core, trialRequest());
    expect(await response.json()).toMatchObject({ signup: { status: 'daily_limit' } });
    expect(await quotaCount(`signup-trial:grant:${user.id}`)).toBe(0);
    expect(await quotaCount('signup-bonus:site', dayWindow())).toBe(0);
    expect(await quotaCount(`signup-bonus:ip:${ipBucket(IP)}`, dayWindow())).toBe(2);
  });

  it.each([
    { label: 'unverified', options: { verified: false }, status: 'unverified' },
    { label: 'pre-rollout', options: { createdAt: SIGNUP_TRIAL_START - 1 }, status: 'ineligible' },
    { label: 'expired', options: { createdAt: NOW - 31 * DAY }, status: 'expired' },
  ])('does not issue a voucher to a $label account', async ({ options, status }) => {
    const user = await newUser(options);
    const { core } = fakeCore(user);
    const response = await claimSignupTrial(core, trialRequest());
    expect(await response.json()).toMatchObject({ signup: { status } });
    expect(await quotaCount(`signup-trial:grant:${user.id}`)).toBe(0);
    expect(await quotaCount('signup-bonus:site', dayWindow())).toBe(0);
  });

  it('does not issue signup credits through the old auth hook under the new site configuration', async () => {
    expect(site.signup.bonusCredits).toBe(0);
    const user = await newUser();
    await grantSignupBonus({ db, site, log: () => {} }, user.id, new Headers({ 'cf-connecting-ip': IP }));
    expect((await getBalance(db, user.id)).available).toBe(0);
    expect(await quotaCount('signup-bonus:site', dayWindow())).toBe(0);
  });

  it('cannot claim with another origin and cannot claim without a session', async () => {
    const user = await newUser();
    const forbidden = await claimSignupTrial(
      fakeCore(user).core,
      trialRequest('POST', { origin: 'https://other.test' }),
    );
    expect(forbidden.status).toBe(403);
    const anonymous = await claimSignupTrial(fakeCore().core, trialRequest());
    expect(anonymous.status).toBe(401);
    expect(await quotaCount('signup-bonus:site', dayWindow())).toBe(0);
  });

  it('rolls back every quota write if issuance fails halfway through its D1 batch', async () => {
    const user = await newUser();
    await env.DB.exec(
      "CREATE TRIGGER test_fail_signup_grant BEFORE INSERT ON quota_counters WHEN NEW.key='signup-bonus:site' BEGIN SELECT RAISE(ABORT, 'injected issuance failure'); END;",
    );
    try {
      await expect(claimSignupTrial(fakeCore(user).core, trialRequest())).rejects.toThrow();
      expect(await quotaCount(`signup-trial:grant:${user.id}`)).toBe(0);
      expect(await quotaCount('signup-bonus:site', dayWindow())).toBe(0);
      const rows = await env.DB.prepare('SELECT * FROM quota_counters').all();
      expect(rows.results).toHaveLength(0);
    } finally {
      await env.DB.exec('DROP TRIGGER test_fail_signup_grant;');
    }
    expect(await (await claimSignupTrial(fakeCore(user).core, trialRequest())).json()).toMatchObject({
      signup: { status: 'available' },
    });
  });
});

describe('signup trial redemption and paid generation', () => {
  it('redeems the voucher for an owned 4s480p job without spending paid credits', async () => {
    const user = await newUser({ credits: 100 });
    const { core, dispatch, getUser } = fakeCore(user);
    await claimSignupTrial(core, trialRequest());
    getUser.mockClear();
    const job = await storedJob(
      await createSiteJob(
        core,
        generationRequest('signup-trial', {
          parameters: { duration: 30, resolution: '1080p', aspect_ratio: '9:16' },
        }),
      ),
    );
    expect(job).toMatchObject({ userId: user.id, costCredits: 0, quotaJson: null, status: 'queued' });
    expect(JSON.parse(job.inputJson).parameters).toEqual({
      duration: 4,
      resolution: '480p',
      aspect_ratio: '9:16',
    });
    expect(await quotaCount(`signup-trial:used:${user.id}`)).toBe(1);
    expect((await getBalance(db, user.id)).available).toBe(100);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it('concurrent redemption accepts exactly one job and dispatch', async () => {
    const user = await newUser();
    const { core, dispatch } = fakeCore(user);
    await claimSignupTrial(core, trialRequest());
    const responses = await Promise.all(
      Array.from({ length: 5 }, () => createSiteJob(core, generationRequest('signup-trial'))),
    );
    expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
    expect(await totalJobs()).toBe(1);
    expect(await quotaCount(`signup-trial:used:${user.id}`)).toBe(1);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('does not spend a coupon or create a job when input validation fails', async () => {
    const user = await newUser();
    const { core, dispatch } = fakeCore(user);
    await claimSignupTrial(core, trialRequest());
    const invalid = await createSiteJob(core, generationRequest('signup-trial', { prompt: ' ' }));
    expect(invalid.status).toBe(400);
    expect(await quotaCount(`signup-trial:used:${user.id}`)).toBe(0);
    expect(await totalJobs()).toBe(0);
    expect(dispatch).not.toHaveBeenCalled();
    await storedJob(await createSiteJob(core, generationRequest('signup-trial')));
  });

  it('rolls back redemption if inserting the job fails', async () => {
    const user = await newUser();
    const { core, dispatch } = fakeCore(user);
    await claimSignupTrial(core, trialRequest());
    await env.DB.exec(
      "CREATE TRIGGER test_fail_job BEFORE INSERT ON jobs BEGIN SELECT RAISE(ABORT, 'injected job failure'); END;",
    );
    try {
      await expect(createSiteJob(core, generationRequest('signup-trial'))).rejects.toThrow();
      expect(await quotaCount(`signup-trial:used:${user.id}`)).toBe(0);
      expect(await totalJobs()).toBe(0);
      expect(dispatch).not.toHaveBeenCalled();
    } finally {
      await env.DB.exec('DROP TRIGGER test_fail_job;');
    }
    await storedJob(await createSiteJob(core, generationRequest('signup-trial')));
  });

  it('does not return a redeemed voucher after a charged upstream failure or repeated settlement', async () => {
    const user = await newUser();
    const { core, dispatch } = fakeCore(user);
    await claimSignupTrial(core, trialRequest());
    const job = await storedJob(await createSiteJob(core, generationRequest('signup-trial')));
    await markSubmitted(db, job.id, 'upstream-accepted-and-charged');
    await markFailed(db, job.id, 'failed', 'upstream_failed', 'Charged request failed');
    await markFailed(db, job.id, 'failed', 'upstream_failed', 'Repeated callback');
    expect(await quotaCount(`signup-trial:used:${user.id}`)).toBe(1);
    expect((await createSiteJob(core, generationRequest('signup-trial'))).status).not.toBe(201);
    expect(await totalJobs()).toBe(1);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('keeps the voucher consumed when dispatch result is uncertain', async () => {
    const user = await newUser();
    const { core, dispatch } = fakeCore(user);
    await claimSignupTrial(core, trialRequest());
    dispatch.mockRejectedValueOnce(new Error('Network failed after dispatch may have been accepted'));
    const response = await createSiteJob(core, generationRequest('signup-trial'));
    expect(response.status).toBe(503);
    expect(await quotaCount(`signup-trial:used:${user.id}`)).toBe(1);
    expect(await totalJobs()).toBe(1);
    expect((await createSiteJob(core, generationRequest('signup-trial'))).status).not.toBe(201);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('checks voucher expiry again at redemption after it was issued', async () => {
    const user = await newUser();
    const { core, dispatch } = fakeCore(user);
    await claimSignupTrial(core, trialRequest());
    vi.setSystemTime(NOW + 30 * DAY);
    const response = await createSiteJob(core, generationRequest('signup-trial'));
    expect(response.status).not.toBe(201);
    expect(await responseCode(response)).toBe('signup_trial_expired');
    expect(await quotaCount(`signup-trial:used:${user.id}`)).toBe(0);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('rejects a voucher that expires while the verification request is awaiting its response', async () => {
    const user = await newUser({ credits: 100 });
    const { core, dispatch } = fakeCore(user);
    await claimSignupTrial(core, trialRequest());
    const verification = pauseVerification();
    const pending = createSiteJob(core, generationRequest('signup-trial'));
    await verification.started;
    // Initial eligibility passed; time now crosses expiry before the transactional reservation.
    vi.setSystemTime(NOW + 30 * DAY);
    verification.resume();
    const response = await pending;
    expect(response.status).toBe(409);
    expect(await responseCode(response)).toBe('signup_trial_expired');
    expect(await quotaCount(`signup-trial:grant:${user.id}`)).toBe(1);
    expect(await quotaCount(`signup-trial:used:${user.id}`)).toBe(0);
    expect(await totalJobs()).toBe(0);
    expect((await getBalance(db, user.id)).available).toBe(100);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it.each(['verification-revoked', 'grant-withdrawn'] as const)(
    'rejects %s during verification without consuming the voucher or creating a job',
    async (change) => {
      const user = await newUser({ credits: 100 });
      const { core, dispatch } = fakeCore(user);
      await claimSignupTrial(core, trialRequest());
      const verification = pauseVerification();
      const pending = createSiteJob(core, generationRequest('signup-trial'));
      await verification.started;
      if (change === 'verification-revoked') {
        await env.DB.prepare('UPDATE user SET email_verified=0 WHERE id=?').bind(user.id).run();
      } else {
        await env.DB.prepare('DELETE FROM quota_counters WHERE key=? AND window=?')
          .bind(`signup-trial:grant:${user.id}`, 'lifetime')
          .run();
      }
      verification.resume();
      const response = await pending;
      expect(response.status).toBe(409);
      expect(await responseCode(response)).toBe('signup_trial_unavailable');
      expect(await quotaCount(`signup-trial:used:${user.id}`)).toBe(0);
      expect(await totalJobs()).toBe(0);
      expect((await getBalance(db, user.id)).available).toBe(100);
      expect(dispatch).not.toHaveBeenCalled();
      const tickets = await env.DB.prepare(
        "SELECT key FROM quota_counters WHERE key LIKE 'trial:reservation:%'",
      ).all();
      expect(tickets.results).toHaveLength(0);
    },
  );

  it('pins image trials to auto aspect ratio, 4 seconds and 480p', async () => {
    const user = await newUser();
    const { core } = fakeCore(user);
    await claimSignupTrial(core, trialRequest());
    const job = await storedJob(
      await createSiteJob(
        core,
        generationRequest('signup-trial', {
          references: ['/files/uploads/reference.jpg'],
          parameters: { duration: 99, resolution: '4k', aspect_ratio: '9:16' },
        }),
      ),
    );
    expect(JSON.parse(job.inputJson)).toMatchObject({
      references: [{ url: `${BASE}/files/uploads/reference.jpg`, role: 'first_frame' }],
      parameters: { duration: 4, resolution: '480p', aspect_ratio: 'auto' },
    });
  });

  it('keeps explicit paid generation at 100 credits, 10s720p with a 2.60 ceiling', async () => {
    const user = await newUser({ credits: 200 });
    const { core } = fakeCore(user);
    const job = await storedJob(
      await createSiteJob(
        core,
        generationRequest('paid', { parameters: { duration: 4, resolution: '480p' } }),
      ),
    );
    expect(job.costCredits).toBe(100);
    expect(JSON.parse(job.inputJson).parameters).toMatchObject({ duration: 10, resolution: '720p' });
    expect((await getBalance(db, user.id)).available).toBe(100);
    const part = partsOf(job, models[0]!)[0]!;
    expect(buildYirRequest({ ...part, kind: 'video' }).max_cost).toBe('2.60');
  });

  it('uses the 0.60 ceiling in the actual trial request serializer', async () => {
    const user = await newUser();
    const { core } = fakeCore(user);
    await claimSignupTrial(core, trialRequest());
    const job = await storedJob(await createSiteJob(core, generationRequest('signup-trial')));
    const part = partsOf(job, guestModels[0]!)[0]!;
    const request = buildYirRequest({ ...part, kind: 'video' });
    expect(request.max_cost).toBe('0.60');
    expect(request.parameters).toMatchObject({ duration: 4, resolution: '480p' });
  });

  it('rejects unsupported modes rather than silently charging or granting a free render', async () => {
    const user = await newUser({ credits: 100 });
    const { core, dispatch } = fakeCore(user);
    const response = await createSiteJob(core, generationRequest('free-unlimited'));
    expect(response.status).toBe(400);
    expect(await responseCode(response)).toBe('invalid_generation_mode');
    expect((await getBalance(db, user.id)).available).toBe(100);
    expect(await totalJobs()).toBe(0);
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe('device daily trial shared across sign-in', () => {
  it('does not allow a second daily trial after signing in on the same signed device cookie', async () => {
    const guest = fakeCore();
    const firstResponse = await createSiteJob(guest.core, generationRequest('daily-trial'));
    const cookie = firstResponse.headers.get('set-cookie')!.split(';')[0]!;
    const first = await storedJob(firstResponse);
    expect(first).toMatchObject({ userId: null, costCredits: 0, quotaJson: null });
    const user = await newUser({ credits: 100 });
    const authenticated = fakeCore(user);
    const denied = await createSiteJob(authenticated.core, generationRequest('daily-trial', { cookie }));
    expect(denied.status).not.toBe(201);
    expect(await responseCode(denied)).toBe('trial_quota_exhausted');
    expect((await getBalance(db, user.id)).available).toBe(100);
    expect(await quotaCount('guest:site', dayWindow())).toBe(1);
    expect(await totalJobs()).toBe(1);
    expect(authenticated.dispatch).not.toHaveBeenCalled();
  });

  it('sets a device cookie on a signed-in first daily try, which also prevents a logged-out second try', async () => {
    const user = await newUser();
    const firstResponse = await createSiteJob(fakeCore(user).core, generationRequest('daily-trial'));
    const cookie = firstResponse.headers.get('set-cookie')!.split(';')[0]!;
    const first = await storedJob(firstResponse);
    expect(first).toMatchObject({ userId: user.id, costCredits: 0 });
    const second = await createSiteJob(fakeCore().core, generationRequest('daily-trial', { cookie }));
    expect(await responseCode(second)).toBe('trial_quota_exhausted');
    expect(await totalJobs()).toBe(1);
  });

  it('concurrent requests from one existing signed device accept only once', async () => {
    const { core, dispatch } = fakeCore();
    const identity = await ensureGuestId(new Headers(), site.id, core.env.GUEST_COOKIE_SECRET);
    const cookie = identity.setCookie!.split(';')[0]!;
    const responses = await Promise.all(
      Array.from({ length: 5 }, () => createSiteJob(core, generationRequest('daily-trial', { cookie }))),
    );
    expect(responses.filter((response) => response.status === 201)).toHaveLength(1);
    expect(await totalJobs()).toBe(1);
    expect(await quotaCount('guest:site', dayWindow())).toBe(1);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it('caps distinct daily devices at four site-wide without spending paid balances', async () => {
    const responses: Response[] = [];
    for (let index = 0; index < 5; index++) {
      responses.push(
        await createSiteJob(fakeCore().core, generationRequest('daily-trial', { ip: `198.51.${index}.1` })),
      );
    }
    expect(responses.filter((response) => response.status === 201)).toHaveLength(4);
    expect(await responseCode(responses[4]!)).toBe('trial_quota_exhausted');
    expect(await quotaCount('guest:site', dayWindow())).toBe(4);
    expect(await totalJobs()).toBe(4);
  });

  it('denies trials when verification is not configured instead of silently allowing quota-only use', async () => {
    const { core, dispatch } = fakeCore();
    core.env.TURNSTILE_SECRET_KEY = undefined;
    core.env.TURNSTILE_SITE_KEY = undefined;
    const response = await createSiteJob(core, generationRequest('daily-trial'));
    expect(response.status).not.toBe(201);
    expect(await responseCode(response)).toBe('trial_unavailable');
    expect(await quotaCount('guest:site', dayWindow())).toBe(0);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('does not reserve quota when a verification token is missing', async () => {
    const { core, dispatch } = fakeCore();
    const response = await createSiteJob(core, generationRequest('daily-trial', { token: null }));
    expect(response.status).not.toBe(201);
    expect(await responseCode(response)).toBe('trial_verification_failed');
    expect(await quotaCount('guest:site', dayWindow())).toBe(0);
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe.each(['daily-trial', 'signup-trial'] as const)('%s verification rejection', (mode) => {
  async function mutationState() {
    const tables = [
      'quota_counters',
      'jobs',
      'credit_accounts',
      'credit_lots',
      'credit_ledger',
      'credit_allocations',
    ];
    return Promise.all(
      tables.map(async (table) => ({
        table,
        rows: (await env.DB.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results,
      })),
    );
  }

  it.each([
    {
      name: 'provider rejection',
      verify: async () => Response.json({ success: false }),
    },
    {
      name: 'expired or already-used token',
      verify: async () => Response.json({ success: false, 'error-codes': ['timeout-or-duplicate'] }),
    },
    {
      name: '503 with a misleading success body',
      verify: async () => Response.json({ success: true }, { status: 503 }),
    },
    {
      name: 'network failure',
      verify: async (): Promise<Response> => {
        throw new Error('mock network failure');
      },
    },
  ])('leaves quota, jobs, credits and dispatch unchanged after $name', async ({ verify }) => {
    const user = mode === 'signup-trial' ? await newUser({ credits: 100 }) : null;
    const { core, dispatch } = fakeCore(user);
    if (user) {
      expect((await claimSignupTrial(core, trialRequest())).status).toBe(200);
      expect(await quotaCount(`signup-trial:grant:${user.id}`)).toBe(1);
    }
    // A claimed voucher and purchased credits are part of the baseline, not side effects
    // of this rejected attempt. Compare every reservation and credit record, not only totals.
    const before = await mutationState();
    vi.mocked(fetch).mockImplementationOnce(verify);

    const response = await createSiteJob(core, generationRequest(mode));

    expect(response.status).toBe(403);
    expect(await responseCode(response)).toBe('trial_verification_failed');
    expect(await mutationState()).toEqual(before);
    expect(await totalJobs()).toBe(0);
    expect(dispatch).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      expect.objectContaining({ method: 'POST' }),
    );
    if (user) {
      expect(await quotaCount(`signup-trial:used:${user.id}`)).toBe(0);
      expect((await getBalance(db, user.id)).available).toBe(100);
    }
  });
});

/** Cache step results to exercise the real run method and runner on a simulated replay. */
function workflowSteps() {
  const cache = new Map<string, unknown>();
  return {
    do: async (name: string, ...args: unknown[]) => {
      if (cache.has(name)) return cache.get(name);
      const callback = args.at(-1) as () => Promise<unknown>;
      const result = await callback();
      cache.set(name, result);
      return result;
    },
    sleep: async () => {},
  } as unknown as WorkflowStep;
}

function actualWorkflowRun(jobId: string, step: WorkflowStep) {
  // Native WorkflowEntrypoint cannot be constructed with cloudflare:test's ExecutionContext.
  // Supply only the env receiver to the actual site method, which invokes the shared runner.
  const receiver = {
    env: { DB: env.DB, OUTPUTS: env.OUTPUTS, APP_URL: BASE, YIR_API_KEY: 'test-only-no-network' },
  } as unknown as GenerationWorkflow;
  return GenerationWorkflow.prototype.run.call(
    receiver,
    { payload: { jobId } } as WorkflowEvent<{ jobId: string }>,
    step,
  );
}

describe('actual Workflow execution for trial ownership and budget', () => {
  it.each([
    { mode: 'daily-trial' as const, signedIn: false },
    { mode: 'daily-trial' as const, signedIn: true },
    { mode: 'signup-trial' as const, signedIn: true },
  ])(
    'keeps $0.60 for $mode with signedIn=$signedIn and never returns charged trial usage',
    async ({ mode, signedIn }) => {
      const user = await newUser({ credits: 100 });
      const { core } = fakeCore(signedIn ? user : null);
      if (mode === 'signup-trial') await claimSignupTrial(core, trialRequest());
      const job = await storedJob(await createSiteJob(core, generationRequest(mode)));
      const submit = vi
        .spyOn(YirAdapter.prototype, 'submit')
        .mockResolvedValue({ upstreamJobId: 'up_test_charged' });
      vi.spyOn(YirAdapter.prototype, 'poll').mockResolvedValue({
        state: 'failed',
        code: 'test_failure',
        message: 'Simulated charged failure; no real submission',
      });
      vi.spyOn(YirAdapter.prototype, 'cost').mockResolvedValue({ usd: '0.38', settled: true });
      vi.spyOn(YirAdapter.prototype, 'cancel').mockResolvedValue(undefined);
      const step = workflowSteps();
      await actualWorkflowRun(job.id, step);
      await actualWorkflowRun(job.id, step);
      expect(submit).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          maxCost: '0.60',
          parameters: { duration: 4, resolution: '480p', aspect_ratio: '16:9' },
        }),
        job.id,
      );
      expect((await loadJob(db, job.id))!.status).toBe('failed');
      expect((await getBalance(db, user.id)).available).toBe(100);
      if (mode === 'signup-trial') expect(await quotaCount(`signup-trial:used:${user.id}`)).toBe(1);
      else expect(await quotaCount('guest:site', dayWindow())).toBe(1);
    },
  );
});
