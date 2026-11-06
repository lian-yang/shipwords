import type { CreditBalanceStatus } from '~/lib/use-credit-balance';
import { m } from '~/paraglide/messages.js';
import { PricingLink } from '~/site/pricing';
import site from '../../site.config';

export const largestCreditPack = Math.max(
  0,
  ...site.products.map((product) => (product.kind === 'credits' ? product.credits : 0)),
);

export function creditShortfall(status: CreditBalanceStatus, available: number | null, cost: number): number {
  return status === 'ready' && available !== null ? Math.max(0, cost - available) : 0;
}

/** The displayed balance is guidance; the server still decides whether the request can be charged. */
export function CreditSummary({
  status,
  available,
  cost,
  onRefresh,
  onSignIn,
}: {
  status: CreditBalanceStatus;
  available: number | null;
  cost: number;
  onRefresh: () => void;
  onSignIn: () => void;
}) {
  const shortfall = creditShortfall(status, available, cost);
  return (
    <div className="credit-summary" aria-live="polite">
      {status === 'ready' && available !== null && (
        <>
          <p className="credit-summary-balance">
            {m.home_balance_available({ credits: Math.max(0, available).toLocaleString() })}
          </p>
          {available < 0 && <p>{m.home_balance_debt({ amount: (-available).toLocaleString() })}</p>}
        </>
      )}
      {status === 'loading' && <p>{m.home_balance_loading()}</p>}
      {status === 'error' && (
        <p>
          {m.home_balance_unavailable()}{' '}
          <button type="button" className="link-button" onClick={onRefresh}>
            {m.home_balance_retry()}
          </button>
        </p>
      )}
      {status === 'signed_out' && (
        <p>
          {m.home_balance_sign_in()}{' '}
          <button type="button" className="link-button" onClick={onSignIn}>
            {m.home_tool_sign_in()}
          </button>
        </p>
      )}
      {shortfall > 0 && (
        <div className="credit-shortfall">
          <p>
            {shortfall > largestCreditPack && largestCreditPack > 0
              ? m.home_credit_multiple_packs({
                  amount: shortfall.toLocaleString(),
                  max: largestCreditPack.toLocaleString(),
                })
              : m.home_credit_shortfall({ amount: shortfall.toLocaleString() })}
          </p>
          <PricingLink source="balance_shortfall" requiredCredits={cost}>
            {m.home_view_credit_packs()}
          </PricingLink>
        </div>
      )}
    </div>
  );
}
