import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bindCreditBalanceEvents,
  CreditBalanceController,
  notifyCreditsChanged,
} from '../src/lib/use-credit-balance';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}
const response = (userId: string, available: number) =>
  Response.json({ user: { id: userId }, balance: { available } });

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
afterEach(() => vi.unstubAllGlobals());

describe('credit balance state', () => {
  it('preserves a negative balance and its change after credits are added', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response('alice', -5))
      .mockResolvedValueOnce(response('alice', 95));
    const controller = new CreditBalanceController(fetcher as typeof fetch);
    const states: { userId: string | null | undefined; status: string; available: number | null }[] = [];
    controller.subscribe((value) => states.push(value));
    controller.setUser('alice');
    expect(states.at(-1)).toMatchObject({ userId: 'alice', status: 'loading', available: null });
    await tick();
    expect(states.at(-1)).toMatchObject({ userId: 'alice', status: 'ready', available: -5 });
    expect(fetcher).toHaveBeenCalledWith('/api/billing/me', expect.objectContaining({ cache: 'no-store' }));
    controller.refresh();
    await tick();
    expect(states.at(-1)).toMatchObject({ userId: 'alice', status: 'ready', available: 95 });
    controller.setUser(null);
    expect(states.at(-1)).toMatchObject({ userId: null, status: 'signed_out', available: null });
    controller.stop();
  });

  it('aborts and ignores an old account response even when the fetch ignores abort', async () => {
    const first = deferred<Response>();
    const second = deferred<Response>();
    const fetcher = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const controller = new CreditBalanceController(fetcher as typeof fetch);
    const states: { userId: string | null | undefined; status: string; available: number | null }[] = [];
    controller.subscribe((value) => states.push(value));
    controller.setUser('alice');
    const signal = (fetcher.mock.calls[0]![1] as RequestInit).signal!;
    controller.setUser('bob');
    expect(signal.aborted).toBe(true);
    expect(states.at(-1)).toMatchObject({ userId: 'bob', status: 'loading', available: null });
    second.resolve(response('bob', 25));
    await tick();
    first.resolve(response('alice', 999));
    await tick();
    expect(states.at(-1)).toMatchObject({ userId: 'bob', status: 'ready', available: 25 });
    expect(states.filter((state) => state.userId === 'bob')).not.toContainEqual(
      expect.objectContaining({ available: 999 }),
    );
    controller.stop();
  });

  it('coalesces repeated refreshes and discards a response made stale by a change event', async () => {
    const first = deferred<Response>();
    const second = deferred<Response>();
    const fetcher = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const controller = new CreditBalanceController(fetcher as typeof fetch);
    const states: { status: string; available: number | null }[] = [];
    controller.subscribe((state) => states.push(state));
    controller.setUser('alice');
    controller.refresh();
    controller.refresh();
    controller.refresh();
    expect(fetcher).toHaveBeenCalledTimes(1);
    first.resolve(response('alice', 100));
    await tick();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(states.at(-1)).toMatchObject({ status: 'loading', available: null });
    expect(states).not.toContainEqual(expect.objectContaining({ status: 'ready', available: 100 }));
    second.resolve(response('alice', 50));
    await tick();
    expect(states.at(-1)).toMatchObject({ status: 'ready', available: 50 });
    controller.stop();
  });

  it.each([
    async () => new Response(null, { status: 401 }),
    async () => {
      throw new Error('network unavailable');
    },
    async () => response('other-account', 15),
    async () => Response.json({ user: { id: 'alice' }, balance: { available: '15' } }),
  ])('reports failures as unknown rather than zero or signed out', async (fetcher) => {
    const controller = new CreditBalanceController(fetcher as typeof fetch);
    const states: { status: string; available: number | null }[] = [];
    controller.subscribe((value) => states.push(value));
    controller.setUser('alice');
    await tick();
    expect(states.at(-1)).toMatchObject({ status: 'error', available: null });
    controller.stop();
  });

  it('does not publish after teardown when a request completes late', async () => {
    const pending = deferred<Response>();
    const controller = new CreditBalanceController((() => pending.promise) as typeof fetch);
    const listener = vi.fn();
    controller.subscribe(listener);
    controller.setUser('alice');
    controller.stop();
    const count = listener.mock.calls.length;
    pending.resolve(response('alice', 10));
    await tick();
    expect(listener).toHaveBeenCalledTimes(count);
  });
});

describe('credit balance refresh events', () => {
  it('refreshes on focus, visible transition and explicit credit change, and unsubscribes', () => {
    const browser = new EventTarget();
    const page = new EventTarget() as EventTarget & { visibilityState: DocumentVisibilityState };
    page.visibilityState = 'hidden';
    const refresh = vi.fn();
    const stop = bindCreditBalanceEvents(refresh, browser as unknown as Window, page as unknown as Document);
    vi.stubGlobal('window', browser);
    browser.dispatchEvent(new Event('focus'));
    page.dispatchEvent(new Event('visibilitychange'));
    expect(refresh).toHaveBeenCalledTimes(1);
    page.visibilityState = 'visible';
    page.dispatchEvent(new Event('visibilitychange'));
    notifyCreditsChanged();
    expect(refresh).toHaveBeenCalledTimes(3);
    stop();
    browser.dispatchEvent(new Event('focus'));
    notifyCreditsChanged();
    expect(refresh).toHaveBeenCalledTimes(3);
  });
});
