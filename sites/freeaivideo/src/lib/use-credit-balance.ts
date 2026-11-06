import { useCallback, useEffect, useRef, useState } from 'react';

const CREDITS_CHANGED = 'site:credits-changed';
export type CreditBalanceStatus = 'signed_out' | 'loading' | 'ready' | 'error';
type UserId = string | null | undefined;

interface Snapshot {
  userId: UserId;
  status: CreditBalanceStatus;
  available: number | null;
}

type Fetcher = typeof fetch;

/** Broadcast after a credit-changing operation; each mounted view refreshes its own balance. */
export function notifyCreditsChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CREDITS_CHANGED));
}

/** Attach only while mounted. A hidden tab refreshes once it becomes visible. */
export function bindCreditBalanceEvents(
  refresh: () => void,
  target: Pick<Window, 'addEventListener' | 'removeEventListener'>,
  page: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>,
): () => void {
  const visible = () => {
    if (page.visibilityState === 'visible') refresh();
  };
  target.addEventListener('focus', refresh);
  target.addEventListener(CREDITS_CHANGED, refresh);
  page.addEventListener('visibilitychange', visible);
  return () => {
    target.removeEventListener('focus', refresh);
    target.removeEventListener(CREDITS_CHANGED, refresh);
    page.removeEventListener('visibilitychange', visible);
  };
}

/** Isolated state machine, also used to verify async account switches without a browser. */
export class CreditBalanceController {
  private userId: UserId = undefined;
  private snapshot: Snapshot = { userId: undefined, status: 'loading', available: null };
  private readonly listeners = new Set<(state: Snapshot) => void>();
  private request: AbortController | null = null;
  private queued = false;
  private sequence = 0;

  constructor(private readonly fetcher: Fetcher = fetch) {}

  subscribe(listener: (state: Snapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  private publish(status: CreditBalanceStatus, available: number | null = null): void {
    this.snapshot = { userId: this.userId, status, available };
    for (const listener of this.listeners) listener(this.snapshot);
  }

  setUser(userId: UserId): void {
    if (this.userId === userId) return;
    this.sequence++;
    this.request?.abort();
    this.request = null;
    this.queued = false;
    this.userId = userId;
    this.publish(userId === null ? 'signed_out' : 'loading');
    if (userId) this.refresh();
  }

  refresh(): void {
    const userId = this.userId;
    if (!userId) return;
    // Coalesce bursts into at most one follow-up, never concurrent reads for one user.
    if (this.request) {
      this.queued = true;
      return;
    }
    const request = new AbortController();
    const sequence = ++this.sequence;
    this.request = request;
    this.publish('loading');
    void (async () => {
      try {
        const response = await this.fetcher('/api/billing/me', { cache: 'no-store', signal: request.signal });
        if (!response.ok) throw new Error('balance_unavailable');
        const data = (await response.json()) as {
          user?: { id?: unknown };
          balance?: { available?: unknown };
        };
        const available = data?.balance?.available;
        if (data?.user?.id !== userId || typeof available !== 'number' || !Number.isSafeInteger(available))
          throw new Error('balance_invalid');
        if (sequence === this.sequence && !this.queued) this.publish('ready', available);
      } catch {
        if (sequence === this.sequence && !this.queued) this.publish('error');
      } finally {
        if (sequence === this.sequence) {
          this.request = null;
          if (this.queued) {
            this.queued = false;
            this.refresh();
          }
        }
      }
    })();
  }

  stop(): void {
    this.sequence++;
    this.request?.abort();
    this.request = null;
    this.queued = false;
    this.userId = undefined;
    this.snapshot = { userId: undefined, status: 'loading', available: null };
  }
}

/** Read-only balance; authorization and the final debit remain server-side. */
export function useCreditBalance(userId: UserId): {
  status: CreditBalanceStatus;
  available: number | null;
  refresh: () => void;
} {
  const controller = useRef<CreditBalanceController | null>(null);
  controller.current ??= new CreditBalanceController();
  const store = controller.current;
  const [snapshot, setSnapshot] = useState<Snapshot>({
    userId: undefined,
    status: 'loading',
    available: null,
  });
  const refresh = useCallback(() => store.refresh(), [store]);

  useEffect(() => {
    const unsubscribe = store.subscribe(setSnapshot);
    return () => {
      unsubscribe();
      store.stop();
    };
  }, [store]);
  useEffect(() => {
    store.setUser(userId);
  }, [store, userId]);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    return bindCreditBalanceEvents(refresh, window, document);
  }, [refresh]);

  // Effects run after render: never expose the previous account during an identity change.
  if (snapshot.userId !== userId)
    return { status: userId === null ? 'signed_out' : 'loading', available: null, refresh };
  return { status: snapshot.status, available: snapshot.available, refresh };
}
