import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SubmitInput } from '../src/upstream';
import { UpstreamError } from '../src/upstream';
import { buildZhipuVideoRequest, ZhipuAdapter } from '../src/zhipu';

const base: SubmitInput = {
  upstreamModel: 'cogvideox-flash',
  kind: 'video',
  prompt: 'A quiet sea',
  references: [],
  parameters: { aspect_ratio: '16:9' },
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('buildZhipuVideoRequest', () => {
  it('builds a text-to-video body with the aspect size and the idempotency key', () => {
    expect(buildZhipuVideoRequest(base, 'job-key-1')).toEqual({
      model: 'cogvideox-flash',
      prompt: 'A quiet sea',
      size: '1920x1080',
      request_id: 'job-key-1',
    });
  });

  it.each([
    ['9:16', '1080x1920'],
    ['1:1', '1024x1024'],
    ['4:3', '1280x960'],
    ['3:4', '960x1280'],
  ])('maps %s to %s', (aspect, size) => {
    expect(buildZhipuVideoRequest({ ...base, parameters: { aspect_ratio: aspect } }, 'k')).toMatchObject({ size });
  });

  it('omits the size when no aspect ratio is set and sends one reference image', () => {
    const input = {
      ...base,
      parameters: {},
      references: [{ role: 'first_frame', url: 'https://example.test/frame.png' }],
    };
    expect(buildZhipuVideoRequest(input, 'k')).toEqual({
      model: 'cogvideox-flash',
      prompt: 'A quiet sea',
      image_url: 'https://example.test/frame.png',
      request_id: 'k',
    });
  });

  it('rejects non-video kinds, more than one reference, and unknown aspect ratios before any network call', () => {
    expect(() => buildZhipuVideoRequest({ ...base, kind: 'image' }, 'k')).toThrow(UpstreamError);
    expect(() =>
      buildZhipuVideoRequest(
        {
          ...base,
          references: [
            { role: 'first_frame', url: 'https://example.test/a.png' },
            { role: 'first_frame', url: 'https://example.test/b.png' },
          ],
        },
        'k',
      ),
    ).toThrow(UpstreamError);
    expect(() => buildZhipuVideoRequest({ ...base, parameters: { aspect_ratio: '21:9' } }, 'k')).toThrow(
      UpstreamError,
    );
  });
});

describe('ZhipuAdapter', () => {
  const jsonResponse = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  it('prepares without network access and requires a key', () => {
    const fetch = vi.fn(() => {
      throw new Error('network must not be used');
    });
    vi.stubGlobal('fetch', fetch);
    expect(() => new ZhipuAdapter({ apiKey: 'test-only' }).prepare(base)).not.toThrow();
    expect(fetch).not.toHaveBeenCalled();
    expect(() => new ZhipuAdapter({ apiKey: '' }).prepare(base)).toThrow(/ZHIPU_API_KEY/);
  });

  it('submits and returns the task id', async () => {
    const fetch = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).toBe('https://open.bigmodel.cn/api/paas/v4/videos/generations');
      return jsonResponse(200, { model: 'cogvideox-flash', id: 'task_1', request_id: 'job-key-1', task_status: 'PROCESSING' });
    });
    vi.stubGlobal('fetch', fetch);
    expect(await new ZhipuAdapter({ apiKey: 'test-only' }).submit(base, 'job-key-1')).toEqual({
      upstreamJobId: 'task_1',
    });
    const [, init] = fetch.mock.calls[0]! as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toMatchObject({ request_id: 'job-key-1' });
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer test-only');
  });

  it.each([
    ['PROCESSING', { state: 'running' }],
    ['SUCCESS', { state: 'succeeded', files: [{ url: 'https://cdn.test/v.mp4', mediaType: 'video/mp4' }] }],
    ['FAIL', { state: 'failed', code: 'upstream_failed', message: 'zhipu reported task FAIL' }],
  ])('polls a %s task', async (status, expected) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(200, {
          task_status: status,
          ...(status === 'SUCCESS' ? { video_result: [{ url: 'https://cdn.test/v.mp4' }] } : {}),
        }),
      ),
    );
    expect(await new ZhipuAdapter({ apiKey: 'k' }).poll('task_1')).toEqual(expected);
  });

  it('fails a success without a video url', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(200, { task_status: 'SUCCESS', video_result: [] })));
    const result = await new ZhipuAdapter({ apiKey: 'k' }).poll('task_1');
    expect(result).toMatchObject({ state: 'failed', code: 'result_missing' });
  });

  it('maps platform errors: 429 and 5xx retryable, 400-series rejected', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(429, { error: { code: '1302', message: '并发上限' } })));
    await expect(new ZhipuAdapter({ apiKey: 'k' }).submit(base, 'k')).rejects.toMatchObject({
      code: '1302',
      retryable: true,
    });
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(500, {})));
    await expect(new ZhipuAdapter({ apiKey: 'k' }).poll('task_1')).rejects.toMatchObject({ retryable: true });
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(400, { error: { code: '1113', message: 'bad prompt' } })));
    await expect(new ZhipuAdapter({ apiKey: 'k' }).submit(base, 'k')).rejects.toMatchObject({
      code: '1113',
      retryable: false,
      definitelyNotSubmitted: true,
    });
  });

  it('settles at zero without asking the upstream, and cancels as a no-op', async () => {
    const fetch = vi.fn(() => {
      throw new Error('network must not be used');
    });
    vi.stubGlobal('fetch', fetch);
    const adapter = new ZhipuAdapter({ apiKey: 'k' });
    expect(await adapter.cost('task_1')).toEqual({ usd: '0', settled: true });
    await expect(adapter.cancel('task_1')).resolves.toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });
});
