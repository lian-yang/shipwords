import { safeRelativePath } from '@shipwords/core/http';
import { waitForOrder } from '@shipwords/core/react/account';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { recordConfirmedPayment } from '~/lib/track';
import { notifyCreditsChanged } from '~/lib/use-credit-balance';
import { m } from '~/paraglide/messages.js';

/** Give customers time to see the confirmation before returning. */
const CONTINUE_DELAY_MS = 3500;

const safeNext = (value: unknown) => safeRelativePath(value, '/account');

export const Route = createFileRoute('/billing/return')({
  validateSearch: (search: Record<string, unknown>) => ({
    order: typeof search.order === 'string' ? search.order : '',
    next: safeNext(search.next),
  }),
  head: () => ({
    meta: [
      { title: m.common_billing_title() },
      { name: 'robots', content: 'noindex' },
      // The return URL contains an order id. Do not leak it to the next page.
      { name: 'referrer', content: 'no-referrer' },
    ],
  }),
  component: ReturnPage,
});

// Checkout return confirms the order before returning to the generator.
function ReturnPage() {
  const { order, next } = Route.useSearch();
  const [state, setState] = useState<'checking' | 'paid' | 'pending'>(order ? 'checking' : 'pending');

  useEffect(() => {
    if (!order) return;
    let active = true;
    let timer: number | undefined;

    void waitForOrder(order)
      .catch(() => 'pending' as const)
      .then((status) => {
        if (!active) return;
        setState(status);
        if (status !== 'paid') return;
        recordConfirmedPayment(order);
        notifyCreditsChanged();
        timer = window.setTimeout(() => window.location.assign(next), CONTINUE_DELAY_MS);
      });

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [order, next]);

  const title = {
    checking: m.common_billing_checking,
    paid: m.common_billing_paid_title,
    pending: m.common_billing_pending_title,
  }[state];

  return (
    <section
      className="utility-frame utility-card billing-status"
      data-status={state}
      aria-labelledby="pay-return-title"
    >
      <span className="billing-mark" aria-hidden="true" />
      <div aria-live="polite" aria-atomic="true">
        <h1 id="pay-return-title">{title()}</h1>
        {state === 'checking' && <p className="muted">{m.common_billing_checking_note()}</p>}
        {state === 'paid' && <p className="muted">{m.common_billing_paid()}</p>}
        {state === 'pending' && (
          <p className="muted">
            {m.common_billing_pending_before()} <a href="/account">{m.common_billing_pending_link()}</a>{' '}
            {m.common_billing_pending_after()}
          </p>
        )}
      </div>
      {state !== 'checking' && (
        <a className="button primary" href={next}>
          {m.common_billing_continue()}
        </a>
      )}
      {order && (
        <dl className="billing-reference">
          <dt>{m.common_billing_order_reference()}</dt>
          <dd>{order}</dd>
        </dl>
      )}
    </section>
  );
}
