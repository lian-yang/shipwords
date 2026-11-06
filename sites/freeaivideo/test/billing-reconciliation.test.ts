import { env } from 'cloudflare:test';
import { getBalance, grantCredits, spendCredits } from '@shipwords/core/credits/ledger';
import { createDb } from '@shipwords/core/db/client';
import { loadJob, pendingSubmit, spendKey } from '@shipwords/jobs/lifecycle';
import { jobs } from '@shipwords/jobs/schema';
import type { UpstreamAdapter, UpstreamCost } from '@shipwords/jobs/upstream';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { reconcilePendingBilling } from '../src/billing-reconciliation.server';
import { adminStats } from '../src/admin.server';

const db = createDb(env.DB);

beforeEach(async () => {
  await env.DB.batch(['DELETE FROM jobs', 'DELETE FROM credit_allocations', 'DELETE FROM credit_ledger',
    'DELETE FROM credit_lots', 'DELETE FROM credit_accounts'].map((query) => env.DB.prepare(query)));
});

describe('admin billing overview', () => {
  const marker = () => pendingSubmit({ upstreamModel: 'provider/model', kind: 'video', prompt: 'private prompt',
    references: [], parameters: {} }, 'job_key');
  it('shows pending separately from confirmed cost without exposing the saved submission', async () => {
    await job('job_display', marker());
    await env.DB.prepare('UPDATE jobs SET upstream_cost_usd = ? WHERE id = ?').bind('0.25', 'job_display').run();
    await db.insert(jobs).values({ id: 'job_confirmed', modelId: 'seedance-2-5-v2', kind: 'video',
      prompt: 'another private prompt', inputJson: '{"_verifiedBilling":true}', upstream: 'yir', status: 'failed',
      errorCode: 'billing_charged', upstreamCostUsd: '0.120000' });
    const stats = await adminStats(0, db);
    expect(stats.totals).toMatchObject({ upstreamConfirmedUsd: 0.12, upstreamOtherRecordedUsd: 0,
      billingPending: 1, billingTotal: 2 });
    expect(stats.billingReview.find((row) => row.id === 'job_display')).toMatchObject({
      billingStatus: 'billing_pending', upstreamCostUsd: null, pendingKeys: [{ index: 0, key: 'job_key' }],
    });
    expect(JSON.stringify(stats)).not.toContain('private prompt');
    expect(JSON.stringify(stats)).not.toContain(marker());
  });
});

async function job(id: string, upstreamJobId: string | null, errorCode = 'billing_pending', createdAt = 1) {
  const userId = `u_${id}`;
  await grantCredits(db, { userId, amount: 20, idemKey: `grant:${id}`, source: 'purchase' });
  await spendCredits(db, { userId, amount: 10, idemKey: spendKey(id), ref: id }, [
    db.insert(jobs).values({ id, userId, modelId: 'seedance-2-5-v2', kind: 'video', prompt: 'test',
      inputJson: '{"_verifiedBilling":true}', costCredits: 10, upstream: 'yir', upstreamJobId, status: 'failed', errorCode, createdAt }),
  ]);
  return userId;
}

function adapter(cost: (id: string) => Promise<UpstreamCost>): UpstreamAdapter {
  return { name: 'yir', cost, submit: async () => { throw new Error('unexpected submit'); },
    poll: async () => ({ state: 'failed', code: 'test_failure', message: 'test' }), cancel: async () => {} };
}

describe('scheduled billing recovery', () => {
  it('retries pending and interrupted refunds without refunding unknown or charged jobs', async () => {
    const freeUser = await job('job_free', 'up_free');
    const paidUser = await job('job_paid', 'up_paid');
    const unknownUser = await job('job_unknown', null);
    const retryUser = await job('job_retry', 'up_retry', 'billing_refunding');
    const cost = vi.fn(async (id: string) => ({ usd: id === 'up_paid' ? '0.12' : '0', settled: true }));
    await reconcilePendingBilling(db, { yir: adapter(cost) }, 0);
    expect(await loadJob(db, 'job_free')).toMatchObject({ errorCode: 'billing_refunded' });
    expect(await loadJob(db, 'job_paid')).toMatchObject({ errorCode: 'billing_charged' });
    expect(await loadJob(db, 'job_unknown')).toMatchObject({ errorCode: 'billing_pending', upstreamCostUsd: null });
    expect(await loadJob(db, 'job_retry')).toMatchObject({ errorCode: 'billing_refunded' });
    expect((await getBalance(db, freeUser)).available).toBe(20);
    expect((await getBalance(db, retryUser)).available).toBe(20);
    expect((await getBalance(db, paidUser)).available).toBe(10);
    expect((await getBalance(db, unknownUser)).available).toBe(10);
    expect(cost).not.toHaveBeenCalledWith('');
  });

  it('isolates failed provider reads and continues to a later job', async () => {
    const failedUser = await job('job_a', 'up_bad', 'billing_pending', 1);
    const goodUser = await job('job_b', 'up_good', 'billing_pending', 2);
    const cost = vi.fn(async (id: string) => {
      if (id === 'up_bad') throw new Error('private upstream details');
      return { usd: '0', settled: true };
    });
    await reconcilePendingBilling(db, { yir: adapter(cost) }, 0);
    expect(await loadJob(db, 'job_a')).toMatchObject({ errorCode: 'billing_pending' });
    expect(await loadJob(db, 'job_b')).toMatchObject({ errorCode: 'billing_refunded' });
    expect((await getBalance(db, failedUser)).available).toBe(10);
    expect((await getBalance(db, goodUser)).available).toBe(20);
  });

  it('is idempotent when overlapping cron runs examine the same task', async () => {
    const user = await job('job_race', 'up_race');
    const cost = vi.fn(async () => ({ usd: '0', settled: true }));
    await Promise.all([reconcilePendingBilling(db, { yir: adapter(cost) }, 0),
      reconcilePendingBilling(db, { yir: adapter(cost) }, 0)]);
    expect((await getBalance(db, user)).available).toBe(20);
    expect((await env.DB.prepare("SELECT count(*) AS total FROM credit_ledger WHERE idem_key='refund:job:job_race'").first<{total: number}>())?.total).toBe(1);
  });

  it('rotates a bounded batch so unresolved older jobs do not block later jobs', async () => {
    for (let i = 0; i < 26; i++) {
      const id = `job_${String(i).padStart(2, '0')}`;
      await db.insert(jobs).values({ id, modelId: 'seedance-2-5-v2', kind: 'video', prompt: 'test',
        inputJson: '{"_verifiedBilling":true}', costCredits: 0, upstream: 'yir', upstreamJobId: `up_${i}`, status: 'failed',
        errorCode: 'billing_pending', createdAt: i });
    }
    const cost = vi.fn(async () => ({ usd: '0', settled: false }));
    await reconcilePendingBilling(db, { yir: adapter(cost) }, 0);
    expect(cost).toHaveBeenCalledTimes(25);
    expect(cost).not.toHaveBeenCalledWith('up_25');
    await reconcilePendingBilling(db, { yir: adapter(cost) }, 3_600_000);
    expect(cost).toHaveBeenCalledWith('up_25');
    expect(cost).toHaveBeenCalledTimes(26);
  });

  it('does not reconcile an older job without the verified billing snapshot', async () => {
    const user = await job('job_legacy', 'up_legacy');
    await env.DB.prepare('UPDATE jobs SET input_json = ? WHERE id = ?').bind('{}', 'job_legacy').run();
    const cost = vi.fn(async () => ({ usd: '0', settled: true }));
    await reconcilePendingBilling(db, { yir: adapter(cost) }, 0);
    expect(cost).not.toHaveBeenCalled();
    expect(await loadJob(db, 'job_legacy')).toMatchObject({ errorCode: 'billing_pending' });
    expect((await getBalance(db, user)).available).toBe(10);
    expect((await adminStats(0, db)).billingReview).toHaveLength(0);
  });
});
