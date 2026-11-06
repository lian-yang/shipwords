import { env } from 'cloudflare:test';
import type { WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import { getBalance, grantCredits, spendCredits } from '@shipwords/core/credits/ledger';
import { createDb } from '@shipwords/core/db/client';
import type { Core } from '@shipwords/core/server';
import { claimGuestJobs, loadJob, spendKey } from '@shipwords/jobs/lifecycle';
import { jobs } from '@shipwords/jobs/schema';
import { YirAdapter } from '@shipwords/jobs/yir';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import site from '../site.config';
import { createSiteJob } from '../src/create-job.server';
import { GenerationWorkflow } from '../src/generation-workflow.server';
import { paidMaxCost } from '../src/video-pricing.server';
import models from '../src/models.server';
import { creditsFor } from '@shipwords/jobs/models';

const db = createDb(env.DB);
const BASE = 'https://www.freeaivideo.app';

beforeEach(async () => {
  await env.DB.batch(
    [
      'DELETE FROM jobs',
      'DELETE FROM quota_counters',
      'DELETE FROM credit_allocations',
      'DELETE FROM credit_ledger',
      'DELETE FROM credit_lots',
      'DELETE FROM credit_accounts',
    ].map((query) => env.DB.prepare(query)),
  );
  // Public package imports ensure the mock and site runner use the same adapter instance,
  // including when the release tree reuses an isolated dependency installation.
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      throw new Error(`Workflow compatibility test forbids external requests: ${url}`);
    }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function accountWith(credits = 200) {
  const id = `u_${crypto.randomUUID().replaceAll('-', '')}`;
  await grantCredits(db, { userId: id, amount: credits, idemKey: `purchase:${id}`, source: 'purchase' });
  return { id, email: `${id}@example.test`, name: 'Compatibility customer' };
}

async function currentPaid(image = false) {
  const user = await accountWith();
  // A job accepted before the new catalog existed, with its original charge and input.
  const id = `job_${crypto.randomUUID().replaceAll('-', '')}`;
  await spendCredits(db, { userId: user.id, amount: 100, idemKey: spendKey(id), ref: id }, [
    db.insert(jobs).values({
      id, userId: user.id, modelId: 'seedance-2-5', kind: 'video',
      prompt: 'A lighthouse above the quiet sea', costCredits: 100, upstream: 'yir',
      inputJson: JSON.stringify({
        references: image ? [{ url: `${BASE}/files/uploads/reference.jpg`, role: 'first_frame' }] : [],
        parameters: { duration: 10, resolution: '720p', aspect_ratio: image ? 'auto' : '9:16' },
      }),
    }),
  ]);
  return { user, job: (await loadJob(db, id))! };
}

function cachedSteps(options: { failPolicy?: boolean } = {}) {
  const cache = new Map<string, unknown>();
  const executed: string[] = [];
  const step = {
    do: async (name: string, ...args: unknown[]) => {
      if (cache.has(name)) return cache.get(name);
      executed.push(name);
      if (name === 'site:generation-policy:v1' && options.failPolicy) {
        throw new Error('Policy lookup retry budget exhausted (test simulation)');
      }
      const result = await (args.at(-1) as () => Promise<unknown>)();
      cache.set(name, result);
      return result;
    },
    sleep: async () => {},
  } as unknown as WorkflowStep;
  return { step, executed };
}

function actualRun(jobId: string, step: WorkflowStep) {
  const receiver = {
    env: { DB: env.DB, OUTPUTS: env.OUTPUTS, APP_URL: BASE, YIR_API_KEY: 'test-only-never-sent' },
  } as unknown as GenerationWorkflow;
  return GenerationWorkflow.prototype.run.call(
    receiver,
    { payload: { jobId } } as WorkflowEvent<{ jobId: string }>,
    step,
  );
}

function fakeUpstream() {
  const submit = vi.spyOn(YirAdapter.prototype, 'submit').mockImplementation(async (_input, key) => ({
    upstreamJobId: `up_${key}`,
  }));
  vi.spyOn(YirAdapter.prototype, 'poll').mockResolvedValue({
    state: 'failed',
    code: 'test_completed',
    message: 'Mock terminal result; no real request or charge',
  });
  vi.spyOn(YirAdapter.prototype, 'cancel').mockResolvedValue(undefined);
  vi.spyOn(YirAdapter.prototype, 'cost').mockResolvedValue({ usd: '0', settled: true });
  return submit;
}

describe('account and legacy Workflow compatibility', () => {
  it('charges the selected paid specification and submits it with its own saved cost ceiling', async () => {
    const user = await accountWith(5000);
    const dispatch = vi.fn(async () => ({}));
    const core = {
      db, site,
      env: { DB: env.DB, OUTPUTS: env.OUTPUTS, APP_URL: BASE, GENERATION_WORKFLOW: { create: dispatch } },
      getUser: async () => user,
      log: () => {},
    } as unknown as Core;
    const response = await createSiteJob(core, new Request(`${BASE}/api/jobs`, {
      method: 'POST', headers: { origin: BASE, 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'paid', modelId: 'seedance-2-5-v2', prompt: 'A quiet sea',
        parameters: { duration: 30, resolution: '1080p', aspect_ratio: '9:16' } }),
    }));
    expect(response.status).toBe(201);
    const { job: result } = await response.json() as { job: { id: string } };
    const job = (await loadJob(db, result.id))!;
    const parameters = JSON.parse(job.inputJson).parameters;
    expect(parameters).toMatchObject({ duration: 30, resolution: '1080p', aspect_ratio: '9:16', generate_audio: false });
    expect(job.costCredits).toBe(creditsFor(models.find((model) => model.id === job.modelId)!, parameters));
    expect((await getBalance(db, user.id)).available).toBe(5000 - job.costCredits);
    const submit = fakeUpstream();
    await actualRun(job.id, cachedSteps().step);
    expect(submit).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      parameters, maxCost: paidMaxCost(job.modelId, parameters),
    }), job.id);
    expect((await getBalance(db, user.id)).available).toBe(5000);
  });

  it('fails closed and refunds a saved new-version job with an invalid specification', async () => {
    const user = await accountWith();
    const id = `job_${crypto.randomUUID().replaceAll('-', '')}`;
    await spendCredits(db, { userId: user.id, amount: 100, idemKey: spendKey(id), ref: id }, [
      db.insert(jobs).values({ id, userId: user.id, modelId: 'seedance-2-5-v2', kind: 'video',
        prompt: 'Invalid saved job', costCredits: 100, upstream: 'yir',
        inputJson: JSON.stringify({ references: [], parameters: { duration: 999, resolution: '1080p' } }),
      }),
    ]);
    const submit = fakeUpstream();
    await actualRun(id, cachedSteps().step);
    expect(submit).not.toHaveBeenCalled();
    expect(await loadJob(db, id)).toMatchObject({ status: 'failed', errorCode: 'internal_error' });
    expect((await getBalance(db, user.id)).available).toBe(200);
  });

  it('limits a queued job to the value of the credits actually charged if prices later change', async () => {
    const user = await accountWith();
    const id = `job_${crypto.randomUUID().replaceAll('-', '')}`;
    await spendCredits(db, { userId: user.id, amount: 10, idemKey: spendKey(id), ref: id }, [
      db.insert(jobs).values({ id, userId: user.id, modelId: 'seedance-2-5-v2', kind: 'video',
        prompt: 'Previously priced job', costCredits: 10, upstream: 'yir',
        inputJson: JSON.stringify({ references: [], parameters: {
          duration: 30, resolution: '1080p', aspect_ratio: '16:9', generate_audio: false,
        } }),
      }),
    ]);
    const submit = fakeUpstream();
    await actualRun(id, cachedSteps().step);
    expect(submit).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ maxCost: '0.199900' }), id);
    expect((await getBalance(db, user.id)).available).toBe(200);
  });

  it('uses the selected specification margin when capping an older paid charge', async () => {
    const user = await accountWith();
    const id = `job_${crypto.randomUUID().replaceAll('-', '')}`;
    await spendCredits(db, { userId: user.id, amount: 10, idemKey: spendKey(id), ref: id }, [
      db.insert(jobs).values({ id, userId: user.id, modelId: 'seedance-2-5-v2', kind: 'video',
        prompt: 'Previously priced job', costCredits: 10, upstream: 'yir',
        inputJson: JSON.stringify({ references: [], parameters: {
          duration: 4, resolution: '480p', aspect_ratio: '16:9', generate_audio: false,
        } }),
      }),
    ]);
    const submit = fakeUpstream();
    await actualRun(id, cachedSteps().step);
    expect(submit).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ maxCost: '0.259870' }), id);
    expect((await getBalance(db, user.id)).available).toBe(200);
  });
  it.each([false, true])('uses the current 10s720p $2.60 policy for an account image=%s', async (image) => {
    const { user, job } = await currentPaid(image);
    expect(job.costCredits).toBe(100);
    expect((await getBalance(db, user.id)).available).toBe(100);
    const submit = fakeUpstream();
    const { step, executed } = cachedSteps();
    await actualRun(job.id, step);
    expect(submit).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        parameters: { duration: 10, resolution: '720p', aspect_ratio: image ? 'auto' : '9:16' },
        maxCost: '2.60',
      }),
      job.id,
    );
    expect(executed).toContain('site:generation-policy:v1');
    expect(executed).toContain('submit');
    expect((await loadJob(db, job.id))!.status).toBe('failed');
    expect((await getBalance(db, user.id)).available).toBe(200);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([false, true])('keeps the old 10s480p guest ceiling at $1.20 after claimed=%s', async (claimed) => {
    const user = await accountWith();
    const guestId = `g_${crypto.randomUUID().replaceAll('-', '')}`;
    const id = `job_${crypto.randomUUID().replaceAll('-', '')}`;
    await db.insert(jobs).values({
      id,
      guestId,
      modelId: 'seedance-2-5',
      kind: 'video',
      prompt: 'A legacy guest request',
      inputJson: JSON.stringify({
        references: [],
        parameters: { duration: 10, resolution: '480p', aspect_ratio: '16:9' },
      }),
      costCredits: 0,
      quotaJson: '[]',
      upstream: 'yir',
    });
    if (claimed) await claimGuestJobs(db, guestId, user.id);
    const submit = fakeUpstream();
    await actualRun(id, cachedSteps().step);
    expect(submit).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        parameters: { duration: 10, resolution: '480p', aspect_ratio: '16:9' },
        maxCost: '1.20',
      }),
      id,
    );
    expect(await loadJob(db, id)).toMatchObject({
      guestId,
      userId: claimed ? user.id : null,
      status: 'failed',
    });
    expect((await getBalance(db, user.id)).available).toBe(200);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps a legacy account request with unspecified duration at its original $1.20 ceiling', async () => {
    const user = await accountWith();
    const id = `job_${crypto.randomUUID().replaceAll('-', '')}`;
    await spendCredits(db, { userId: user.id, amount: 60, idemKey: spendKey(id), ref: id }, [
      db.insert(jobs).values({
        id,
        userId: user.id,
        modelId: 'seedance-2-5',
        kind: 'video',
        prompt: 'A legacy account request',
        inputJson: JSON.stringify({ references: [], parameters: { aspect_ratio: '16:9' } }),
        costCredits: 60,
        upstream: 'yir',
      }),
    ]);
    expect((await getBalance(db, user.id)).available).toBe(140);
    const submit = fakeUpstream();
    await actualRun(id, cachedSteps().step);
    expect(submit).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        parameters: { aspect_ratio: '16:9' },
        maxCost: '1.20',
      }),
      id,
    );
    expect(submit.mock.calls[0]![0].parameters).not.toHaveProperty('duration');
    expect((await getBalance(db, user.id)).available).toBe(200);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('retains $0.60 for an already queued 4s480p guest job claimed before this release', async () => {
    const user = await accountWith();
    const guestId = `g_${crypto.randomUUID().replaceAll('-', '')}`;
    const id = `job_${crypto.randomUUID().replaceAll('-', '')}`;
    await db.insert(jobs).values({
      id,
      guestId,
      modelId: 'seedance-2-5',
      kind: 'video',
      prompt: 'An earlier 4-second guest job',
      inputJson: JSON.stringify({
        references: [],
        parameters: { duration: 4, resolution: '480p', aspect_ratio: '1:1' },
      }),
      costCredits: 0,
      quotaJson: '[]',
      upstream: 'yir',
    });
    await claimGuestJobs(db, guestId, user.id);
    const submit = fakeUpstream();
    await actualRun(id, cachedSteps().step);
    expect(submit).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        parameters: { duration: 4, resolution: '480p', aspect_ratio: '1:1' },
        maxCost: '0.60',
      }),
      id,
    );
    expect((await getBalance(db, user.id)).available).toBe(200);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('replays cached account steps without submitting or refunding twice', async () => {
    const { user, job } = await currentPaid();
    const submit = fakeUpstream();
    const { step, executed } = cachedSteps();
    await actualRun(job.id, step);
    await actualRun(job.id, step);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(executed.filter((name) => name === 'submit')).toHaveLength(1);
    expect((await getBalance(db, user.id)).available).toBe(200);
    const refund = await env.DB.prepare('SELECT count(*) AS count FROM credit_ledger WHERE idem_key=?')
      .bind(`refund:${spendKey(job.id)}`)
      .first<{ count: number }>();
    expect(refund!.count).toBe(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('settles once through abort:outer when policy lookup exhausts its retries', async () => {
    const { user, job } = await currentPaid();
    const submit = fakeUpstream();
    const { step, executed } = cachedSteps({ failPolicy: true });
    await actualRun(job.id, step);
    await actualRun(job.id, step);
    expect(executed.filter((name) => name === 'abort:outer')).toHaveLength(1);
    expect(await loadJob(db, job.id)).toMatchObject({ status: 'failed', errorCode: 'internal_error' });
    expect(submit).not.toHaveBeenCalled();
    expect((await getBalance(db, user.id)).available).toBe(200);
    const refund = await env.DB.prepare('SELECT count(*) AS count FROM credit_ledger WHERE idem_key=?')
      .bind(`refund:${spendKey(job.id)}`)
      .first<{ count: number }>();
    expect(refund!.count).toBe(1);
    expect(fetch).not.toHaveBeenCalled();
  });
});
