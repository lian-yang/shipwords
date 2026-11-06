import { and, count, desc, inArray, lt, sql } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { creditLots, orders, payments, user } from '@shipwords/core/db/schema';
import { errorResponse } from '@shipwords/core/http';
import { jobs } from '@shipwords/jobs/schema';
import { core } from './core.server';
import models from './models.server';

// Server-only admin statistics for /admin; the page gets them through /api/admin/stats.
// Non-admins get a bare 404, so the endpoint doesn't reveal itself.

export async function adminGate(request: Request): Promise<Response | null> {
  const account = await core.getUser(request);
  if (!account || account.email.toLowerCase() !== env.ADMIN_EMAIL.toLowerCase())
    return errorResponse(404, 'not_found', 'Not found.');
  return null;
}

export interface AdminStats {
  totals: {
    users: number;
    jobs: Record<string, number>;
    orders: number;
    ordersPending: number;
    payments: number;
    netRevenueUsd: number;
    creditsOutstanding: number;
  };
  signups: { day: string; count: number }[];
  recentJobs: {
    id: string;
    modelId: string;
    status: string;
    costCredits: number;
    errorCode: string | null;
    createdAt: number;
  }[];
  stuck: { id: string; modelId: string; status: string; createdAt: number; minutesOld: number }[];
}

export async function adminStats(): Promise<AdminStats> {
  const day = sql<string>`date(${user.createdAt} / 1000, 'unixepoch')`;
  const [userTotals] = await core.db.select({ total: count() }).from(user);
  const [orderTotals] = await core.db
    .select({
      total: count(),
      pending: sql<number>`count(*) filter (where ${orders.status} = 'pending')`.mapWith(Number),
    })
    .from(orders);
  const [paymentTotals] = await core.db
    .select({
      total: count(),
      netMinor: sql<number>`coalesce(sum(${payments.amount} - ${payments.amountRefunded}), 0)`.mapWith(Number),
    })
    .from(payments);
  const [creditTotals] = await core.db
    .select({ remaining: sql<number>`coalesce(sum(${creditLots.remaining}), 0)`.mapWith(Number) })
    .from(creditLots);
  const jobStatus = await core.db.select({ status: jobs.status, count: count() }).from(jobs).groupBy(jobs.status);
  const signups = await core.db
    .select({ day: day.mapWith(String), count: count() })
    .from(user)
    .where(sql`${user.createdAt} >= ${Date.now() - 14 * 86_400_000}`)
    .groupBy(day)
    .orderBy(desc(day));
  const recentJobs = await core.db
    .select({
      id: jobs.id,
      modelId: jobs.modelId,
      status: jobs.status,
      costCredits: jobs.costCredits,
      errorCode: jobs.errorCode,
      createdAt: jobs.createdAt,
    })
    .from(jobs)
    .orderBy(desc(jobs.createdAt))
    .limit(20);
  // Same deadline as the cron sweep: queued or submitted past it is stuck regardless of the client.
  const minLimit = (models.length ? Math.min(...models.map((model) => model.timeoutMinutes)) : 30) + 15;
  const stuckRows = await core.db
    .select({
      id: jobs.id,
      modelId: jobs.modelId,
      status: jobs.status,
      createdAt: jobs.createdAt,
    })
    .from(jobs)
    .where(and(inArray(jobs.status, ['queued', 'submitted']), lt(jobs.createdAt, Date.now() - minLimit * 60_000)))
    .orderBy(desc(jobs.createdAt))
    .limit(20);

  return {
    totals: {
      users: userTotals?.total ?? 0,
      jobs: Object.fromEntries(jobStatus.map((row) => [row.status, row.count])),
      orders: orderTotals?.total ?? 0,
      ordersPending: orderTotals?.pending ?? 0,
      payments: paymentTotals?.total ?? 0,
      netRevenueUsd: (paymentTotals?.netMinor ?? 0) / 100,
      creditsOutstanding: creditTotals?.remaining ?? 0,
    },
    signups,
    recentJobs,
    stuck: stuckRows.map((row) => ({
      ...row,
      minutesOld: Math.round((Date.now() - row.createdAt) / 60_000),
    })),
  };
}
