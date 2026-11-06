import { env } from 'cloudflare:test';
import { getBalance, grantCredits, spendCredits } from '@shipwords/core/credits/ledger';
import { createDb } from '@shipwords/core/db/client';
import { consumeQuota } from '@shipwords/core/quota/counters';
import { describe, expect, it } from 'vitest';
import { loadJob, markFailed, markSucceeded, spendKey } from '../src/lifecycle';
import { defineModels } from '../src/models';
import { jobs } from '../src/schema';
import { sweepStaleJobs } from '../src/sweep';

const db = createDb(env.DB);

const models = defineModels([
  {
    id: 'fast',
    name: 'Fast',
    kind: 'image',
    upstream: 'yir',
    upstreamModel: 'vendor/fast',
    credits: 10,
    guest: true,
    allowedParameters: [],
    maxReferences: 0,
    timeoutMinutes: 10,
  },
  {
    id: 'slow',
    name: 'Slow',
    kind: 'video',
    upstream: 'yir',
    upstreamModel: 'vendor/slow',
    credits: 40,
    guest: false,
    allowedParameters: [],
    maxReferences: 0,
    timeoutMinutes: 60,
  },
]);

const age = (minutes: number) => Date.now() - minutes * 60_000;

async function job(overrides: Partial<typeof jobs.$inferInsert> = {}) {
  const jobId = `job_${crypto.randomUUID().replaceAll('-', '')}`;
  await db.insert(jobs).values({
    id: jobId,
    modelId: 'fast',
    kind: 'image',
    prompt: 'a cat',
    inputJson: JSON.stringify({ references: [], parameters: {} }),
    upstream: 'yir',
    ...overrides,
  });
  return jobId;
}

async function paidJob(minutesOld: number) {
  const userId = `u_${crypto.randomUUID().slice(0, 10)}`;
  const jobId = await job({
    userId,
    costCredits: 10,
    createdAt: age(minutesOld),
  });
  await grantCredits(db, { userId, amount: 50, idemKey: `g:${userId}`, source: 'test' });
  await spendCredits(db, { userId, amount: 10, idemKey: spendKey(jobId) }, []);
  return { userId, jobId };
}

describe('sweepStaleJobs', () => {
  it('ends a queued job past its deadline and refunds the credits', async () => {
    const { userId, jobId } = await paidJob(30);
    const ended = await sweepStaleJobs(db, models);
    expect(ended).toContain(jobId);
    expect(await loadJob(db, jobId)).toMatchObject({ status: 'failed', errorCode: 'stale' });
    expect((await getBalance(db, userId)).available).toBe(50);
  });

  it('ends a submitted job past its deadline, but not one still inside a longer model window', async () => {
    const staleSubmitted = await job({ status: 'submitted', modelId: 'fast', createdAt: age(30) });
    const runningLongModel = await job({ status: 'submitted', modelId: 'slow', createdAt: age(30) });
    const ended = await sweepStaleJobs(db, models);
    expect(ended).toContain(staleSubmitted);
    expect(ended).not.toContain(runningLongModel);
    expect(await loadJob(db, runningLongModel)).toMatchObject({ status: 'submitted' });
  });

  it('leaves young jobs and finished jobs alone', async () => {
    const young = await job({ createdAt: age(5) });
    const succeeded = await job({ status: 'succeeded', createdAt: age(120) });
    const ended = await sweepStaleJobs(db, models);
    expect(ended).not.toContain(young);
    expect(ended).not.toContain(succeeded);
    expect(await loadJob(db, young)).toMatchObject({ status: 'queued' });
    expect(await loadJob(db, succeeded)).toMatchObject({ status: 'succeeded' });
  });

  it('a job that succeeds while the sweep runs stays succeeded (the conditional update loses, not the output)', async () => {
    const { userId, jobId } = await paidJob(30);
    await markSucceeded(db, jobId, [{ key: 'out/a.png', mediaType: 'image/png' }]);
    const ended = await sweepStaleJobs(db, models);
    expect(ended).not.toContain(jobId);
    expect(await loadJob(db, jobId)).toMatchObject({ status: 'succeeded' });
    expect((await getBalance(db, userId)).available).toBe(40);
  });

  it('a failed guest job returns its quota, and repeated settlement returns it only once', async () => {
    const rule = { key: `guest:device:${crypto.randomUUID()}`, window: 'w', limit: 1 };
    expect(await consumeQuota(db, [rule])).toBe(true);
    const jobId = await job({
      guestId: 'g_1',
      quotaJson: JSON.stringify([rule]),
      createdAt: age(30),
    });
    expect(await sweepStaleJobs(db, models)).toContain(jobId);
    // A repeat (heal-on-read, or another sweep racing the same job) settles again without double return.
    await markFailed(db, jobId, 'failed', 'stale', 'the job stopped responding');
    expect(await consumeQuota(db, [rule])).toBe(true);
    expect(await consumeQuota(db, [rule])).toBe(false);
  });

  it('a model no longer on the site falls back to the 45 minute default deadline', async () => {
    const removed = await job({ modelId: 'gone', createdAt: age(50) });
    const recent = await job({ modelId: 'gone', createdAt: age(40) });
    const ended = await sweepStaleJobs(db, models);
    expect(ended).toContain(removed);
    expect(ended).not.toContain(recent);
    expect(await loadJob(db, removed)).toMatchObject({ status: 'failed', errorCode: 'stale' });
  });

  it('an empty model list still sweeps with the default deadline', async () => {
    const stale = await job({ modelId: 'gone', createdAt: age(60) });
    const ended = await sweepStaleJobs(db, []);
    expect(ended).toContain(stale);
  });
});
