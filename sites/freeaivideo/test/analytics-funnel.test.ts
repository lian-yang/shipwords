import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyticsProperties, flushConfirmedPayment, recordConfirmedPayment, track } from '../src/lib/track';

function storage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('funnel analytics privacy and payment confirmation', () => {
  it('only allows known dimensions and fixed values', () => {
    expect(
      analyticsProperties({
        mode: 'daily-trial',
        source: 'nav',
        error: 'private@example.com',
        reason: 'a user supplied prompt',
        product: 'pack_100',
      }),
    ).toEqual({ site_key: 'freeaivideo', mode: 'daily-trial', entry_point: 'nav', product: 'pack_100' });
  });

  it('queues only a confirmed payment, on a clean page, once per browser order', () => {
    const gtag = vi.fn();
    const currentWindow = { location: { pathname: '/billing/return' }, gtag };
    vi.stubGlobal('window', currentWindow);
    vi.stubGlobal('localStorage', storage());
    vi.stubGlobal('sessionStorage', storage());
    track('payment_confirmed');
    recordConfirmedPayment('order_analytics_test_1');
    flushConfirmedPayment();
    expect(gtag).not.toHaveBeenCalled();

    currentWindow.location.pathname = '/';
    flushConfirmedPayment();
    recordConfirmedPayment('order_analytics_test_1');
    flushConfirmedPayment();
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag).toHaveBeenCalledWith('event', 'payment_confirmed', { site_key: 'freeaivideo' });
  });
});
