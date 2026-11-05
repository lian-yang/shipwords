// Cloudflare Turnstile server-side verification (siteverify). An alternative to reCAPTCHA Enterprise
// for the guest free try; sites enable it by setting TURNSTILE_SECRET_KEY (+ TURNSTILE_SITE_KEY for the widget).

export interface TurnstileResult {
  ok: boolean;
  reason?: string;
}

export async function verifyTurnstile(
  secretKey: string,
  token: string | null | undefined,
  fetcher: typeof fetch = fetch,
): Promise<TurnstileResult> {
  if (!secretKey.trim()) return { ok: false, reason: 'missing_secret' };
  if (!token?.trim()) return { ok: false, reason: 'missing_token' };
  if (token.length > 2048) return { ok: false, reason: 'invalid_token' };
  const body = new FormData();
  body.set('secret', secretKey);
  body.set('response', token);
  try {
    const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return { ok: false, reason: 'verify_unreachable' };
    const assessment = (await response.json()) as {
      success?: unknown;
      'error-codes'?: unknown;
    } | null;
    if (assessment?.success === true) return { ok: true };
    const codes = assessment?.['error-codes'];
    return {
      ok: false,
      reason:
        Array.isArray(codes) && codes.every((code) => typeof code === 'string')
          ? codes.join(',') || 'verify_failed'
          : 'verify_failed',
    };
  } catch {
    // Network errors fail closed: a guest that can't be verified doesn't get a free try.
    return { ok: false, reason: 'verify_unreachable' };
  }
}
