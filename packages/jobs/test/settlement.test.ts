import { env } from 'cloudflare:test';
import { getBalance, grantCredits, spendCredits } from '@shipwords/core/credits/ledger';
import { createDb } from '@shipwords/core/db/client';
import { describe, expect, it } from 'vitest';
import { BILLING_PENDING, BILLING_REFUNDED, BILLING_REFUNDING, appendUpstreamJob, cancelQueued, claimUpstreamJob, loadJob, markFailed, pendingSubmit, reconcileFailure, spendKey } from '../src/lifecycle';
import { jobs } from '../src/schema';
import type { PollResult, UpstreamAdapter, UpstreamCost } from '../src/upstream';

const db = createDb(env.DB);
const input = { upstreamModel: 'vendor/model', kind: 'video' as const, prompt: '测试', references: [], parameters: { duration: 4 }, maxCost: '0.12' };
async function job() {
  const id = `j_${crypto.randomUUID()}`;
  const userId = `u_${crypto.randomUUID()}`;
  await grantCredits(db, { userId, amount: 20, idemKey: `g:${id}`, source: 'test' });
  await spendCredits(db, { userId, amount: 10, idemKey: spendKey(id) }, [db.insert(jobs).values({
    id, userId, modelId: 'x', kind: 'video', upstream: 'yir', prompt: 'x', inputJson: '{"_verifiedBilling":true}', costCredits: 10,
  })]);
  return { id, userId };
}
function adapter(status: PollResult, cost: UpstreamCost | Error, calls: string[] = []): UpstreamAdapter {
  return { name: 'yir', submit: async () => { calls.push('submit'); return { upstreamJobId: 'unexpected' }; },
    poll: async () => status, cancel: async () => {}, cost: async () => { if (cost instanceof Error) throw cost; return cost; } };
}
async function submitted(id: string) {
  const pending = pendingSubmit(input, id);
  expect(await claimUpstreamJob(db, id, 0, pending)).toBe(true);
  expect(await appendUpstreamJob(db, id, 0, 'up_1')).toBe(true);
}
const terminal: PollResult = { state: 'failed', code: 'fail', message: 'failed' };

describe('billing-aware settlement', () => {
  it('claim wins cancellation and repeat is idempotent', async () => {
    const { id, userId } = await job();
    const pending = pendingSubmit(input, id);
    expect(await claimUpstreamJob(db, id, 0, pending)).toBe(true);
    expect(await claimUpstreamJob(db, id, 0, pending)).toBe(true);
    expect(await cancelQueued(db, id)).toMatchObject({ status: 'submitted' });
    expect((await getBalance(db, userId)).available).toBe(10);
  });
  it('cancel wins before claim and refunds once', async () => {
    const { id, userId } = await job();
    await cancelQueued(db, id);
    expect(await claimUpstreamJob(db, id, 0, pendingSubmit(input, id))).toBe(false);
    await cancelQueued(db, id);
    expect((await getBalance(db, userId)).available).toBe(20);
  });
  it('only terminal, settled zero refunds, even under duplicate concurrent reconciliation', async () => {
    const { id, userId } = await job(); await submitted(id);
    await markFailed(db, id, 'failed', 'upstream_failed', 'bad');
    const bill = adapter(terminal, { usd: '0.000000', settled: true });
    await Promise.all([reconcileFailure(db, id, { yir: bill }), reconcileFailure(db, id, { yir: bill })]);
    expect(await loadJob(db, id)).toMatchObject({ errorCode: BILLING_REFUNDED, upstreamCostUsd: '0.000000' });
    expect((await getBalance(db, userId)).available).toBe(20);
  });
  it('running or unsettled or malformed or unreadable bill never refunds', async () => {
    for (const [state, amount] of [
      [{ state: 'running' }, { usd: '0', settled: true }],
      [terminal, { usd: '0', settled: false }],
      [terminal, { usd: '-0', settled: true }],
      [terminal, new Error('billing unavailable')],
    ] as [PollResult, UpstreamCost | Error][]) {
      const { id, userId } = await job(); await submitted(id); await markFailed(db, id, 'failed', 'x', 'x');
      await reconcileFailure(db, id, { yir: adapter(state, amount) });
      expect(await loadJob(db, id)).toMatchObject({ errorCode: BILLING_PENDING });
      expect((await getBalance(db, userId)).available).toBe(10);
    }
  });
  it('settled positive cost keeps credits, and later stale reads cannot reopen settlement', async () => {
    const { id, userId } = await job(); await submitted(id); await markFailed(db, id, 'failed', 'x', 'x');
    await reconcileFailure(db, id, { yir: adapter(terminal, { usd: '0.000001', settled: true }) });
    await reconcileFailure(db, id, { yir: adapter(terminal, { usd: '0', settled: false }) });
    expect(await loadJob(db, id)).toMatchObject({ errorCode: 'billing_charged', upstreamCostUsd: '0.000001' });
    expect((await getBalance(db, userId)).available).toBe(10);
  });
  it('terminal unresolved request is not resent during reconciliation', async () => {
    const { id, userId } = await job(); await claimUpstreamJob(db, id, 0, pendingSubmit(input, id));
    await markFailed(db, id, 'failed', 'timeout', 'timeout');
    const calls: string[] = [];
    await reconcileFailure(db, id, { yir: adapter(terminal, { usd: '0', settled: true }, calls) });
    expect(calls).toEqual([]);
    expect(await loadJob(db, id)).toMatchObject({ errorCode: BILLING_PENDING });
    expect((await getBalance(db, userId)).available).toBe(10);
  });
  it('records a late verified pending submission after failure so its cost can be settled', async () => {
    const { id, userId } = await job(); await submitted(id);
    expect(await claimUpstreamJob(db, id, 1, pendingSubmit(input, `${id}:second`))).toBe(true);
    await markFailed(db, id, 'failed', 'timeout', 'timeout');
    expect(await appendUpstreamJob(db, id, 1, 'up_2')).toBe(true);
    await reconcileFailure(db, id, { yir: adapter(terminal, { usd: '0', settled: true }) });
    expect(await loadJob(db, id)).toMatchObject({ errorCode: BILLING_REFUNDED, upstreamJobId: 'up_1,up_2' });
    expect((await getBalance(db, userId)).available).toBe(20);
    expect(await appendUpstreamJob(db, id, 1, 'up_2')).toBe(true);
    expect(await appendUpstreamJob(db, id, 1, 'up_different')).toBe(false);
    expect(await appendUpstreamJob(db, id, 2, 'up_new')).toBe(false);
  });
  it('a persisted refund-in-progress finishes once after interruption', async () => {
    const { id, userId } = await job(); await submitted(id); await markFailed(db, id, 'failed', 'x', 'x');
    const { eq } = await import('drizzle-orm');
    await db.update(jobs).set({ errorCode: BILLING_REFUNDING, upstreamCostUsd: '0.000000' }).where(eq(jobs.id, id));
    await Promise.all([reconcileFailure(db, id, {}), reconcileFailure(db, id, {})]);
    expect(await loadJob(db, id)).toMatchObject({ errorCode: BILLING_REFUNDED });
    expect((await getBalance(db, userId)).available).toBe(20);
  });
  it('every segment must finish with a settled zero bill', async () => {
    const { id, userId } = await job(); await submitted(id);
    const pending = pendingSubmit(input, `${id}:second`);
    expect(await claimUpstreamJob(db, id, 1, pending)).toBe(true);
    expect(await appendUpstreamJob(db, id, 1, 'up_2')).toBe(true);
    await markFailed(db, id, 'failed', 'x', 'x');
    const upstream: UpstreamAdapter = { ...adapter(terminal, { usd: '0', settled: true }),
      cost: async (id) => id === 'up_2' ? { usd: '0.00000001', settled: true } : { usd: '0', settled: true } };
    await reconcileFailure(db, id, { yir: upstream });
    expect(await loadJob(db, id)).toMatchObject({ errorCode: 'billing_charged', upstreamCostUsd: '0.00000001' });
    expect((await getBalance(db, userId)).available).toBe(10);
  });
});
