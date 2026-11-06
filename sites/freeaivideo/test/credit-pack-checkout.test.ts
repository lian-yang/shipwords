import { env } from 'cloudflare:test';
import { handleCheckout, handleWebhook } from '@shipwords/core/billing/handlers';
import { StripeProvider } from '@shipwords/core/billing/stripe';
import { getBalance } from '@shipwords/core/credits/ledger';
import { createDb } from '@shipwords/core/db/client';
import { describe, expect, it, vi } from 'vitest';
import site from '../site.config';

describe('Studio credit pack checkout', () => {
  it('uses the catalog price and metadata and credits exactly once across duplicate payment events', async () => {
    const user = { id: `u_${crypto.randomUUID()}`, name: 'Test User', email: 'test@example.test' };
    const sessionId = `cs_${crypto.randomUUID()}`;
    const paymentId = `pi_${crypto.randomUUID()}`;
    let checkoutParams: Record<string, unknown> = {};
    const createSession = vi.fn(async (params: Record<string, unknown>) => {
      checkoutParams = params;
      return { id: sessionId, url: 'https://checkout.example.test/session' };
    });
    const stripe = {
      customers: { create: vi.fn(async () => ({ id: 'cus_test' })) },
      checkout: {
        sessions: {
          create: createSession,
          retrieve: vi.fn(async () => ({
            id: sessionId,
            mode: 'payment',
            payment_intent: paymentId,
            payment_status: 'paid',
            metadata: checkoutParams.metadata,
          })),
        },
      },
      webhooks: { constructEventAsync: vi.fn(async (body: string) => JSON.parse(body)) },
      paymentIntents: {
        retrieve: vi.fn(async () => ({
          id: paymentId,
          status: 'succeeded',
          amount_received: 4999,
          currency: 'usd',
          metadata: checkoutParams.metadata,
          created: Math.floor(Date.now() / 1000),
          latest_charge: { amount_refunded: 0, disputed: false, created: Math.floor(Date.now() / 1000) },
        })),
      },
    } as unknown as NonNullable<ConstructorParameters<typeof StripeProvider>[1]>;
    const provider = new StripeProvider(
      { secretKey: 'sk_test_only', webhookSecret: 'whsec_test', automaticTax: false },
      stripe,
    );
    const db = createDb(env.DB);
    const deps = {
      db,
      site,
      provider,
      baseURL: 'https://www.freeaivideo.app',
      getUser: async () => user,
      log: vi.fn(),
    };
    const checkout = await handleCheckout(
      deps,
      new Request('https://www.freeaivideo.app/api/billing/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // A client-supplied price must never override the server catalog.
        body: JSON.stringify({ productId: 'pack_1250', amount: 1, returnPath: '/#tool' }),
      }),
    );
    expect(checkout.status).toBe(200);
    const result = (await checkout.json()) as { orderId: string; url: string };
    expect(result.url).toBe('https://checkout.example.test/session');
    expect(createSession).toHaveBeenCalledOnce();
    expect(checkoutParams).toMatchObject({
      mode: 'payment',
      metadata: { site: site.id, userId: user.id, productId: 'pack_1250', orderId: result.orderId },
      payment_intent_data: { metadata: { productId: 'pack_1250', orderId: result.orderId } },
      line_items: [{ quantity: 1, price_data: { unit_amount: 4999, currency: 'usd' } }],
    });

    const event = (id: string) =>
      new Request('https://www.freeaivideo.app/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'test-signature' },
        body: JSON.stringify({ id, type: 'checkout.session.completed', data: { object: { id: sessionId } } }),
      });
    const eventId = `evt_${crypto.randomUUID()}`;
    expect((await handleWebhook(deps, event(eventId))).status).toBe(200);
    expect((await handleWebhook(deps, event(eventId))).status).toBe(200);
    expect((await handleWebhook(deps, event(`evt_${crypto.randomUUID()}`))).status).toBe(200);
    expect((await getBalance(db, user.id)).available).toBe(1250);
    const count = await env.DB.prepare('SELECT count(*) AS total FROM credit_ledger WHERE idem_key = ?')
      .bind(`pay:stripe:${paymentId}`)
      .first<{ total: number }>();
    expect(count?.total).toBe(1);
  });

  it('does not price a Studio credit below the existing 500-credit reference', () => {
    const studio = site.products.find((product) => product.id === 'pack_1250');
    const creator = site.products.find((product) => product.id === 'pack_500');
    if (studio?.kind !== 'credits' || creator?.kind !== 'credits') throw new Error('Missing credit packs');
    expect(studio.price.amount * creator.credits).toBeGreaterThanOrEqual(
      creator.price.amount * studio.credits,
    );
  });
});
