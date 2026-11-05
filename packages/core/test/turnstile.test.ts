import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyTurnstile } from '../src/quota/turnstile';

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const SECRET = 'test-only-secret';
const TOKEN = 'test-only-token';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Turnstile verification', () => {
  it.each([
    { name: 'missing secret', secret: '', token: TOKEN },
    { name: 'blank secret', secret: ' \t ', token: TOKEN },
    { name: 'missing token', secret: SECRET, token: undefined },
    { name: 'null token', secret: SECRET, token: null },
    { name: 'empty token', secret: SECRET, token: '' },
    { name: 'blank token', secret: SECRET, token: ' \t ' },
    { name: 'oversized token', secret: SECRET, token: 't'.repeat(2049) },
  ])('rejects $name without contacting Siteverify', async ({ secret, token }) => {
    const fetcher = vi.fn<typeof fetch>();

    expect(await verifyTurnstile(secret, token, fetcher)).toMatchObject({ ok: false });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([TOKEN, 't'.repeat(2048)])('accepts an explicit success for a valid token', async (token) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ success: true }));

    expect(await verifyTurnstile(SECRET, token, fetcher)).toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe(SITEVERIFY);
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeInstanceOf(FormData);
    const body = init!.body as FormData;
    expect(body.get('secret')).toBe(SECRET);
    expect(body.get('response')).toBe(token);
  });

  it.each([
    { name: 'provider rejection', assessment: { success: false } },
    {
      name: 'expired or already-used token',
      assessment: { success: false, 'error-codes': ['timeout-or-duplicate'] },
    },
    { name: 'null response', assessment: null },
    { name: 'array response', assessment: [] },
    { name: 'primitive response', assessment: true },
    { name: 'missing success', assessment: {} },
    { name: 'string success', assessment: { success: 'true' } },
    { name: 'numeric success', assessment: { success: 1 } },
    { name: 'malformed error codes', assessment: { success: false, 'error-codes': [1] } },
  ])('rejects $name without retrying', async ({ assessment }) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(assessment));

    expect(await verifyTurnstile(SECRET, TOKEN, fetcher)).toMatchObject({ ok: false });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([302, 403, 503])('rejects HTTP %s even when its JSON claims success', async (status) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ success: true }, { status }));

    expect(await verifyTurnstile(SECRET, TOKEN, fetcher)).toMatchObject({ ok: false });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid JSON without retrying', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('not JSON'));

    expect(await verifyTurnstile(SECRET, TOKEN, fetcher)).toMatchObject({ ok: false });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejects a network failure without retrying', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValueOnce(new Error('mock network failure'));

    expect(await verifyTurnstile(SECRET, TOKEN, fetcher)).toMatchObject({ ok: false });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('bounds the request to ten seconds and rejects an aborted verification', async () => {
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    const fetcher = vi.fn<typeof fetch>().mockImplementationOnce(
      async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (!signal) {
            reject(new Error('Verification request must have an abort signal'));
            return;
          }
          signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        }),
    );

    const verification = verifyTurnstile(SECRET, TOKEN, fetcher);
    expect(timeout).toHaveBeenCalledWith(10_000);
    expect(fetcher.mock.calls[0]![1]?.signal).toBe(controller.signal);
    controller.abort();

    expect(await verification).toMatchObject({ ok: false });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
