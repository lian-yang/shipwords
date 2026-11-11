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
    void waitForOrder(order)
      .catch(() => 'pending' as const)
      .then((status) => {
        setState(status);
        if (status !== 'paid') return;
        recordConfirmedPayment(order);
        notifyCreditsChanged();
        setTimeout(() => window.location.assign(next), CONTINUE_DELAY_MS);
      });
  }, [order, next]);

  return (
    <div className="pay-return" role="dialog" aria-modal="true" aria-labelledby="pay-return-title">
      <div className="pay-return-card">
        {state === 'checking' && (
          <>
            <h1 id="pay-return-title">{m.common_billing_checking()}</h1>
            <p>{m.common_billing_checking_note()}</p>
          </>
        )}

        {state === 'paid' && (
          <>
            <h1 id="pay-return-title">{m.common_billing_paid_title()}</h1>
            <p>{m.common_billing_paid()}</p>
            <a className="button primary" href={next}>
              {m.common_billing_continue()}
            </a>
          </>
        )}

        {state === 'pending' && (
          <>
            <h1 id="pay-return-title">{m.common_billing_pending_title()}</h1>
            <p>
              {m.common_billing_pending_before()} <a href="/account">{m.common_billing_pending_link()}</a>{' '}
              {m.common_billing_pending_after()}
            </p>
            <a className="button primary" href={next}>
              {m.common_billing_continue()}
            </a>
          </>
        )}

        {order && <p className="muted">{order}</p>}
      </div>
    </div>
  );
}
