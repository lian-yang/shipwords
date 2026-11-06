import { isConstraintError, newId } from '@shipwords/core/db/client';
import { clientIp, errorResponse, ipBucket, json } from '@shipwords/core/http';
import { dayWindow, type QuotaRule } from '@shipwords/core/quota/counters';
import { ensureGuestId } from '@shipwords/core/quota/guest';
import { verifyRecaptcha } from '@shipwords/core/quota/recaptcha';
import { verifyTurnstile } from '@shipwords/core/quota/turnstile';
import type { Core } from '@shipwords/core/server';
import { publicJob } from '@shipwords/jobs/handlers';
import { loadJob, markFailed } from '@shipwords/jobs/lifecycle';
import { referenceRoleOf, sanitizeParameters } from '@shipwords/jobs/models';
import type { JobsEnv } from '@shipwords/jobs/workflow';
import { guestModels } from './models.server';
import { type GenerationMode, type TrialStatus, trialErrors, trialReasons } from './trial-types';
import { VIDEO_OPTIONS } from './video-options';
import { VIDEO_UPSTREAMS } from './video-pricing.server';

// New verified registrations only. Existing signup credits remain untouched.
export const SIGNUP_TRIAL_START = Date.parse('2026-11-01T11:04:07.000Z');
const LIFETIME = 'lifetime';
const DAY = 86_400_000;
type User = Awaited<ReturnType<Core['getUser']>>;

export interface SiteJobBody {
  mode?: unknown;
  modelId?: unknown;
  prompt?: unknown;
  references?: unknown;
  parameters?: unknown;
  recaptchaToken?: unknown;
}

interface SignupRecord {
  createdAt: number;
  verified: number;
  signupIp: string | null;
  legacy: number;
  granted: number;
  used: number;
}

const grantKey = (id: string) => `signup-trial:grant:${id}`;
const usedKey = (id: string) => `signup-trial:used:${id}`;

function withCookie(response: Response, cookie: string | null) {
  response.headers.set('cache-control', 'private, no-store');
  if (cookie) response.headers.append('set-cookie', cookie);
  return response;
}

function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return (
    (!origin || origin === new URL(request.url).origin) &&
    request.headers.get('sec-fetch-site') !== 'cross-site'
  );
}

function verificationAvailable(core: Core) {
  return Boolean(
    (core.env.TURNSTILE_SECRET_KEY && core.env.TURNSTILE_SITE_KEY) ||
      (core.env.RECAPTCHA_PROJECT_ID && core.env.RECAPTCHA_API_KEY && core.env.RECAPTCHA_SITE_KEY),
  );
}

async function verifyTrial(core: Core, token: unknown) {
  if (typeof token !== 'string' || !token) return false;
  if (core.env.TURNSTILE_SECRET_KEY) {
    return (await verifyTurnstile(core.env.TURNSTILE_SECRET_KEY, token)).ok;
  }
  if (!verificationAvailable(core)) return false;
  return (
    await verifyRecaptcha(
      {
        projectId: core.env.RECAPTCHA_PROJECT_ID,
        apiKey: core.env.RECAPTCHA_API_KEY,
        siteKey: core.env.RECAPTCHA_SITE_KEY,
      },
      token,
      'generate',
      core.site.guest.minRecaptchaScore,
    )
  ).ok;
}

async function count(core: Core, rule: QuotaRule) {
  const row = await core.env.DB.prepare('select count from quota_counters where key = ? and window = ?')
    .bind(rule.key, rule.window)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

function dailyRules(core: Core, request: Request, guestId: string): QuotaRule[] {
  const window = dayWindow();
  const ip = clientIp(request.headers);
  return [
    { key: `guest:device:${guestId}`, window, limit: core.site.guest.dailyPerDevice },
    ...(ip ? [{ key: `guest:ip:${ipBucket(ip)}`, window, limit: core.site.guest.dailyPerIp }] : []),
    { key: 'guest:site', window, limit: core.site.guest.dailySiteBudget },
  ];
}

function signupRules(core: Core, request: Request, user: NonNullable<User>, row: SignupRecord): QuotaRule[] {
  const window = dayWindow();
  const ip = row.signupIp ?? clientIp(request.headers);
  return [
    { key: grantKey(user.id), window: LIFETIME, limit: 1 },
    ...(ip
      ? [{ key: `signup-bonus:ip:${ipBucket(ip)}`, window, limit: core.site.signup.bonusPerIpDaily }]
      : []),
    { key: 'signup-bonus:site', window, limit: core.site.signup.bonusSiteDaily },
  ];
}

/** All reservations and their resulting entitlement/job commit together. A duplicate ticket
 * aborts the entire D1 batch when any cap is exhausted. The ticket is deleted before commit.
 * No expiry timestamps or unrelated state are encoded in quota counts.
 */
async function reserve(
  core: Core,
  rules: QuotaRule[],
  writes: D1PreparedStatement[] = [],
  eligibility?: { userId: string; mustBeGranted: boolean },
) {
  const db = core.env.DB;
  const ticket = `trial:reservation:${crypto.randomUUID()}`;
  const statements = [
    db.prepare('insert into quota_counters (key, window, count) values (?, ?, 1)').bind(ticket, LIFETIME),
    ...(eligibility
      ? [
          db
            .prepare(
              `insert into quota_counters (key, window, count)
       select ?, ?, 1 where not exists (
         select 1 from user where id = ? and email_verified = 1 and created_at >= ?
         and created_at + ? > ?
         and not exists (select 1 from credit_ledger where idem_key = ?)
         and (? = 0 or exists (
           select 1 from quota_counters where key = ? and window = ? and count = 1
         ))
       )`,
            )
            .bind(
              ticket,
              LIFETIME,
              eligibility.userId,
              SIGNUP_TRIAL_START,
              (core.site.signup.bonusExpiresDays ?? 30) * DAY,
              Date.now(),
              `signup:${eligibility.userId}`,
              eligibility.mustBeGranted ? 1 : 0,
              grantKey(eligibility.userId),
              LIFETIME,
            ),
        ]
      : []),
    ...rules.map((rule) =>
      db
        .prepare(
          `insert into quota_counters (key, window, count)
       select ?, ?, 1 where ? <= 0 or coalesce(
         (select count from quota_counters where key = ? and window = ?), 0) >= ?`,
        )
        .bind(ticket, LIFETIME, rule.limit, rule.key, rule.window, rule.limit),
    ),
    ...rules.map((rule) =>
      db
        .prepare(
          `insert into quota_counters (key, window, count) values (?, ?, 1)
       on conflict (key, window) do update set count = count + 1`,
        )
        .bind(rule.key, rule.window),
    ),
    ...writes,
    db.prepare('delete from quota_counters where key = ? and window = ?').bind(ticket, LIFETIME),
  ];
  try {
    await db.batch(statements);
    return true;
  } catch (error) {
    if (isConstraintError(error, 'UNIQUE', 'quota_counters.key')) return false;
    throw error;
  }
}

async function signupRecord(core: Core, user: NonNullable<User>) {
  return core.env.DB.prepare(
    `select u.created_at as createdAt, u.email_verified as verified, a.signup_ip as signupIp,
       exists(select 1 from credit_ledger where idem_key = ?) as legacy,
       coalesce((select count from quota_counters where key = ? and window = ?), 0) as granted,
       coalesce((select count from quota_counters where key = ? and window = ?), 0) as used
     from user u left join user_attribution a on a.user_id = u.id where u.id = ?`,
  )
    .bind(`signup:${user.id}`, grantKey(user.id), LIFETIME, usedKey(user.id), LIFETIME, user.id)
    .first<SignupRecord>();
}

async function signupStatus(core: Core, request: Request, user: User): Promise<TrialStatus['signup']> {
  if (!user) return { status: 'signed_out', expiresAt: null };
  const row = await signupRecord(core, user);
  if (!row || row.legacy || row.createdAt < SIGNUP_TRIAL_START)
    return { status: 'ineligible', expiresAt: null };
  const expiresAt = row.createdAt + (core.site.signup.bonusExpiresDays ?? 30) * DAY;
  if (!row.verified) return { status: 'unverified', expiresAt };
  if (row.used) return { status: 'used', expiresAt };
  if (Date.now() >= expiresAt) return { status: 'expired', expiresAt };
  if (row.granted) return { status: 'available', expiresAt };
  const rules = signupRules(core, request, user, row).slice(1);
  const available = (
    await Promise.all(rules.map(async (rule) => (await count(core, rule)) < rule.limit))
  ).every(Boolean);
  return { status: available ? 'claimable' : 'daily_limit', expiresAt };
}

function signupError(status: TrialStatus['signup']['status']) {
  return errorResponse(
    409,
    status === 'used'
      ? trialErrors.signupUsed
      : status === 'expired'
        ? trialErrors.signupExpired
        : status === 'daily_limit'
          ? trialErrors.signupLimit
          : trialErrors.signupUnavailable,
  );
}

async function statusResponse(core: Core, request: Request, user: User) {
  const guest = await ensureGuestId(request.headers, core.site.id, core.env.GUEST_COOKIE_SECRET);
  const rules = dailyRules(core, request, guest.guestId);
  const remaining = Math.max(
    0,
    Math.min(...(await Promise.all(rules.map(async (rule) => rule.limit - (await count(core, rule)))))),
  );
  const verification = verificationAvailable(core);
  const status: TrialStatus = {
    verificationAvailable: verification,
    daily: {
      available: verification && remaining > 0,
      remaining: verification ? remaining : 0,
      reason: !verification ? trialReasons.verificationUnavailable : remaining > 0 ? null : 'quota',
    },
    signup: await signupStatus(core, request, user),
  };
  return withCookie(json(status), guest.setCookie);
}

/** Read-only availability. Reading creates only a signed device cookie, never an entitlement. */
export async function getTrialStatus(core: Core, request: Request) {
  return statusResponse(core, request, await core.getUser(request));
}

/** Verified accounts claim at most one voucher; issuance and shared limits are atomic. */
export async function claimSignupTrial(core: Core, request: Request) {
  if (!sameOrigin(request)) return errorResponse(403, 'forbidden');
  const user = await core.getUser(request);
  if (!user) return errorResponse(401, 'login_required');
  const status = await signupStatus(core, request, user);
  if (status.status === 'claimable') {
    const row = await signupRecord(core, user);
    if (row)
      await reserve(core, signupRules(core, request, user, row), [], {
        userId: user.id,
        mustBeGranted: false,
      });
  }
  return statusResponse(core, request, user);
}

/** Site-specific free paths use the normal job table, ownership and Workflow, with no credit write.
 * Accepted attempts consume their quota/voucher. They never enter the shared automatic quota refund
 * path: an upstream charge or an unknown dispatch outcome must not buy another free attempt.
 */
export async function createTrialJob(
  core: Core,
  request: Request,
  user: User,
  body: SiteJobBody,
  mode: Exclude<GenerationMode, 'paid'>,
) {
  if (!sameOrigin(request)) return errorResponse(403, 'forbidden');
  const options = (
    VIDEO_OPTIONS as Readonly<
      Record<
        string,
        {
          aspectRatios: readonly string[];
          imageAspectRatio?: string;
        }
      >
    >
  )[typeof body.modelId === 'string' ? body.modelId : ''];
  const model =
    options && guestModels.find((item) => item.id === body.modelId && item.guest && item.kind === 'video');
  if (!model) return errorResponse(400, 'unknown_model');
  if (typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.trim().length > 4000)
    return errorResponse(400, 'invalid_prompt');
  const baseURL = (core.env.APP_URL ?? core.site.url).replace(/\/$/, '');
  const refs = body.references ?? [];
  if (!Array.isArray(refs) || refs.length > model.maxReferences)
    return errorResponse(400, 'invalid_references');
  if (VIDEO_UPSTREAMS[model.id]?.requiresReference && refs.length !== 1)
    return errorResponse(400, 'invalid_references');
  const rawParameters = body.parameters;
  if (
    rawParameters !== undefined &&
    (!rawParameters || typeof rawParameters !== 'object' || Array.isArray(rawParameters))
  )
    return errorResponse(400, 'invalid_parameters');
  const ratio = (rawParameters as Record<string, unknown> | undefined)?.aspect_ratio;
  if (
    ratio !== undefined &&
    (typeof ratio !== 'string' ||
      (!options!.aspectRatios.includes(ratio) && !(refs.length > 0 && options!.imageAspectRatio === ratio)))
  )
    return errorResponse(400, 'invalid_parameters');
  const references: { url: string; role: ReturnType<typeof referenceRoleOf> }[] = [];
  for (const ref of refs) {
    const prefix = `${baseURL}/files/uploads/`;
    const url = typeof ref === 'string' && ref.startsWith('/files/uploads/') ? `${baseURL}${ref}` : ref;
    if (
      typeof url !== 'string' ||
      !url.startsWith(prefix) ||
      !/^[a-z0-9_]+\.(png|jpg|webp)$/.test(url.slice(prefix.length))
    )
      return errorResponse(400, 'invalid_references');
    references.push({ url, role: referenceRoleOf(model) });
  }
  if (mode === 'signup-trial') {
    if (!user) return errorResponse(401, 'login_required');
    const status = await signupStatus(core, request, user);
    if (status.status !== 'available') return signupError(status.status);
  }
  if (!verificationAvailable(core)) return errorResponse(503, trialErrors.unavailable);
  if (!(await verifyTrial(core, body.recaptchaToken))) return errorResponse(403, trialErrors.verification);
  const guest =
    mode === 'daily-trial'
      ? await ensureGuestId(request.headers, core.site.id, core.env.GUEST_COOKIE_SECRET)
      : null;
  const rules = guest
    ? dailyRules(core, request, guest.guestId)
    : [{ key: usedKey(user!.id), window: LIFETIME, limit: 1 }];
  const parameters = sanitizeParameters(model, body.parameters);
  if (references.length > 0 && options!.imageAspectRatio) parameters.aspect_ratio = options!.imageAspectRatio;
  const id = newId('job');
  const write = core.env.DB.prepare(
    `insert into jobs (id, user_id, guest_id, model_id, kind, prompt, input_json, cost_credits, upstream)
     values (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
  ).bind(
    id,
    user?.id ?? null,
    guest?.guestId ?? null,
    model.id,
    model.kind,
    body.prompt.trim(),
    JSON.stringify({ references, parameters, trialMode: mode, _verifiedBilling: true }),
    model.upstream,
  );
  const reserved = await reserve(
    core,
    rules,
    [write],
    mode === 'signup-trial' ? { userId: user!.id, mustBeGranted: true } : undefined,
  );
  if (!reserved)
    return withCookie(
      mode === 'daily-trial'
        ? errorResponse(409, trialErrors.quota)
        : signupError((await signupStatus(core, request, user)).status),
      guest?.setCookie ?? null,
    );
  const job = (await loadJob(core.db, id))!;
  try {
    await (core.env as unknown as JobsEnv).GENERATION_WORKFLOW.create({ id, params: { jobId: id } });
  } catch (error) {
    core.log('trial workflow dispatch failed', { jobId: id, error: String(error) });
    await markFailed(core.db, id, 'failed', 'dispatch_failed', 'could not start the trial');
    return withCookie(errorResponse(503, 'dispatch_failed'), guest?.setCookie ?? null);
  }
  return withCookie(json({ job: publicJob(job, baseURL) }, { status: 201 }), guest?.setCookie ?? null);
}
