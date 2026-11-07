import { describe, expect, it, vi } from 'vitest';
import { creditsFor } from '@shipwords/jobs/models';
import { YirAdapter } from '@shipwords/jobs/yir';
import catalog from '../site.models';
import { paidParameters } from '../src/create-job.server';
import { DEFAULT_TRIAL_MODEL_ID, restoredModelId, VIDEO_OPTIONS } from '../src/video-options';
import { paidMaxCost, trialMaxCost, VIDEO_UPSTREAMS } from '../src/video-pricing.server';

describe('published video specifications', () => {
  it('restores free drafts to an eligible model but preserves paid and eligible free selections', () => {
    expect(restoredModelId('seedance-2-5-v2', 'daily-trial', catalog)).toBe(DEFAULT_TRIAL_MODEL_ID);
    expect(restoredModelId('seedance-2-5-v2', 'signup-trial', catalog)).toBe(DEFAULT_TRIAL_MODEL_ID);
    expect(restoredModelId('seedance-2-5-v2', undefined, catalog)).toBe(DEFAULT_TRIAL_MODEL_ID);
    expect(restoredModelId('seedance-2-5-v2', 'paid', catalog)).toBe('seedance-2-5-v2');
    expect(restoredModelId('seedance-2-5-v2', 'paid', catalog, true)).toBe(DEFAULT_TRIAL_MODEL_ID);
    expect(restoredModelId('kling-2-6-v2', 'daily-trial', catalog)).toBe('kling-2-6-v2');
    expect(restoredModelId('kling-2-6-v2', 'paid', catalog, true)).toBe('kling-2-6-v2');
    expect(restoredModelId('not-a-model', 'paid', catalog)).toBe(DEFAULT_TRIAL_MODEL_ID);
  });
  it('rejects unsupported Wan 2.7 text aspect ratios', () => {
    expect(VIDEO_OPTIONS['wan-2-7-v2']!.aspectRatios).toEqual(['16:9', '9:16', '1:1', '4:3', '3:4']);
    expect(paidParameters('wan-2-7-v2', { resolution: '720p', duration: 5, aspect_ratio: '21:9' })).toBe(false);
    expect(paidParameters('wan-2-7-v2', { resolution: '720p', duration: 5, aspect_ratio: '16:9' })).toBe(true);
  });
  it.each(['kling-4-0-v2', 'kling-4-0-flash-v2'])('%s rejects unsupported text aspect ratios', (id) => {
    expect(VIDEO_OPTIONS[id]!.aspectRatios).toEqual(['16:9', '9:16', '1:1', '21:9']);
    for (const aspect_ratio of ['4:3', '3:4']) {
      expect(paidParameters(id, { resolution: '720p', duration: 5, aspect_ratio })).toBe(false);
    }
    expect(paidParameters(id, { resolution: '720p', duration: 5, aspect_ratio: '21:9' })).toBe(true);
    expect(paidParameters(id, { resolution: '720p', duration: 5, aspect_ratio: 'auto' }, true)).toBe(true);
  });
  it('passes all five trial caps through the real Yir submit validator without network access', async () => {
    const requests: { max_cost: string }[] = [];
    const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body)) as { max_cost: string });
      return Response.json({ id: 'test-upstream-job', status: 'queued' }, { status: 202 });
    });
    vi.stubGlobal('fetch', fetcher);
    try {
      const adapter = new YirAdapter({ apiKey: 'test-only', baseURL: 'https://test.invalid' });
      const trials = catalog.filter((model) => model.guest);
      expect(trials).toHaveLength(5);
      expect(trials.some((model) => model.id === DEFAULT_TRIAL_MODEL_ID)).toBe(true);
      expect(catalog.find((model) => model.id === 'seedance-2-5-v2')?.guest).toBe(false);
      for (const model of trials) {
        const spec = VIDEO_UPSTREAMS[model.id]!;
        const trial = VIDEO_OPTIONS[model.id]!.trial;
        const cap = trialMaxCost(model.id);
        expect(cap).not.toBeNull();
        await expect(adapter.submit({
          upstreamModel: spec.upstreamModel,
          kind: 'video',
          prompt: 'Test prompt',
          references: [],
          parameters: { resolution: trial.resolution, duration: trial.duration, aspect_ratio: '16:9',
            ...(spec.generateAudio === undefined ? {} : { generate_audio: spec.generateAudio }) },
          maxCost: cap!,
        }, `test-${model.id}`)).resolves.toEqual({ upstreamJobId: 'test-upstream-job' });
        expect(requests.at(-1)?.max_cost).toBe(cap);
      }
      expect(fetcher).toHaveBeenCalledTimes(5);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('passes every paid default through the real Yir submit validator without network access', async () => {
    const requests: { max_cost: string }[] = [];
    const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body)) as { max_cost: string });
      return Response.json({ id: 'test-upstream-job', status: 'queued' }, { status: 202 });
    });
    vi.stubGlobal('fetch', fetcher);
    try {
      const adapter = new YirAdapter({ apiKey: 'test-only', baseURL: 'https://test.invalid' });
      expect(catalog).toHaveLength(30);
      for (const model of catalog) {
        const spec = VIDEO_UPSTREAMS[model.id]!;
        const choice = VIDEO_OPTIONS[model.id]!;
        const parameters = {
          ...choice.default,
          aspect_ratio: spec.requiresReference && choice.imageAspectRatio ? choice.imageAspectRatio : '16:9',
          ...(spec.generateAudio === undefined ? {} : { generate_audio: spec.generateAudio }),
        };
        const cap = paidMaxCost(model.id, parameters);
        expect(cap, model.id).not.toBeNull();
        await expect(adapter.submit({
          upstreamModel: spec.upstreamModel,
          kind: 'video',
          prompt: 'Test prompt',
          references: spec.requiresReference ? [{ url: 'https://example.com/reference.png', role: spec.referenceRole ?? 'first_frame' }] : [],
          parameters,
          maxCost: cap!,
        }, `test-${model.id}`), model.id).resolves.toEqual({ upstreamJobId: 'test-upstream-job' });
        expect(requests.at(-1)?.max_cost, model.id).toBe(cap);
      }
      expect(fetcher).toHaveBeenCalledTimes(30);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('has a positive credit price and a bounded upstream cap for every selectable paid specification', () => {
    let count = 0;
    for (const model of catalog) {
      const definition = VIDEO_OPTIONS[model.id];
      expect(definition, `${model.id}: missing choices`).toBeDefined();
      expect(VIDEO_UPSTREAMS[model.id], `${model.id}: missing upstream`).toBeDefined();
      expect(Boolean(definition!.requiresReference), `${model.id}: input requirement mismatch`).toBe(
        Boolean(VIDEO_UPSTREAMS[model.id]!.requiresReference),
      );
      if (definition!.requiresReference) expect(model.maxReferences, model.id).toBeGreaterThan(0);
      expect(paidParameters(model.id, definition!.default), `${model.id}: bad default`).toBe(true);
      for (const option of definition!.options) {
        for (const duration of option.durations) {
          const params = { resolution: option.resolution, duration };
          const label = `${model.id} ${option.resolution} ${duration}s`;
          expect(paidParameters(model.id, params), label).toBe(true);
          const credits = creditsFor(model, params);
          const cap = paidMaxCost(model.id, params);
          expect(Number.isSafeInteger(credits) && credits > 0, label).toBe(true);
          expect(cap, label).not.toBeNull();
          expect(Number(cap), label).toBeGreaterThan(0);
          // Smallest pack revenue per credit is $0.03998; caps retain at least 30% of it.
          expect(Number(cap), label).toBeLessThanOrEqual(credits * 0.03998 * 0.7 + 0.000001);
          count++;
        }
      }
      if (model.guest) expect(Number(trialMaxCost(model.id)), model.id).toBeGreaterThan(0);
    }
    expect(count).toBeGreaterThan(0);
  });
});
