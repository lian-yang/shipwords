import { refundSpend } from '@shipwords/core/credits/ledger';
import type { BatchItem, Db } from '@shipwords/core/db/client';
import { quotaCounters } from '@shipwords/core/db/schema';
import type { QuotaRule } from '@shipwords/core/quota/counters';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { type JobRow, jobs } from './schema';
import type { SubmitInput, UpstreamAdapter } from './upstream';

// Every write to job state goes through here. Each state change is a conditional UPDATE;
// refunds and quota returns after failure or cancel settle on the final state, so they can be repeated and survive partial failure.

const ACTIVE: JobRow['status'][] = ['queued', 'submitted'];

export const spendKey = (jobId: string) => `job:${jobId}`;
export const BILLING_PENDING = 'billing_pending';
export const BILLING_CHARGED = 'billing_charged';
export const BILLING_REFUNDING = 'billing_refunding';
export const BILLING_REFUNDED = 'billing_refunded';
export const PENDING_UPSTREAM = 'pending:';

/** Server-owned policy snapshot; request parameters cannot opt themselves into a settlement policy. */
export function hasVerifiedBilling(job: Pick<JobRow, 'inputJson'>): boolean {
  try { return (JSON.parse(job.inputJson) as { _verifiedBilling?: unknown })._verifiedBilling === true; }
  catch { return false; }
}

/** Serialize a request before dispatch; base64 contains no comma, the existing upstream ID separator. */
export function pendingSubmit(input: SubmitInput, key: string): string {
  const bytes = new TextEncoder().encode(JSON.stringify({ input, key }));
  return PENDING_UPSTREAM + btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''));
}

export function readPendingSubmit(value: string): { input: SubmitInput; key: string } {
  const bytes = Uint8Array.from(atob(value.slice(PENDING_UPSTREAM.length)), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as { input: SubmitInput; key: string };
}

export async function loadJob(db: Db, jobId: string): Promise<JobRow | null> {
  const [row] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  return row ?? null;
}

export async function markSubmitted(db: Db, jobId: string, upstreamJobId: string): Promise<boolean> {
  const result = await db
    .update(jobs)
    .set({ status: 'submitted', upstreamJobId, submittedAt: Date.now() })
    .where(and(eq(jobs.id, jobId), eq(jobs.status, 'queued')))
    .run();
  return result.meta.changes > 0;
}

/** upstream_job_id stores upstream task IDs comma-separated in segment order; a single-part job has one ID. */
/** Placeholder ID recorded in a segment slot when the upstream rejects a prep submit: no upstream task, never polled or canceled. */
export const SKIPPED_UPSTREAM = 'skipped:';

function rawUpstreamEntries(job: Pick<JobRow, 'upstreamJobId'>): string[] {
  return job.upstreamJobId ? job.upstreamJobId.split(',') : [];
}
export function upstreamIds(job: Pick<JobRow, 'upstreamJobId'>): string[] {
  return rawUpstreamEntries(job);
}

/** Atomically claim a slot before its request can be sent. Only an identical request may reuse a claim. */
export async function claimUpstreamJob(db: Db, jobId: string, index: number, pending: string): Promise<boolean> {
  if (index === 0) {
    const result = await db.update(jobs).set({ status: 'submitted', upstreamJobId: pending, submittedAt: Date.now() })
      .where(and(eq(jobs.id, jobId), eq(jobs.status, 'queued'))).run();
    if (result.meta.changes > 0) return true;
  }
  const job = await loadJob(db, jobId);
  if (!job || job.status !== 'submitted') return false;
  const ids = upstreamIds(job);
  if (ids[index] === pending) return true;
  if (ids.length !== index || !job.upstreamJobId) return false;
  const result = await db.update(jobs).set({ upstreamJobId: [...ids, pending].join(',') })
    .where(and(eq(jobs.id, jobId), eq(jobs.status, 'submitted'), eq(jobs.upstreamJobId, job.upstreamJobId))).run();
  return result.meta.changes > 0;
}

/**
 * Record the upstream task ID for segment `index` (0-based). Segment 0 also advances the job to submitted;
 * later segments are appended only while the job is in progress and exactly the first `index` segments are recorded, so replays never duplicate or misalign.
 * Returns false if the job has ended (or was advanced elsewhere); the caller should cancel the upstream task it just submitted.
 */
export async function appendUpstreamJob(
  db: Db,
  jobId: string,
  index: number,
  upstreamJobId: string,
): Promise<boolean> {
  if (index === 0 && (await markSubmitted(db, jobId, upstreamJobId))) return true;
  const job = await loadJob(db, jobId);
  if (!job || (job.status !== 'submitted' && job.status !== 'failed')) return false;
  const ids = upstreamIds(job);
  // Only a verified failure may record an in-flight claim after termination.
  // Legacy jobs were already refunded, so a late submission must be canceled.
  if (job.status === 'failed' && (!hasVerifiedBilling(job) ||
    (ids[index] !== upstreamJobId && (job.errorCode !== BILLING_PENDING || !ids[index]?.startsWith(PENDING_UPSTREAM))))) return false;
  if (ids[index] === upstreamJobId) return true;
  if (ids.length !== index && !ids[index]?.startsWith(PENDING_UPSTREAM)) return false;
  const next = [...ids];
  next[index] = upstreamJobId;
  const result = await db
    .update(jobs)
    .set({ upstreamJobId: next.join(',') })
    .where(and(eq(jobs.id, jobId), eq(jobs.status, job.status), eq(jobs.upstreamJobId, job.upstreamJobId!)))
    .run();
  if (result.meta.changes > 0) return true;
  const latest = await loadJob(db, jobId);
  return Boolean(latest && upstreamIds(latest)[index] === upstreamJobId);
}

export interface StoredOutput {
  key: string;
  mediaType: string;
}

export async function markSucceeded(db: Db, jobId: string, outputs: StoredOutput[]): Promise<boolean> {
  const result = await db
    .update(jobs)
    .set({ status: 'succeeded', outputsJson: JSON.stringify(outputs), finishedAt: Date.now() })
    .where(and(eq(jobs.id, jobId), inArray(jobs.status, ACTIVE)))
    .run();
  return result.meta.changes > 0;
}

/** Record the upstream charge of an ended job; only bookkeeping, it never touches state or credits, so a re-read simply overwrites it. */
export async function recordUpstreamCost(db: Db, jobId: string, usd: string): Promise<void> {
  await db.update(jobs).set({ upstreamCostUsd: usd }).where(and(eq(jobs.id, jobId),
    sql`(${jobs.errorCode} is null or ${jobs.errorCode} not in (${BILLING_REFUNDING}, ${BILLING_REFUNDED}, ${BILLING_CHARGED}))`)).run();
}

/** Move an in-progress job to failed or canceled, then settle the refund. If the job already ended the state isn't changed, but settlement still runs. */
export async function markFailed(
  db: Db,
  jobId: string,
  status: 'failed' | 'canceled',
  code: string,
  message: string,
): Promise<JobRow | null> {
  await db
    .update(jobs)
    .set({ status, errorCode: sql`case when ${jobs.status} = 'submitted' and case when json_valid(${jobs.inputJson}) then json_extract(${jobs.inputJson}, '$._verifiedBilling') = 1 else 0 end then ${BILLING_PENDING} else ${code} end`, errorMessage: message.slice(0, 500), finishedAt: Date.now() })
    .where(and(eq(jobs.id, jobId), inArray(jobs.status, ACTIVE)));
  const job = await loadJob(db, jobId);
  if (job) await settleFailure(db, job);
  return job;
}

/**
 * User cancel: only while nothing has been submitted upstream, then settle the refund. A running upstream task bills whether or not
 * it is canceled, so refunding then would let a user loop submit → cancel for free renders; such a job keeps going and delivers.
 * The first submit moves the job out of queued with a conditional update too (markSubmitted), so exactly one of the two wins;
 * when the cancel wins, the runner cancels the task it just submitted. Returns the job as it is now.
 */
export async function cancelQueued(db: Db, jobId: string): Promise<JobRow | null> {
  await db
    .update(jobs)
    .set({
      status: 'canceled',
      errorCode: 'canceled',
      errorMessage: 'canceled by user',
      finishedAt: Date.now(),
    })
    .where(and(eq(jobs.id, jobId), eq(jobs.status, 'queued')));
  const job = await loadJob(db, jobId);
  if (job) await settleFailure(db, job);
  return job;
}

/**
 * Failed and canceled jobs: refund credits (idempotent). Failed guest jobs also return their quota (once); canceled ones don't, because the
 * upstream may already have charged us (a cancel just before the result lands), and returning it would let one guest loop create → cancel forever.
 * Succeeded jobs do nothing.
 */
export async function settleFailure(db: Db, job: JobRow): Promise<void> {
  if (job.status !== 'failed' && job.status !== 'canceled') return;
  if (job.errorCode === BILLING_PENDING || job.errorCode === BILLING_CHARGED) return;
  if (job.costCredits > 0 && job.userId) {
    const refund = await refundSpend(db, {
      spendIdemKey: spendKey(job.id),
      idemKey: `refund:${spendKey(job.id)}`,
      ref: job.id,
    });
    if (!refund.ledgerId) throw new Error('cannot confirm the original credit spend');
  }
  if (job.status === 'failed' && job.quotaJson && !job.quotaReleased) {
    // The quota decrements and the "returned" flag share one batch: each decrement is conditioned on the flag not being set,
    // so repeated calls return once, and a partial failure can't leave "flag set, count not returned".
    const notReleased = sql`exists (select 1 from ${jobs} where ${jobs.id} = ${job.id} and ${jobs.quotaReleased} = 0)`;
    const rules = JSON.parse(job.quotaJson) as QuotaRule[];
    const decrements = rules.map((rule) =>
      db
        .update(quotaCounters)
        .set({ count: sql`max(${quotaCounters.count} - 1, 0)` })
        .where(and(eq(quotaCounters.key, rule.key), eq(quotaCounters.window, rule.window), notReleased)),
    );
    // The flag must come last: the decrements above are conditioned on it not being set.
    const markReleased = db.update(jobs).set({ quotaReleased: true }).where(eq(jobs.id, job.id));
    const items: BatchItem[] = [...decrements, markReleased];
    await db.batch(items as [BatchItem, ...BatchItem[]]);
  }
  if (hasVerifiedBilling(job) && (job.errorCode === BILLING_REFUNDING || (job.costCredits > 0 && job.userId))) {
    await db.update(jobs).set({ errorCode: BILLING_REFUNDED })
      .where(and(eq(jobs.id, job.id), inArray(jobs.status, ['failed', 'canceled']),
        job.errorCode ? eq(jobs.errorCode, job.errorCode) : isNull(jobs.errorCode))).run();
  }
}

/** Retryable, fail-closed settlement: only a complete settled-zero bill permits a refund. */
export async function reconcileFailure(db: Db, jobId: string, adapters: Record<string, UpstreamAdapter>): Promise<JobRow | null> {
  let job = await loadJob(db, jobId);
  if (!job || !hasVerifiedBilling(job) || (job.status !== 'failed' && job.status !== 'canceled')) return job;
  if (job.errorCode === BILLING_PENDING) {
    const adapter = adapters[job.upstream];
    const ids = upstreamIds(job);
    if (!adapter?.cost || ids.some((id) => id.startsWith(PENDING_UPSTREAM)) || !ids.length) return job;
    const real = ids.filter((id) => !id.startsWith(SKIPPED_UPSTREAM));
    try {
      const statuses = await Promise.all(real.map((id) => adapter.poll(id, 0)));
      if (statuses.some((status) => status.state === 'running')) return job;
      const bills = await Promise.all(real.map((id) => adapter.cost!(id)));
      if (bills.some((bill) => !bill.settled || !/^(?:0|[1-9]\d{0,30})(?:\.\d{1,30})?$/.test(bill.usd))) return job;
      const scale = Math.max(6, ...bills.map((bill) => (bill.usd.split('.')[1] ?? '').length));
      const multiplier = 10n ** BigInt(scale);
      const micros = bills.reduce((total, bill) => {
        const [whole, fraction = ''] = bill.usd.split('.');
        return total + BigInt(whole!) * multiplier + BigInt(fraction.padEnd(scale, '0') || '0');
      }, 0n);
      const charged = micros > 0n;
      const usd = `${micros / multiplier}.${String(micros % multiplier).padStart(scale, '0')}`;
      const result = await db.update(jobs)
        .set({ errorCode: charged ? BILLING_CHARGED : BILLING_REFUNDING, upstreamCostUsd: usd })
        .where(and(eq(jobs.id, jobId), eq(jobs.status, job.status), eq(jobs.errorCode, BILLING_PENDING), eq(jobs.upstreamJobId, job.upstreamJobId!))).run();
      if (result.meta.changes) job = (await loadJob(db, jobId))!;
    } catch { return job; }
  }
  if (job.errorCode !== BILLING_PENDING && job.errorCode !== BILLING_CHARGED) await settleFailure(db, job);
  return loadJob(db, jobId);
}

/** Operator-only: list frozen idempotency keys without disclosing prompts or references. */
export function pendingSubmissionKeys(job: JobRow): { index: number; key: string }[] {
  return upstreamIds(job).flatMap((id, index) => id.startsWith(PENDING_UPSTREAM)
    ? [{ index, key: readPendingSubmit(id).key }]
    : []);
}

/** After a guest signs in, move this device's guest jobs to the new account. */
export async function claimGuestJobs(db: Db, guestId: string, userId: string): Promise<void> {
  await db
    .update(jobs)
    .set({ userId })
    .where(and(eq(jobs.guestId, guestId), isNull(jobs.userId)))
    .run();
}
