// Only fixed, non-sensitive dimensions go to analytics. Never send a prompt,
// reference, account identifier, checkout error, or order id.
type Props = Record<string, string | number | boolean>;
type Rybbit = { event(name: string, props?: Props): void };
type AnalyticsWindow = Window & {
  gtag?: (command: 'event', name: string, props: Props) => void;
  rybbit?: Rybbit;
};

const ALLOWED_EVENTS = new Set([
  'generate_click',
  'generate_started',
  'generate_failed',
  'result_ready',
  'result_failed',
  'trial_unavailable_view',
  'trial_blocked',
  'pricing_open',
  'pricing_view',
  'checkout_start',
  'checkout_failed',
  'payment_confirmed',
  'sign_in_open',
  'sign_in',
  'sign_in_failed',
  'sign_in_code_sent',
]);
const ALLOWED_VALUES: Record<string, ReadonlySet<string>> = {
  source: new Set([
    'section',
    'dialog',
    'nav',
    'account',
    'balance_shortfall',
    'insufficient_credits',
    'generator_cost',
    'checkout',
    'generation_mode',
    'signup_trial',
  ]),
  mode: new Set(['daily-trial', 'signup-trial', 'paid']),
  blocked: new Set(['login_required', 'trial_unavailable', 'confirm_another', 'none']),
  reason: new Set([
    'quota',
    'verification_failed',
    'verification_unavailable',
    'status_error',
    'used',
    'expired',
    'ineligible',
    'daily_limit',
    'unverified',
    'signed_out',
    'unknown',
  ]),
  status: new Set(['failed', 'canceled']),
  product: new Set(['pack_100', 'pack_500', 'pack_1250']),
  method: new Set(['google', 'email']),
};

/** An explicit allowlist prevents accidentally sending arbitrary error text or user input. */
export function analyticsProperties(props?: Props): Props {
  const safe: Props = { site_key: 'freeaivideo' };
  if (!props) return safe;
  for (const [key, values] of Object.entries(ALLOWED_VALUES)) {
    const value = props[key];
    // GA's `source` is an attribution field; keep UI entry points separate.
    if (typeof value === 'string' && values.has(value)) safe[key === 'source' ? 'entry_point' : key] = value;
  }
  if (typeof props.seconds === 'number' && Number.isFinite(props.seconds) && props.seconds >= 0)
    safe.seconds = Math.min(Math.round(props.seconds), 86400);
  if (typeof props.another === 'boolean') safe.another = props.another;
  return safe;
}

export function track(name: string, props?: Props) {
  if (typeof window === 'undefined' || !ALLOWED_EVENTS.has(name)) return;
  const client = window as AnalyticsWindow;
  const safe = analyticsProperties(props);
  // The return URL contains an order id; no analytics should run on this page.
  if (window.location.pathname === '/billing/return') return;
  client.gtag?.('event', name, safe);
  client.rybbit?.event(name, safe);
}

const PENDING_PAYMENT = 'freeaivideo:analytics:pending-payment';
const confirmedInMemory = new Set<string>();

/** Called only after the server confirms an order is paid, never from a redirect alone. */
export function recordConfirmedPayment(order: string) {
  if (typeof window === 'undefined' || !/^[a-zA-Z0-9_-]{1,128}$/.test(order)) return;
  if (confirmedInMemory.has(order)) return;
  try {
    const key = `freeaivideo:analytics:paid:${order}`;
    if (localStorage.getItem(key)) return;
    // Defer the event to the next clean URL; keep the order id in browser storage only.
    sessionStorage.setItem(PENDING_PAYMENT, '1');
    localStorage.setItem(key, '1');
    confirmedInMemory.add(order);
  } catch {
    // Analytics must never affect payment fulfillment.
  }
}

/** Browser return events can be missed; the order ledger remains authoritative. */
export function flushConfirmedPayment() {
  if (typeof window === 'undefined' || window.location.pathname === '/billing/return') return;
  if (!(window as AnalyticsWindow).gtag && !(window as AnalyticsWindow).rybbit) return;
  try {
    if (sessionStorage.getItem(PENDING_PAYMENT) !== '1') return;
    track('payment_confirmed');
    sessionStorage.removeItem(PENDING_PAYMENT);
  } catch {
    // Storage can be blocked by the browser.
  }
}
