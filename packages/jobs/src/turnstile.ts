// Cloudflare Turnstile client side: load the widget script once, render a fresh widget per submit,
// and resolve with the token. `appearance: 'interaction-only'` keeps the widget invisible unless a
// challenge actually needs input.

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
export const TURNSTILE_CONTAINER_ID = 'turnstile-slot';

let loading: Promise<void> | null = null;

function loadScript(): Promise<void> {
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    let settled = false;
    const fail = (reason: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      script.onload = null;
      script.onerror = null;
      script.remove();
      reject(new Error(reason));
    };
    const timer = setTimeout(() => fail('turnstile_script_timeout'), 15_000);
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      script.onload = null;
      script.onerror = null;
      resolve();
    };
    script.onerror = () => fail('turnstile_script_failed');
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    loading = null;
    throw error;
  });
  return loading;
}

interface TurnstileApi {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
}

function api(): TurnstileApi {
  return (window as unknown as { turnstile: TurnstileApi }).turnstile;
}

export async function getTurnstileToken(siteKey: string): Promise<string> {
  await loadScript();
  const container = document.getElementById(TURNSTILE_CONTAINER_ID);
  if (!container) throw new Error('turnstile_container_missing');
  container.textContent = '';
  return new Promise((resolve, reject) => {
    let widgetId: string | undefined;
    let settled = false;
    const remove = () => {
      if (widgetId === undefined) return;
      try {
        api().remove(widgetId);
      } catch {
        // A detached widget must not hide the verification result.
      }
      widgetId = undefined;
    };
    const finish = (token: string | null, error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      remove();
      if (error) reject(error);
      else if (token) resolve(token);
      else reject(new Error('turnstile_failed'));
    };
    const timer = setTimeout(() => finish(null, new Error('turnstile_timeout')), 45_000);
    try {
      widgetId = api().render(container, {
        sitekey: siteKey,
        appearance: 'interaction-only',
        theme: 'dark',
        callback: (token: string) => {
          finish(token);
        },
        'error-callback': () => {
          finish(null, new Error('turnstile_failed'));
        },
        'expired-callback': () => {
          finish(null, new Error('turnstile_expired'));
        },
      });
      // Also clean up if a callback fires synchronously inside render.
      if (settled) remove();
    } catch (e) {
      finish(null, e instanceof Error ? e : new Error('turnstile_render_failed'));
    }
  });
}
