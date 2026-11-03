import { useCallback, useEffect, useRef, useState } from 'react';
import { m } from '~/paraglide/messages.js';
import type { TrialStatus } from '~/trial-types';

const CHANGED = 'site:trials-changed';

export function notifyTrialsChanged() {
  window.dispatchEvent(new Event(CHANGED));
}

/** Status belongs to a session identity; late responses never carry a previous account's voucher into the next one. */
export function useTrials(userId: string | null | undefined, pending = false) {
  const identity = pending ? 'pending' : (userId ?? 'guest');
  const currentIdentity = useRef(identity);
  currentIdentity.current = identity;
  const sequence = useRef(0);
  const [state, setState] = useState<{
    identity: string;
    data: TrialStatus | null;
    loading: boolean;
    failed: boolean;
  }>({ identity, data: null, loading: true, failed: false });

  const refresh = useCallback(async () => {
    if (pending) return;
    const request = ++sequence.current;
    const owner = identity;
    setState((before) => ({
      identity: owner,
      data: before.identity === owner ? before.data : null,
      loading: true,
      failed: false,
    }));
    try {
      // Claiming is idempotent. Verified new accounts receive a voucher when a daily allocation is available.
      const response = await fetch('/api/trials', {
        method: userId ? 'POST' : 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
        ...(userId ? { headers: { 'content-type': 'application/json' }, body: '{}' } : {}),
      });
      if (!response.ok) throw new Error('trial status unavailable');
      const data = (await response.json()) as TrialStatus;
      if (sequence.current === request && currentIdentity.current === owner)
        setState({ identity: owner, data, loading: false, failed: false });
    } catch {
      if (sequence.current === request && currentIdentity.current === owner)
        setState({ identity: owner, data: null, loading: false, failed: true });
    }
  }, [identity, pending, userId]);

  useEffect(() => {
    void refresh();
    const update = () => void refresh();
    window.addEventListener('focus', update);
    window.addEventListener(CHANGED, update);
    return () => {
      sequence.current++;
      window.removeEventListener('focus', update);
      window.removeEventListener(CHANGED, update);
    };
  }, [refresh]);

  const data = state.identity === identity ? state.data : null;
  useEffect(() => {
    if (!data?.signup.expiresAt || data.signup.status !== 'available') return;
    const remaining = data.signup.expiresAt - Date.now();
    const timer = window.setTimeout(() => void refresh(), Math.max(0, Math.min(remaining, 86_400_000)));
    return () => window.clearTimeout(timer);
  }, [data?.signup.expiresAt, data?.signup.status, refresh]);

  return {
    data,
    loading: pending || state.identity !== identity || state.loading,
    failed: state.identity === identity && state.failed,
    refresh,
  };
}

export function signupTrialDescription(status: TrialStatus['signup']['status'] | undefined) {
  switch (status) {
    case 'available':
      return m.common_trial_available();
    case 'claimable':
      return m.common_trial_claimable();
    case 'used':
      return m.common_trial_used();
    case 'expired':
      return m.common_trial_expired();
    case 'daily_limit':
      return m.common_trial_daily_limit();
    case 'unverified':
      return m.common_trial_unverified();
    case 'signed_out':
      return m.common_trial_sign_in();
    case 'ineligible':
      return m.common_trial_ineligible();
    default:
      return m.common_trial_loading();
  }
}
