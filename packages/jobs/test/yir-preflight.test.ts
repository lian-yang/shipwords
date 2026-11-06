import { env } from 'cloudflare:test';
import { getBalance, grantCredits, spendCredits } from '@shipwords/core/credits/ledger';
import { createDb } from '@shipwords/core/db/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { claimUpstreamJob, loadJob, pendingSubmit, spendKey } from '../src/lifecycle';
import { defineModels } from '../src/models';
import { runGeneration, type StepRunner } from '../src/runner';
import { jobs } from '../src/schema';
import type { SubmitInput } from '../src/upstream';
import { YirAdapter } from '../src/yir';

const db = createDb(env.DB);
const base: SubmitInput = {
  upstreamModel: 'vendor/model',
  kind: 'video',
  prompt: 'A quiet sea',
  references: [],
  parameters: { duration: 4, resolution: '480p' },
  maxCost: '0.50',
};
const direct: StepRunner = { do: async (_name, fn) => fn(), sleep: async () => {} };

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Yir real SDK preflight', () => {
  it.each([
    { ...base, kind: 'video' as const },
    { ...base, kind: 'image' as const, parameters: { resolution: '1K' } },
    { ...base, kind: 'music' as const, parameters: { instrumental: true } },
    { ...base, references: [{ role: 'first_frame', url: 'https://example.test/input.png' }] },
  ])('accepts a valid $kind request without network access', (input) => {
    const fetch = vi.fn(() => {
      throw new Error('network must not be used');
    });
    vi.stubGlobal('fetch', fetch);
    expect(() => new YirAdapter({ apiKey: 'test-only' }).prepare(input)).not.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    { ...base, maxCost: '.50' },
    { ...base, maxCost: '0.0000001' },
    { ...base, upstreamModel: '' },
  ])('rejects malformed requests without sending them: %j', (input) => {
    const fetch = vi.fn(() => {
      throw new Error('network must not be used');
    });
    vi.stubGlobal('fetch', fetch);
    expect(() => new YirAdapter({ apiKey: 'test-only' }).prepare(input)).toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('documents that the SDK does not locally validate reference URL schemes', () => {
    const fetch = vi.fn(() => {
      throw new Error('network must not be used');
    });
    vi.stubGlobal('fetch', fetch);
    expect(() =>
      new YirAdapter({ apiKey: 'test-only' }).prepare({
        ...base,
        references: [{ role: 'first_frame', url: 'http://example.test/input.png' }],
      }),
    ).not.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects a missing API key before a request can be claimed', () => {
    expect(() => new YirAdapter({ apiKey: '' }).prepare(base)).toThrow('YIR_API_KEY is not set');
  });
});

async function paidJob() {
  const id = `job_${crypto.randomUUID().replaceAll('-', '')}`;
  const userId = `u_${crypto.randomUUID().replaceAll('-', '')}`;
  await grantCredits(db, { userId, amount: 20, idemKey: `grant:${id}`, source: 'test' });
  await spendCredits(db, { userId, amount: 10, idemKey: spendKey(id) }, [
    db.insert(jobs).values({
      id,
      userId,
      modelId: 'broken',
      kind: 'video',
      upstream: 'yir',
      prompt: 'test',
      costCredits: 10,
      inputJson: JSON.stringify({ references: [], parameters: {}, _verifiedBilling: true }),
    }),
  ]);
  return { id, userId };
}

const invalidModels = defineModels([
  {
    id: 'broken',
    name: 'Broken',
    kind: 'video',
    upstream: 'yir',
    upstreamModel: '',
    credits: 10,
    guest: false,
    allowedParameters: [],
    maxReferences: 0,
    timeoutMinutes: 10,
  },
]);

describe('preflight settlement boundaries', () => {
  it('refunds a local validation failure before the first upstream claim', async () => {
    const { id, userId } = await paidJob();
    const upstream = new YirAdapter({ apiKey: 'test-only' });
    const submit = vi.spyOn(upstream, 'submit');
    const fetch = vi.fn(() => {
      throw new Error('network must not be used');
    });
    vi.stubGlobal('fetch', fetch);
    await runGeneration(
      { db, bucket: env.OUTPUTS, models: invalidModels, adapters: { yir: upstream } },
      id,
      direct,
    );
    const saved = await loadJob(db, id);
    expect(saved).toMatchObject({ status: 'failed', upstreamJobId: null });
    expect((await getBalance(db, userId)).available).toBe(20);
    expect(submit).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not refund when another invocation claims submission before preflight fails', async () => {
    const { id, userId } = await paidJob();
    const frozen = { ...base, upstreamModel: '' };
    let claimed = false;
    const racing: StepRunner = {
      async do(name, fn) {
        if (name === 'submit' && !claimed) {
          claimed = true;
          expect(await claimUpstreamJob(db, id, 0, pendingSubmit(frozen, id))).toBe(true);
        }
        return fn();
      },
      async sleep() {},
    };
    const upstream = new YirAdapter({ apiKey: 'test-only' });
    const submit = vi.spyOn(upstream, 'submit');
    const fetch = vi.fn(() => {
      throw new Error('network must not be used');
    });
    vi.stubGlobal('fetch', fetch);
    await runGeneration(
      { db, bucket: env.OUTPUTS, models: invalidModels, adapters: { yir: upstream } },
      id,
      racing,
    );
    expect(claimed).toBe(true);
    expect(await loadJob(db, id)).toMatchObject({ status: 'failed', errorCode: 'billing_pending' });
    expect((await getBalance(db, userId)).available).toBe(10);
    expect(submit).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
