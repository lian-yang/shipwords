import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface ScriptStub {
  src: string;
  async: boolean;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  remove: ReturnType<typeof vi.fn>;
}

interface WidgetOptions {
  sitekey: string;
  callback: (token: string) => void;
  'error-callback': () => void;
  'expired-callback': () => void;
}

interface RenderedWidget {
  id: string;
  options: WidgetOptions;
}

// No DOM implementation or external script runs: tests drive the script events
// and widget callbacks directly, and a fetch attempt fails the test.
function stubBrowser() {
  const scripts: ScriptStub[] = [];
  const widgets: RenderedWidget[] = [];
  const container = { innerHTML: '' };
  const turnstile = {
    render: vi.fn((_element: unknown, options: WidgetOptions) => {
      const id = `widget-${widgets.length + 1}`;
      widgets.push({ id, options });
      return id;
    }),
    remove: vi.fn(),
  };
  vi.stubGlobal('window', { turnstile });
  vi.stubGlobal('document', {
    createElement: vi.fn((tag: string) => {
      expect(tag).toBe('script');
      return { src: '', async: false, onload: null, onerror: null, remove: vi.fn() };
    }),
    head: {
      appendChild: vi.fn((script: ScriptStub) => {
        scripts.push(script);
        return script;
      }),
    },
    getElementById: vi.fn((id: string) => (id === 'turnstile-slot' ? container : null)),
  });
  const fetchSpy = vi.fn(() => {
    throw new Error('Test must not access an external service');
  });
  vi.stubGlobal('fetch', fetchSpy);
  return { scripts, widgets, turnstile, fetchSpy };
}

// Attach rejection handlers immediately so fake-timer expiry cannot create an
// unhandled rejection before the assertion gets control again.
function settled<T>(promise: Promise<T>) {
  return promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
}

describe('Turnstile client lifecycle', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('loads one script but obtains a fresh token and removes each widget on successive submissions', async () => {
    const browser = stubBrowser();
    const { getTurnstileToken } = await import('../src/turnstile');
    const first = getTurnstileToken('public-site-key');
    expect(browser.scripts).toHaveLength(1);
    expect(browser.scripts[0]!.src).toBe(
      'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
    );
    browser.scripts[0]!.onload!();
    await vi.advanceTimersByTimeAsync(0);
    expect(browser.widgets[0]!.options.sitekey).toBe('public-site-key');
    browser.widgets[0]!.options.callback('token-first');
    await expect(first).resolves.toBe('token-first');
    expect(browser.turnstile.remove).toHaveBeenCalledWith('widget-1');

    const second = getTurnstileToken('public-site-key');
    await vi.advanceTimersByTimeAsync(0);
    expect(browser.scripts).toHaveLength(1);
    expect(browser.widgets).toHaveLength(2);
    browser.widgets[1]!.options.callback('token-second');
    await expect(second).resolves.toBe('token-second');
    expect(browser.turnstile.remove.mock.calls).toEqual([['widget-1'], ['widget-2']]);
    expect(browser.fetchSpy).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('removes a failed script and allows a later attempt to load and succeed', async () => {
    const browser = stubBrowser();
    const { getTurnstileToken } = await import('../src/turnstile');
    const failed = settled(getTurnstileToken('public-site-key'));
    browser.scripts[0]!.onerror!();
    expect(await failed).toMatchObject({ ok: false, error: expect.any(Error) });
    expect(browser.scripts[0]!.remove).toHaveBeenCalledTimes(1);
    expect(browser.widgets).toHaveLength(0);

    const retry = getTurnstileToken('public-site-key');
    expect(browser.scripts).toHaveLength(2);
    browser.scripts[1]!.onload!();
    await vi.advanceTimersByTimeAsync(0);
    browser.widgets[0]!.options.callback('fresh-token');
    await expect(retry).resolves.toBe('fresh-token');
    expect(browser.fetchSpy).not.toHaveBeenCalled();
  });

  it('bounds a stalled script load to 15 seconds and ignores its late load event during retry', async () => {
    const browser = stubBrowser();
    const { getTurnstileToken } = await import('../src/turnstile');
    const failed = settled(getTurnstileToken('public-site-key'));
    const lateLoad = browser.scripts[0]!.onload!;
    await vi.advanceTimersByTimeAsync(15_000);
    expect(await failed).toMatchObject({ ok: false, error: expect.any(Error) });
    expect(browser.scripts[0]!.remove).toHaveBeenCalledTimes(1);
    expect(browser.widgets).toHaveLength(0);

    const retry = getTurnstileToken('public-site-key');
    expect(browser.scripts).toHaveLength(2);
    lateLoad();
    await vi.advanceTimersByTimeAsync(0);
    expect(browser.widgets).toHaveLength(0);
    browser.scripts[1]!.onload!();
    await vi.advanceTimersByTimeAsync(0);
    browser.widgets[0]!.options.callback('retry-token');
    await expect(retry).resolves.toBe('retry-token');
    expect(browser.fetchSpy).not.toHaveBeenCalled();
  });

  it.each(['error-callback', 'expired-callback'] as const)(
    'removes a widget after %s and ignores its late success callback',
    async (event) => {
      const browser = stubBrowser();
      const { getTurnstileToken } = await import('../src/turnstile');
      const failed = settled(getTurnstileToken('public-site-key'));
      browser.scripts[0]!.onload!();
      await vi.advanceTimersByTimeAsync(0);
      const widget = browser.widgets[0]!;
      widget.options[event]();
      expect(await failed).toMatchObject({ ok: false, error: expect.any(Error) });
      expect(browser.turnstile.remove.mock.calls).toEqual([['widget-1']]);

      const retry = getTurnstileToken('public-site-key');
      await vi.advanceTimersByTimeAsync(0);
      widget.options.callback('stale-token');
      widget.options[event]();
      browser.widgets[1]!.options.callback('retry-token');
      await expect(retry).resolves.toBe('retry-token');
      expect(browser.turnstile.remove.mock.calls).toEqual([['widget-1'], ['widget-2']]);
      expect(browser.fetchSpy).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it('removes a widget at 45 seconds and can start a fresh challenge afterward', async () => {
    const browser = stubBrowser();
    const { getTurnstileToken } = await import('../src/turnstile');
    const failed = settled(getTurnstileToken('public-site-key'));
    browser.scripts[0]!.onload!();
    await vi.advanceTimersByTimeAsync(0);
    const oldWidget = browser.widgets[0]!;
    await vi.advanceTimersByTimeAsync(45_000);
    expect(await failed).toMatchObject({ ok: false, error: expect.any(Error) });
    expect(browser.turnstile.remove.mock.calls).toEqual([['widget-1']]);

    const retry = getTurnstileToken('public-site-key');
    await vi.advanceTimersByTimeAsync(0);
    oldWidget.options.callback('late-token');
    browser.widgets[1]!.options.callback('new-token');
    await expect(retry).resolves.toBe('new-token');
    expect(browser.scripts).toHaveLength(1);
    expect(browser.turnstile.remove.mock.calls).toEqual([['widget-1'], ['widget-2']]);
    expect(browser.fetchSpy).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
