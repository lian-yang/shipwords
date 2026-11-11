import { useCheckout } from '@shipwords/core/react/account';
import type { Product } from '@shipwords/core/site';
import { getRouteApi, Link } from '@tanstack/react-router';
import { type MouseEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { authClient } from '~/lib/auth';
import { track } from '~/lib/track';
import { m } from '~/paraglide/messages.js';
import { getLocale } from '~/paraglide/runtime.js';
import { useSharedCreditBalance } from '~/site/credit-balance';
import { openSignIn } from '~/site/sign-in';
import site from '../../site.config';

// No separate pricing page: buy from the home #pricing section; other entry points (nav, low credits, account) open a dialog in place.
// Change prices in site.config.ts only.

const OPEN_EVENT = 'site:pricing';
/** Checkout success and cancel both return here; on resume the home page restores the generator from sessionStorage and shows a notice. */
export const RESUME_PATH = '/?resume=1#tool';

export function openPricing(source: string, requiredCredits?: number) {
  track('pricing_open', { source });
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { requiredCredits } }));
}

export function formatPrice(product: Product) {
  const amount = new Intl.NumberFormat(getLocale() === 'zh' ? 'zh-CN' : 'en-US', {
    style: 'currency',
    currency: product.price.currency,
  }).format(product.price.amount / 100);
  return product.kind === 'subscription'
    ? `${amount}/${product.interval === 'month' ? m.common_interval_month() : m.common_interval_year()}`
    : amount;
}

export function productName(productId: string) {
  const product = site.products.find((item) => item.id === productId);
  if (product?.id === 'pack_100') return m.common_plan_starter();
  if (product?.id === 'pack_500') return m.common_plan_creator();
  if (product?.id === 'pack_1250') return m.common_plan_studio();
  return product?.name ?? productId;
}

function describe(product: Product) {
  if (product.kind === 'subscription') {
    return m.common_plan_subscription({
      credits: product.creditsPerPeriod.toLocaleString(),
      interval: product.interval,
    });
  }
  return product.expiresDays
    ? m.common_plan_credits_expiring({ credits: product.credits.toLocaleString(), days: product.expiresDays })
    : m.common_plan_credits({ credits: product.credits.toLocaleString() });
}

/** Link to pricing: opens the dialog with JS, falls back to the home pricing section without. */
export function PricingLink({
  className,
  source,
  requiredCredits,
  children,
}: {
  className?: string;
  source: string;
  requiredCredits?: number;
  children: ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/useValidAnchor: with JS the click opens the dialog; without JS the href still reaches the home pricing section.
    <a
      href="/#pricing"
      className={className}
      onClick={(e: MouseEvent) => {
        e.preventDefault();
        openPricing(source, requiredCredits);
      }}
    >
      {children}
    </a>
  );
}

const root = getRouteApi('__root__');

/** An estimate from the new pack only; it does not include any existing balance. */
export function PackEstimate({ credits, cost }: { credits: number; cost?: number | null }) {
  if (cost == null || !Number.isSafeInteger(cost) || cost <= 0) return null;
  const count = Math.floor(credits / cost);
  return (
    <p className="muted small">
      {count === 0
        ? m.common_plan_not_enough_for_selection({ cost: cost.toLocaleString() })
        : count === 1
          ? m.common_plan_one_for_selection({ cost: cost.toLocaleString() })
          : m.common_plan_for_selection({ count: count.toLocaleString(), cost: cost.toLocaleString() })}
    </p>
  );
}

/** Plan cards and buy buttons; signed-out users sign in first, then go straight to checkout. */
export function Plans({
  heading: Heading = 'h3',
  source = 'section',
  selectedCost,
}: {
  heading?: 'h2' | 'h3';
  /** Goes into the checkout_start event: section for the home pricing block, dialog for the dialog. */
  source?: string;
  /** Cost of the current paid generator settings, when opened from the generator. */
  selectedCost?: number | null;
}) {
  const config = root.useLoaderData();
  const session = authClient(config.googleClientId).useSession();
  const { checkout, pending, error } = useCheckout();
  const plansRef = useRef<HTMLDivElement>(null);
  const sectionViewed = useRef(false);

  useEffect(() => {
    const element = plansRef.current;
    if (
      source !== 'section' ||
      sectionViewed.current ||
      !element ||
      typeof IntersectionObserver === 'undefined'
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          !sectionViewed.current &&
          entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.1)
        ) {
          sectionViewed.current = true;
          track('pricing_view', { source: 'section' });
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [source]);

  function buy(productId: string) {
    // After paying, return to the generator; its input is restored from sessionStorage (routes/index.tsx).
    const start = () => {
      track('checkout_start', { product: productId, source });
      void checkout(productId, RESUME_PATH);
    };
    if (session.data) start();
    else openSignIn(start, 'checkout');
  }

  useEffect(() => {
    if (error) track('checkout_failed', { error: error.slice(0, 100) });
  }, [error]);

  return (
    <>
      <div className="plans" ref={plansRef}>
        {site.products.map((product) => (
          <article key={product.id} className="plan">
            <Heading>{productName(product.id)}</Heading>
            <p className="price">{formatPrice(product)}</p>
            <p className="muted small">{describe(product)}</p>
            {product.kind === 'credits' && <PackEstimate credits={product.credits} cost={selectedCost} />}
            <p className="small">
              <strong>{m.common_no_watermark()}</strong>
            </p>
            {product.id === 'pack_500' && <p className="muted small">{m.common_plan_saving()}</p>}
            <button
              type="button"
              className="primary"
              disabled={pending !== null}
              onClick={() => buy(product.id)}
            >
              {pending === product.id
                ? m.common_plan_redirecting()
                : product.kind === 'subscription'
                  ? m.common_plan_subscribe()
                  : m.common_plan_buy()}
            </button>
          </article>
        ))}
      </div>
      {error && (
        <p className="error" role="alert">
          {m.common_checkout_failed()}
        </p>
      )}
      <p className="muted">
        {m.common_pay_fine()} {/* Opens in a new tab so the dialog and generator input are kept. */}
        <Link to="/refunds" target="_blank" rel="noopener">
          {m.common_pay_refund_policy()}
        </Link>
      </p>
    </>
  );
}

export function PricingDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [requiredCredits, setRequiredCredits] = useState<number | null>(null);
  const balance = useSharedCreditBalance();
  const shortfall =
    requiredCredits !== null && balance.status === 'ready' && balance.available !== null
      ? Math.max(0, requiredCredits - balance.available)
      : 0;
  const largestPack = Math.max(
    0,
    ...site.products.map((product) => (product.kind === 'credits' ? product.credits : 0)),
  );

  useEffect(() => {
    const onOpen = (event: Event) => {
      const amount = (event as CustomEvent<{ requiredCredits?: unknown }>).detail?.requiredCredits;
      setRequiredCredits(
        typeof amount === 'number' && Number.isSafeInteger(amount) && amount > 0 ? amount : null,
      );
      if (dialog.current && !dialog.current.open) dialog.current.showModal();
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  function close() {
    dialog.current?.close();
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: clicking the backdrop is a mouse shortcut; keyboards close with native Esc.
    <dialog
      ref={dialog}
      className="dialog pricing-dialog"
      aria-labelledby="pricing-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <button type="button" className="dialog-close" aria-label={m.common_close()} onClick={close}>
        ×
      </button>
      <h2 id="pricing-title">{m.common_pricing_dialog_title()}</h2>
      {shortfall > 0 && (
        <p className="pricing-shortfall">
          {shortfall > largestPack && largestPack > 0
            ? m.home_credit_multiple_packs({
                amount: shortfall.toLocaleString(),
                max: largestPack.toLocaleString(),
              })
            : m.home_credit_shortfall({ amount: shortfall.toLocaleString() })}
        </p>
      )}
      <Plans source="dialog" selectedCost={requiredCredits} />
    </dialog>
  );
}
