import { and, count, desc, eq, getTableColumns, inArray, lt, sql } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import {
  creditLedger,
  creditLots,
  orders,
  payments,
  user,
  userAttribution,
} from '@shipwords/core/db/schema';
import { errorResponse } from '@shipwords/core/http';
import type { Db } from '@shipwords/core/db/client';
import { jobs } from '@shipwords/jobs/schema';
import { pendingSubmissionKeys } from '@shipwords/jobs/lifecycle';
import { core } from './core.server';
import models from './models.server';

// Server-only admin statistics for /admin; the page gets them through /api/admin/stats.
// Non-admins get a bare 404, so the endpoint doesn't reveal itself. All figures USD-cents or
// whole credits unless a field name says otherwise.

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
    upstreamConfirmedUsd: number;
    upstreamOtherRecordedUsd: number;
    billingPending: number;
    billingTotal: number;
    creditsOutstanding: number;
  };
  daily: { day: string; signups: number; jobs: number; checkouts: number; paid: number }[];
  /** 14-day cohort pulse: score a traffic burst the day it happens. */
  funnel: {
    signups: number;
    activated: number;
    checkouts: number;
    paidOrders: number;
    paidUsers: number;
  };
  modelDist: { label: string | null; count: number }[];
  errorDist: { label: string | null; count: number }[];
  ledger: { kind: string; count: number; delta: number }[];
  sources: { label: string | null; count: number }[];
  referrers: { label: string | null; count: number }[];
  users: {
    id: string;
    email: string;
    emailVerified: boolean;
    createdAt: number;
    credits: number;
    jobs: number;
    source: string | null;
  }[];
  orders: { id: string; productId: string; amount: number; status: string; createdAt: number; email: string | null }[];
  payments: {
    id: string;
    productId: string;
    amount: number;
    amountRefunded: number;
    createdAt: number;
    email: string | null;
  }[];
  stuck: { id: string; modelId: string; status: string; createdAt: number; minutesOld: number; upstreamCostUsd: number }[];
  recentJobs: {
    id: string;
    modelId: string;
    status: string;
    costCredits: number;
    errorCode: string | null;
    upstreamCostUsd: number;
    durationSec: number | null;
    createdAt: number;
  }[];
  billingReview: {
    id: string;
    modelId: string;
    status: string;
    billingStatus: string;
    costCredits: number;
    upstreamCostUsd: string | null;
    refunded: boolean;
    createdAt: number;
    pendingKeys: { index: number; key: string }[] | null;
  }[];
}

// Only explicit billing decisions are confirmed; other historical cost snapshots may be pending.
const verified = sql`case when json_valid(${jobs.inputJson}) then json_extract(${jobs.inputJson}, '$._verifiedBilling') = 1 else 0 end`;
const upstreamConfirmedUsd = sql<number>`coalesce(sum(case when ${verified} and ${jobs.errorCode} in ('billing_charged', 'billing_refunded') then cast(${jobs.upstreamCostUsd} as real) else 0 end), 0)`.mapWith(Number);
const upstreamOtherRecordedUsd = sql<number>`coalesce(sum(case when not (${verified}) or ${jobs.errorCode} is null or ${jobs.errorCode} not in ('billing_pending', 'billing_refunding', 'billing_charged', 'billing_refunded') then cast(${jobs.upstreamCostUsd} as real) else 0 end), 0)`.mapWith(Number);
const upstreamRowUsd = sql<number>`cast(${jobs.upstreamCostUsd} as real)`.mapWith(Number);
/** Core tables store createdAt as timestamp_ms: drizzle returns Date, which JSON would stringify — keep numbers. */
const ms = (value: Date | number) => new Date(value).getTime();

export async function adminStats(billingOffset = 0, db: Db = core.db): Promise<AdminStats> {
  const since = Date.now() - 14 * 86_400_000;
  const signupDay = sql<string>`date(${user.createdAt} / 1000, 'unixepoch')`;
  const jobDay = sql<string>`date(${jobs.createdAt} / 1000, 'unixepoch')`;

  const [userTotals] = await db.select({ total: count() }).from(user);
  const [orderTotals] = await db
    .select({
      total: count(),
      pending: sql<number>`count(*) filter (where ${orders.status} = 'pending')`.mapWith(Number),
    })
    .from(orders);
  const [paymentTotals] = await db
    .select({
      total: count(),
      netMinor: sql<number>`coalesce(sum(${payments.amount} - ${payments.amountRefunded}), 0)`.mapWith(Number),
    })
    .from(payments);
  const [creditTotals] = await db
    .select({ remaining: sql<number>`coalesce(sum(${creditLots.remaining}), 0)`.mapWith(Number) })
    .from(creditLots);
  const [upstreamTotals] = await db.select({
    confirmed: upstreamConfirmedUsd,
    other: upstreamOtherRecordedUsd,
    pending: sql<number>`count(*) filter (where ${verified} and ${jobs.errorCode} in ('billing_pending', 'billing_refunding'))`.mapWith(Number),
    billingTotal: sql<number>`count(*) filter (where ${verified} and ${jobs.errorCode} in ('billing_pending', 'billing_refunding', 'billing_charged', 'billing_refunded'))`.mapWith(Number),
  }).from(jobs);
  const jobStatus = await db.select({ status: jobs.status, count: count() }).from(jobs).groupBy(jobs.status);

  const signupDaily = await db
    .select({ day: signupDay.mapWith(String), count: count() })
    .from(user)
    .where(sql`${user.createdAt} >= ${since}`)
    .groupBy(signupDay);
  const jobDaily = await db
    .select({ day: jobDay.mapWith(String), count: count() })
    .from(jobs)
    .where(sql`${jobs.createdAt} >= ${since}`)
    .groupBy(jobDay);
  const orderDay = sql<string>`date(${orders.createdAt} / 1000, 'unixepoch')`;
  const checkoutDaily = await db
    .select({
      day: orderDay.mapWith(String),
      total: count(),
      paid: sql<number>`count(*) filter (where ${orders.status} = 'paid')`.mapWith(Number),
    })
    .from(orders)
    .where(sql`${orders.createdAt} >= ${since}`)
    .groupBy(orderDay);
  const signupMap = new Map(signupDaily.map((row) => [row.day, row.count]));
  const jobMap = new Map(jobDaily.map((row) => [row.day, row.count]));
  const checkoutMap = new Map(checkoutDaily.map((row) => [row.day, row.total]));
  const paidMap = new Map(checkoutDaily.map((row) => [row.day, row.paid]));
  const daily = [...new Map([...signupMap, ...jobMap, ...checkoutMap]).keys()].sort().reverse();
  const byDay = (map: Map<string, number>, day: string) => map.get(day) ?? 0;

  // 14-day funnel cohort: signups, how many of them generated, and how far the money path went.
  const [funnelSignups] = await db.select({ total: count() }).from(user).where(sql`${user.createdAt} >= ${since}`);
  const [funnelActivated] = await db
    .select({ total: sql<number>`count(distinct ${jobs.userId})`.mapWith(Number) })
    .from(jobs)
    .innerJoin(user, eq(user.id, jobs.userId))
    .where(and(sql`${jobs.createdAt} >= ${since}`, sql`${user.createdAt} >= ${since}`));
  const [funnelOrders] = await db
    .select({
      total: count(),
      paid: sql<number>`count(*) filter (where ${orders.status} = 'paid')`.mapWith(Number),
      paidUsers: sql<number>`count(distinct case when ${orders.status} = 'paid' then ${orders.userId} end)`.mapWith(Number),
    })
    .from(orders)
    .innerJoin(user, eq(user.id, orders.userId))
    .where(sql`${orders.createdAt} >= ${since}`);

  const modelRows = await db
    .select({ label: jobs.modelId, count: count() })
    .from(jobs)
    .groupBy(jobs.modelId)
    .orderBy(desc(count()));
  const errorRows = await db
    .select({ label: jobs.errorCode, count: count() })
    .from(jobs)
    .where(eq(jobs.status, 'failed'))
    .groupBy(jobs.errorCode)
    .orderBy(desc(count()))
    .limit(8);
  const ledgerRows = await db
    .select({
      kind: creditLedger.kind,
      count: count(),
      delta: sql<number>`coalesce(sum(${creditLedger.delta}), 0)`.mapWith(Number),
    })
    .from(creditLedger)
    .groupBy(creditLedger.kind);
  const sourceRows = await db
    .select({ label: userAttribution.utmSource, count: count() })
    .from(userAttribution)
    .groupBy(userAttribution.utmSource)
    .orderBy(desc(count()))
    .limit(8);
  const referrerRows = await db
    .select({ label: userAttribution.referrer, count: count() })
    .from(userAttribution)
    .groupBy(userAttribution.referrer)
    .orderBy(desc(count()))
    .limit(8);

  // Recent users with their balance, job count and capture attribution, joined in memory (a single
  // grouped scan per table beats correlated subqueries in D1).
  const userRows = await db
    .select({
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    })
    .from(user)
    .orderBy(desc(user.createdAt))
    .limit(20);
  const balances = await db
    .select({ userId: creditLots.userId, remaining: sql<number>`coalesce(sum(${creditLots.remaining}), 0)`.mapWith(Number) })
    .from(creditLots)
    .groupBy(creditLots.userId);
  const jobCounts = await db
    .select({ userId: jobs.userId, count: count() })
    .from(jobs)
    .groupBy(jobs.userId);
  const attributions = await db
    .select({ userId: userAttribution.userId, utmSource: userAttribution.utmSource })
    .from(userAttribution);
  const balanceMap = new Map(balances.map((row) => [row.userId, row.remaining]));
  const jobCountMap = new Map(jobCounts.map((row) => [row.userId, row.count]));
  const sourceMap = new Map(attributions.map((row) => [row.userId, row.utmSource]));

  const orderRows = await db
    .select({
      id: orders.id,
      productId: orders.productId,
      amount: orders.amount,
      status: orders.status,
      createdAt: orders.createdAt,
      email: user.email,
    })
    .from(orders)
    .leftJoin(user, eq(user.id, orders.userId))
    .orderBy(desc(orders.createdAt))
    .limit(20);
  const paymentRows = await db
    .select({
      id: payments.id,
      productId: payments.productId,
      amount: payments.amount,
      amountRefunded: payments.amountRefunded,
      createdAt: payments.createdAt,
      email: user.email,
    })
    .from(payments)
    .leftJoin(user, eq(user.id, payments.userId))
    .orderBy(desc(payments.createdAt))
    .limit(10);

  // Same deadline as the cron sweep: queued or submitted past it is stuck regardless of the client.
  const minLimit = (models.length ? Math.min(...models.map((model) => model.timeoutMinutes)) : 30) + 15;
  const stuckRows = await db
    .select({
      id: jobs.id,
      modelId: jobs.modelId,
      status: jobs.status,
      createdAt: jobs.createdAt,
      upstreamUsd: upstreamRowUsd,
    })
    .from(jobs)
    .where(and(inArray(jobs.status, ['queued', 'submitted']), lt(jobs.createdAt, Date.now() - minLimit * 60_000)))
    .orderBy(desc(jobs.createdAt))
    .limit(20);
  const recentRows = await db
    .select({
      id: jobs.id,
      modelId: jobs.modelId,
      status: jobs.status,
      costCredits: jobs.costCredits,
      errorCode: jobs.errorCode,
      upstreamUsd: upstreamRowUsd,
      submittedAt: jobs.submittedAt,
      finishedAt: jobs.finishedAt,
      createdAt: jobs.createdAt,
    })
    .from(jobs)
    .orderBy(desc(jobs.createdAt))
    .limit(20);
  // Billing state is carried by the failure code. Never expose upstream_job_id: a pending
  // recovery marker can contain generation input rather than just an opaque provider ID.
  const billingRows = await db
    .select({
      ...getTableColumns(jobs),
      refunded: sql<number>`exists(select 1 from credit_ledger where idem_key = 'refund:job:' || ${jobs.id})`.mapWith(Number),
      createdAt: jobs.createdAt,
    })
    .from(jobs)
    .where(and(verified, inArray(jobs.errorCode, ['billing_pending', 'billing_refunding', 'billing_charged', 'billing_refunded'])))
    .orderBy(sql`case when ${jobs.errorCode} in ('billing_pending', 'billing_refunding') then 0 else 1 end`, desc(jobs.createdAt))
    .limit(100).offset(billingOffset);

  return {
    totals: {
      users: userTotals?.total ?? 0,
      jobs: Object.fromEntries(jobStatus.map((row) => [row.status, row.count])),
      orders: orderTotals?.total ?? 0,
      ordersPending: orderTotals?.pending ?? 0,
      payments: paymentTotals?.total ?? 0,
      netRevenueUsd: (paymentTotals?.netMinor ?? 0) / 100,
      upstreamConfirmedUsd: upstreamTotals?.confirmed ?? 0,
      upstreamOtherRecordedUsd: upstreamTotals?.other ?? 0,
      billingPending: upstreamTotals?.pending ?? 0,
      billingTotal: upstreamTotals?.billingTotal ?? 0,
      creditsOutstanding: creditTotals?.remaining ?? 0,
    },
    daily: daily.map((day) => ({
      day,
      signups: byDay(signupMap, day),
      jobs: byDay(jobMap, day),
      checkouts: byDay(checkoutMap, day),
      paid: byDay(paidMap, day),
    })),
    funnel: {
      signups: funnelSignups?.total ?? 0,
      activated: funnelActivated?.total ?? 0,
      checkouts: funnelOrders?.total ?? 0,
      paidOrders: funnelOrders?.paid ?? 0,
      paidUsers: funnelOrders?.paidUsers ?? 0,
    },
    modelDist: modelRows,
    errorDist: errorRows,
    ledger: ledgerRows,
    sources: sourceRows,
    referrers: referrerRows,
    users: userRows.map((row) => ({
      id: row.id,
      email: row.email,
      emailVerified: row.emailVerified,
      createdAt: ms(row.createdAt),
      credits: balanceMap.get(row.id) ?? 0,
      jobs: jobCountMap.get(row.id) ?? 0,
      source: sourceMap.get(row.id) ?? null,
    })),
    orders: orderRows.map((row) => ({ ...row, createdAt: ms(row.createdAt) })),
    payments: paymentRows.map((row) => ({ ...row, createdAt: ms(row.createdAt) })),
    stuck: stuckRows.map((row) => ({
      id: row.id,
      modelId: row.modelId,
      status: row.status,
      createdAt: row.createdAt,
      minutesOld: Math.round((Date.now() - row.createdAt) / 60_000),
      upstreamCostUsd: row.upstreamUsd,
    })),
    recentJobs: recentRows.map((row) => ({
      id: row.id,
      modelId: row.modelId,
      status: row.status,
      costCredits: row.costCredits,
      errorCode: row.errorCode,
      upstreamCostUsd: row.upstreamUsd,
      durationSec:
        row.finishedAt == null
          ? null
          : Math.max(0, Math.round((row.finishedAt - (row.submittedAt ?? row.createdAt)) / 1000)),
      createdAt: row.createdAt,
    })),
    billingReview: billingRows.map((row) => {
      let pendingKeys: { index: number; key: string }[] | null = [];
      if (row.errorCode === 'billing_pending') {
        try { pendingKeys = pendingSubmissionKeys(row); } catch { pendingKeys = null; }
      }
      return {
        id: row.id, modelId: row.modelId, status: row.status, billingStatus: row.errorCode!,
        costCredits: row.costCredits, upstreamCostUsd: row.errorCode === 'billing_pending' ? null : row.upstreamCostUsd,
        refunded: row.refunded === 1, createdAt: row.createdAt, pendingKeys,
      };
    }),
  };
}
