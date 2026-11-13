# Pending-order recovery, webhook ops, funnel snapshot

Status: in progress (2026-11-13). Covers three changes motivated by the first real order
(2026-11-12) and the as8235366 abandoned checkout (2026-11-10). Delete or fold into
docs/architecture.md when done.

## 1. Stripe webhook — ops only, no code

`handleWebhook` (core `billing/handlers.ts`), the `/api/webhooks/stripe` route and the
production `STRIPE_WEBHOOK_SECRET` all exist; `webhook_events` is empty only because no
endpoint is registered in Stripe live mode. Action: register
`https://www.freeaivideo.app/api/webhooks/stripe` with the events listed in
docs/site-launch.md, keep the existing worker secret (or rotate it and update both sides).

## 2. Abandoned-checkout reminder (code)

Goal: one recovery email for checkouts opened but never paid, and catch late payments
the still-missing webhook would have delivered.

Public interface changes (reason for this note):

- `orders` gains `reminder_sent_at` (integer, nullable). Each site generates its own
  migration (`pnpm db:generate`); freeaivideo, the core test DB and the ai-site template
  have theirs.
- `CheckoutFact` gains two optional fields: `url` (provider checkout page, for the email
  deep link) and `expiresAt` (when the session can no longer be paid). Stripe fills both
  from the session; PayPal returns null for now (unknown expiry is treated as still open,
  and the email then links to the site's pricing page instead).

New core module `billing/recovery.ts`, `remindPendingOrders(ctx, now)`:

1. Select pending orders with a checkout ref, created 1–48 h ago, `reminder_sent_at IS NULL`
   (batch-capped). The 1 h floor avoids mailing people mid-checkout.
2. For each: `fetchCheckout` → `applyCheckout` (same convergence as the webhook path —
   a late payment is applied here, and paid orders are then skipped without email).
3. Still pending and not expired: conditionally set `reminder_sent_at` where it is still
   NULL; only the run that flips the row sends the email. Concurrent cron runs therefore
   cannot double-send. A send failure after the flip is logged and not retried (never
   risk two emails over one lost reminder).
4. Email copy `checkoutReminder` added to core `email/copy.ts` (en/ja/ko), deep link when
   the provider gives a URL, else the pricing page. No money writes anywhere: the module
   only reads provider state through the existing reconcile path and writes the marker.

Site wiring: freeaivideo `src/server.ts` hourly cron calls it after billing
reconciliation with `createMailer(env, site.name)`.

PayPal caveat for other sites: `PayPalProvider.fetchCheckout` captures APPROVED orders, so
this cron also captures approved-but-abandoned orders there. That is the adapter's existing
semantic, but wiring `remindPendingOrders` on a PayPal site makes it hourly and automatic —
an explicit decision, not an accident.

Review (2026-11-13, independent): approved with fixes; findings addressed — per-user
newest-only reminder (repeated Buy clicks are one intent), the PayPal caveat above, and
template migration.

## 3. Funnel snapshot (site layer)

`admin.server.ts`: the daily table gains checkouts and paid orders per day, plus a 14-day
`funnel` block (signups → activated [≥1 job] → checkouts → paid orders/users) so the next
ChatGPT burst can be scored immediately. Read-only queries; no schema change.

## Tests

recovery: exactly-one-email across repeat runs and concurrent runs; skips <1 h and >48 h;
late payment applied and no email; expired session no email; send failure does not block
later orders or retry the same one. Admin funnel numbers get a smoke test via the existing
admin test setup if present.
