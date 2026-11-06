import type { Db } from '@shipwords/core/db/client';
import { and, inArray, lt } from 'drizzle-orm';
import { markFailed } from './lifecycle';
import type { ModelDefinition } from './models';
import { jobs } from './schema';

/**
 * Server-side fallback for heal-on-read: a job whose client never comes back stays queued forever, and a lost
 * Workflow instance (dispatch's create call failing without being recorded) is invisible to reads. Runs on the
 * site's cron; ends queued and submitted jobs past their per-model deadline plus 15 minutes, so refunds and
 * guest quota settle through markFailed exactly as they do on read.
 */
export async function sweepStaleJobs(db: Db, models: readonly ModelDefinition[]): Promise<string[]> {
  // SQL prefilter on the shortest deadline keeps the scan small; the exact per-model deadline is checked below.
  const minLimit = (models.length ? Math.min(...models.map((model) => model.timeoutMinutes)) : 30) + 15;
  const rows = await db
    .select({ id: jobs.id, modelId: jobs.modelId, createdAt: jobs.createdAt })
    .from(jobs)
    .where(and(inArray(jobs.status, ['queued', 'submitted']), lt(jobs.createdAt, Date.now() - minLimit * 60_000)))
    // A pathological backlog can't run one cron invocation out of CPU; the next run continues.
    .limit(100);
  const ended: string[] = [];
  for (const row of rows) {
    const limit = ((models.find((model) => model.id === row.modelId)?.timeoutMinutes ?? 30) + 15) * 60_000;
    if (Date.now() - row.createdAt < limit) continue;
    const job = await markFailed(db, row.id, 'failed', 'stale', 'the job stopped responding');
    if (job && job.status !== 'queued' && job.status !== 'submitted') ended.push(job.id);
  }
  return ended;
}
