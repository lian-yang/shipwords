import { env } from 'cloudflare:test';
import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import type {
  CheckoutFact,
  CheckoutRequest,
  PaymentFact,
  PaymentProvider,
  SubscriptionFact,
  WebhookTrigger,
} from '../src/billing/provider';
import { WebhookSignatureError } from '../src/billing/provider';
import { remindPendingOrders } from '../src/billing/recovery';
import { getBalance } from '../src/credits/ledger';
import { createDb } from '../src/db/client';
import { orders, user } from '../src/db/schema';
import { defineSite } from '../src/site';

const db = createDb(env.DB);
const HOUR = 3_600_000;

const site = defineSite({
  id: 'test',
  name: 'Test',
  url: 'https://test.example',
  locales: ['en'],
  defaultLocale: 'en',
  products: [
    {
      id: 'pack_100',
      kind: 'credits',
      name: '100 credits',
      price: { amount: 1000, currency: 'usd' },
      credits: 100,
      expiresDays: null,
    },
  ],
  signup: { bonusCredits: 0, bonusExpiresDays: null, bonusPerIpDaily: 3, bonusSiteDaily: 100 },
  guest: { dailyPerDevice: 1, dailyPerIp: 3, dailySiteBudget: 100, minRecaptchaScore: 0.5 },
  billing: { provider: 'stripe', automaticTax: false },
});

/** The provider only needs fetchCheckout for recovery; every other method is unreachable. */
class FakeProvider implements PaymentProvider {
  readonly name = 'fake';
  checkouts = new Map<string, CheckoutFact>();

  async createCustomer() {
    return 'cus';
  }
  async createCheckout(request: CheckoutRequest) {
    return { url: `https://pay.example/${request.orderId}`, checkoutRef: `cs_${request.orderId}` };
  }
  async parseWebhook(): Promise<WebhookTrigger> {
    throw new WebhookSignatureError();
  }
  async fetchCheckout(ref: string) {
    return this.checkouts.get(ref) ?? { orderId: null, payment: null, subscription: null };
  }
  async fetchPayment() {
    return null;
  }
  async fetchPaymentByCharge() {
    return null;
  }
  async fetchSubscription(): Promise<SubscriptionFact | null> {
    return null;
  }
  async portalUrl() {
    return 'https://pay.example/portal';
  }
}

let provider: FakeProvider;
let sent: { to: string; subject: string; text: string; html: string }[];
let failFor: Set<string>;
const logs: string[] = [];

beforeEach(() => {
  provider = new FakeProvider();
  sent = [];
  failFor = new Set();
});

function deps(mailerFailFor = failFor) {
  return {
    db,
    site,
    provider,
    baseURL: 'https://test.example',
    log: (message: string) => logs.push(message),
    mailer: {
      async send(message: { to: string; subject: string; text: string; html: string }) {
        if (mailerFailFor.has(message.to)) throw new Error('mail down');
        sent.push(message);
      },
    },
  };
}

const uid = () => `u_${crypto.randomUUID().slice(0, 12)}`;

/** A user with a pending pack order created ageMs ago. */
async function seedOrder(
  ageMs: number,
  overrides: { productId?: string; status?: 'pending' | 'paid' | 'expired' } = {},
) {
  const id = uid();
  await db.insert(user).values({ id, name: 'T', email: `${id}@example.com` });
  const orderId = `ord_${id.slice(2)}`;
  await db.insert(orders).values({
    id: orderId,
    userId: id,
    productId: overrides.productId ?? 'pack_100',
    provider: 'fake',
    amount: 1000,
    currency: 'usd',
    status: overrides.status ?? 'pending',
    checkoutRef: `cs_${orderId}`,
    createdAt: Date.now() - ageMs,
  });
  return { userId: id, orderId, email: `${id}@example.com`, checkoutRef: `cs_${orderId}` };
}

function openSession(orderId: string, overrides: Partial<CheckoutFact> = {}): CheckoutFact {
  return {
    orderId,
    payment: null,
    subscription: null,
    url: `https://pay.example/${orderId}`,
    expiresAt: Date.now() + 12 * HOUR,
    ...overrides,
  };
}

function paidPayment(userId: string, orderId: string): PaymentFact {
  return {
    provider: 'fake',
    paymentRef: `pi_${orderId}`,
    chargeRef: `ch_${orderId}`,
    paid: true,
    amount: 1000,
    currency: 'usd',
    amountRefunded: 0,
    dispute: null,
    metadataTrusted: true,
    userId,
    productId: 'pack_100',
    orderId,
    subscriptionRef: null,
    periodStart: null,
    periodEnd: null,
    paidAt: Date.now(),
    fetchedAt: Date.now(),
  };
}

describe('abandoned-checkout reminders', () => {
  it('sends exactly one reminder with the deep link, product and price; repeat runs send nothing', async () => {
    const { orderId, checkoutRef, email } = await seedOrder(2 * HOUR);
    provider.checkouts.set(checkoutRef, openSession(orderId));

    expect(await remindPendingOrders(deps())).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe(email);
    expect(sent[0]!.subject).toContain('still open');
    expect(sent[0]!.text).toContain(`https://pay.example/${orderId}`);
    expect(sent[0]!.text).toContain('100 credits ($10.00)');

    expect(await remindPendingOrders(deps())).toBe(0);
    expect(sent).toHaveLength(1);
    const row = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
    expect(row?.reminderSentAt).toBeTypeOf('number');
  });

  it('ignores orders younger than 1 h or older than 48 h', async () => {
    const fresh = await seedOrder(30 * 60_000);
    const stale = await seedOrder(49 * HOUR);
    provider.checkouts.set(fresh.checkoutRef, openSession(fresh.orderId));
    provider.checkouts.set(stale.checkoutRef, openSession(stale.orderId));

    expect(await remindPendingOrders(deps())).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it('a payment completed after the client left is applied through reconcile, with no reminder', async () => {
    const { userId, orderId, checkoutRef } = await seedOrder(2 * HOUR);
    provider.checkouts.set(checkoutRef, openSession(orderId, { payment: paidPayment(userId, orderId) }));

    expect(await remindPendingOrders(deps())).toBe(0);
    expect(sent).toHaveLength(0);
    expect((await db.query.orders.findFirst({ where: eq(orders.id, orderId) }))?.status).toBe('paid');
    expect((await getBalance(db, userId)).available).toBe(100);
  });

  it('an expired session is marked handled so the cron stops re-fetching it', async () => {
    const { orderId, checkoutRef } = await seedOrder(2 * HOUR);
    provider.checkouts.set(checkoutRef, openSession(orderId, { expiresAt: Date.now() - HOUR }));

    expect(await remindPendingOrders(deps())).toBe(0);
    expect(sent).toHaveLength(0);
    const row = await db.query.orders.findFirst({ where: eq(orders.id, orderId) });
    expect(row?.reminderSentAt).toBeTypeOf('number');
  });

  it('concurrent runs agree on exactly one email', async () => {
    const { orderId, checkoutRef } = await seedOrder(2 * HOUR);
    provider.checkouts.set(checkoutRef, openSession(orderId));
    const results = await Promise.all([remindPendingOrders(deps()), remindPendingOrders(deps())]);
    expect(results.reduce((a, b) => a + b, 0)).toBe(1);
    expect(sent).toHaveLength(1);
  });

  it('a user with several abandoned checkouts is reminded once, about the newest only', async () => {
    const userId = uid();
    await db.insert(user).values({ id: userId, name: 'T', email: `${userId}@example.com` });
    const order = (suffix: string, ageMs: number) => {
      const orderId = `ord_${userId.slice(2)}_${suffix}`;
      return db
        .insert(orders)
        .values({
          id: orderId,
          userId,
          productId: 'pack_100',
          provider: 'fake',
          amount: 1000,
          currency: 'usd',
          status: 'pending',
          checkoutRef: `cs_${orderId}`,
          createdAt: Date.now() - ageMs,
        })
        .then(() => orderId);
    };
    const older = await order('older', 3 * HOUR);
    const newer = await order('newer', 2 * HOUR);
    provider.checkouts.set(`cs_${older}`, openSession(older));
    provider.checkouts.set(`cs_${newer}`, openSession(newer));

    expect(await remindPendingOrders(deps())).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.text).toContain(`https://pay.example/${newer}`);
    // The older duplicate is not reminded on a later run either.
    expect(await remindPendingOrders(deps())).toBe(0);
    expect(sent).toHaveLength(1);
  });

  it('a mail failure is logged and never retried, and does not block the rest of the batch', async () => {
    const broken = await seedOrder(3 * HOUR);
    const fine = await seedOrder(2 * HOUR);
    failFor.add(broken.email);
    provider.checkouts.set(broken.checkoutRef, openSession(broken.orderId));
    provider.checkouts.set(fine.checkoutRef, openSession(fine.orderId));

    expect(await remindPendingOrders(deps())).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe(fine.email);
    const row = await db.query.orders.findFirst({ where: eq(orders.id, broken.orderId) });
    expect(row?.reminderSentAt).toBeTypeOf('number'); // claimed once, never re-sent
  });

  it('links to the pricing page when the provider exposes no checkout url', async () => {
    const { orderId, checkoutRef } = await seedOrder(2 * HOUR);
    provider.checkouts.set(checkoutRef, openSession(orderId, { url: null }));

    expect(await remindPendingOrders(deps())).toBe(1);
    expect(sent[0]!.text).toContain('https://test.example/pricing');
  });

  it('skips orders for products no longer in the catalog', async () => {
    const { checkoutRef, orderId } = await seedOrder(2 * HOUR, { productId: 'gone' });
    provider.checkouts.set(checkoutRef, openSession(orderId));

    expect(await remindPendingOrders(deps())).toBe(0);
    expect(sent).toHaveLength(0);
  });
});
