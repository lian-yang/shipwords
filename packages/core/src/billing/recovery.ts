import { and, asc, eq, gt, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import { emailCopy } from '../email/copy';
import type { Mailer } from '../email/send';
import { type Db } from '../db/client';
import { orders, user } from '../db/schema';
import { findProduct, type SiteConfig } from '../site';
import type { PaymentProvider } from './provider';
import { applyCheckout, type ReconcileContext } from './reconcile';

// Abandoned-checkout recovery: for checkouts opened but never paid, send exactly one reminder email.
// No money writes happen here; any late payment is applied through the same reconcile path the webhook uses.

const HOUR = 3_600_000;
/** After 48 h the provider session is long expired; orders age out instead of being reminded. */
const MAX_AGE = 48 * HOUR;
/** Don't email someone who may still be mid-checkout. */
const MIN_AGE = 1 * HOUR;
const BATCH = 20;

export interface RecoveryDeps extends ReconcileContext {
  mailer: Pick<Mailer, 'send'>;
  baseURL: string;
}

/**
 * remindPendingOrders returns the number of reminder emails sent. Safe to run repeatedly and
 * concurrently: an order is only emailed when it wins a conditional UPDATE on reminder_sent_at,
 * so every run agrees on exactly one winner. A send failure after winning is logged and not
 * retried — one lost reminder beats the risk of two. Each user is reminded about at most their
 * newest pending checkout in the window — repeated Buy clicks are one purchase intent, not many.
 *
 * Beware on PayPal sites: fetchCheckout captures APPROVED orders, so this cron also captures
 * approved-but-abandoned orders. That is the provider adapter's existing semantic; wire this
 * call only if that is what you want.
 */
export async function remindPendingOrders(deps: RecoveryDeps, now = Date.now()): Promise<number> {
  const rows = await deps.db
    .select({
      id: orders.id,
      checkoutRef: orders.checkoutRef,
      productId: orders.productId,
      amount: orders.amount,
      currency: orders.currency,
      userId: orders.userId,
      email: user.email,
    })
    .from(orders)
    .innerJoin(user, eq(user.id, orders.userId))
    .where(
      and(
        eq(orders.status, 'pending'),
        isNotNull(orders.checkoutRef),
        isNull(orders.reminderSentAt),
        gt(orders.createdAt, now - MAX_AGE),
        lt(orders.createdAt, now - MIN_AGE),
        // Only the user's newest pending checkout in the window: older duplicates of the same
        // purchase intent never become the newest, so they are never reminded on their own.
        sql`${orders.createdAt} = (
          select max(o2.created_at) from ${orders} o2
          where o2.user_id = ${orders.userId} and o2.status = 'pending'
            and o2.checkout_ref is not null and o2.created_at > ${now - MAX_AGE}
        )`,
      ),
    )
    .orderBy(asc(orders.createdAt))
    .limit(BATCH);

  let sent = 0;
  for (const row of rows) {
    try {
      const fact = await deps.provider.fetchCheckout(row.checkoutRef!);
      // First converge local state: a payment completed after the client left is applied here,
      // exactly as a webhook would have, and the order stops being "abandoned".
      await applyCheckout(deps, fact);
      const fresh = await deps.db.query.orders.findFirst({ where: eq(orders.id, row.id) });
      if (fresh?.status !== 'pending') continue;

      if (fact.expiresAt != null && fact.expiresAt <= now) {
        // The session can never be paid again; mark handled so the cron stops re-fetching it.
        await markReminded(deps, row.id, now);
        continue;
      }

      const product = findProduct(deps.site, row.productId);
      if (!product) continue; // Product removed: nothing sensible to advertise.
      if (!(await markReminded(deps, row.id, now))) continue; // Lost the race: the other run sends.

      const checkoutURL = fact.url ?? `${deps.baseURL}/pricing`;
      const price = new Intl.NumberFormat('en-US', { style: 'currency', currency: row.currency }).format(
        row.amount / 100,
      );
      await deps.mailer.send({
        to: row.email,
        ...emailCopy(deps.site.defaultLocale).checkoutReminder({
          siteName: deps.site.name,
          product: product.name,
          price,
          checkoutURL,
        }),
      });
      sent++;
    } catch (error) {
      // One provider or mail failure must not block the rest of the batch.
      deps.log?.('checkout reminder failed', {
        orderId: row.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return sent;
}

/** Claims the right to handle this order; true only for the first caller. */
async function markReminded(deps: RecoveryDeps, orderId: string, now: number): Promise<boolean> {
  const claimed = await deps.db
    .update(orders)
    .set({ reminderSentAt: now })
    .where(and(eq(orders.id, orderId), isNull(orders.reminderSentAt)))
    .run();
  return claimed.meta.changes > 0;
}
