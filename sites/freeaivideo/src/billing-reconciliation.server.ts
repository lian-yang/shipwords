import type { Db } from '@shipwords/core/db/client';
import { reconcileFailure } from '@shipwords/jobs/lifecycle';
import { jobs } from '@shipwords/jobs/schema';
import type { UpstreamAdapter } from '@shipwords/jobs/upstream';
import { and, asc, count, inArray, sql } from 'drizzle-orm';

const BATCH_SIZE = 25;
const HOUR = 60 * 60 * 1000;
const RETRYABLE = ['billing_pending', 'billing_refunding'];
const verified = sql`case when json_valid(${jobs.inputJson}) then json_extract(${jobs.inputJson}, '$._verifiedBilling') = 1 else 0 end`;

/** Retry a bounded, rotating batch so an old unresolved job cannot starve later jobs. */
export async function reconcilePendingBilling(
  db: Db,
  adapters: Record<string, UpstreamAdapter>,
  now = Date.now(),
): Promise<void> {
  const [result] = await db.select({ total: count() }).from(jobs).where(and(verified, inArray(jobs.errorCode, RETRYABLE)));
  const total = result?.total ?? 0;
  if (!total) return;
  const pages = Math.ceil(total / BATCH_SIZE);
  const offset = (Math.floor(now / HOUR) % pages) * BATCH_SIZE;
  const rows = await db.select({ id: jobs.id }).from(jobs)
    .where(and(verified, inArray(jobs.errorCode, RETRYABLE)))
    .orderBy(asc(jobs.createdAt), asc(jobs.id)).limit(BATCH_SIZE).offset(offset);
  for (const row of rows) {
    try {
      await reconcileFailure(db, row.id, adapters);
    } catch (error) {
      // A single provider failure must not prevent later jobs from being checked.
      console.error('billing reconciliation failed', {
        jobId: row.id,
        error: error instanceof Error ? error.name : 'unknown',
      });
    }
  }
}
