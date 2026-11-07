import { env } from 'cloudflare:test';
import type { SessionUser } from '@shipwords/core/billing/handlers';
import { getBalance, grantCredits } from '@shipwords/core/credits/ledger';
import { createDb } from '@shipwords/core/db/client';
import type { Core } from '@shipwords/core/server';
import { describe, expect, it, vi } from 'vitest';
import site from '../site.config';
import { handleAgentRequest } from '../src/agent-api.server';
import { createAgentKeys } from '../src/agent-keys.server';

const db = createDb(env.DB);
const base = 'https://www.freeaivideo.app';
async function setup() {
  const id = `u_${crypto.randomUUID().replaceAll('-', '')}`;
  const user: SessionUser = { id, name: 'Agent user', email: `${id}@example.test` };
  await env.DB.prepare(
    'INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)',
  )
    .bind(id, user.name, user.email, Date.now(), Date.now())
    .run();
  const dispatch = vi.fn(async () => ({}));
  const core = {
    db,
    site,
    getUser: async () => user,
    log: vi.fn(),
    env: {
      DB: env.DB,
      OUTPUTS: env.OUTPUTS,
      APP_URL: base,
      GUEST_COOKIE_SECRET: 'test-only-cookie-secret',
      GENERATION_WORKFLOW: { create: dispatch },
    },
  } as unknown as Core;
  const response = await createAgentKeys(core).create(
    new Request(`${base}/api/agent/keys/`, {
      method: 'POST',
      headers: { origin: base, 'content-type': 'application/json' },
      body: '{"name":"agent"}',
    }),
  );
  const { secret } = (await response.json()) as { secret: string };
  return { user, core, dispatch, secret };
}
function request(path: string, secret: string, body?: string, key = 'request-1') {
  return new Request(`${base}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      authorization: `Bearer ${secret}`,
      'content-type': 'application/json',
      'idempotency-key': key,
    },
    ...(body === undefined ? {} : { body }),
  });
}

describe('agent API integration', () => {
  it('authenticates, prices and creates exactly one paid job under concurrent retry', async () => {
    const a = await setup();
    const b = await setup();
    await grantCredits(db, {
      userId: a.user.id,
      amount: 100,
      idemKey: `purchase:${a.user.id}`,
      source: 'purchase',
    });
    expect((await handleAgentRequest(request('/api/agent/balance', 'fav_invalid'), a.core)).status).toBe(401);
    const models = (await (
      await handleAgentRequest(request('/api/agent/models', a.secret), a.core)
    ).json()) as { models: { id: string }[] };
    expect(models.models.some((model) => model.id === 'seedance-2-5-v2')).toBe(true);
    const body = JSON.stringify({ modelId: 'seedance-2-5-v2', prompt: 'A boat at sea' });
    const replies = await Promise.all(
      Array.from({ length: 2 }, () => handleAgentRequest(request('/api/agent/jobs', a.secret, body), a.core)),
    );
    expect(replies.map((r) => r.status).sort()).toEqual([200, 201]);
    const jobs = await Promise.all(
      replies.map(async (r) => ((await r.json()) as { job: { id: string; costCredits: number } }).job),
    );
    expect(jobs[0]!.id).toBe(jobs[1]!.id);
    expect(a.dispatch).toHaveBeenCalledTimes(1);
    expect((await getBalance(db, a.user.id)).available).toBe(100 - jobs[0]!.costCredits);
    expect(
      (
        await handleAgentRequest(
          request('/api/agent/jobs', a.secret, '{ "prompt": "A boat at sea", "modelId": "seedance-2-5-v2" }'),
          a.core,
        )
      ).status,
    ).toBe(200);
    expect(
      (await handleAgentRequest(request(`/api/agent/jobs/${jobs[0]!.id}`, b.secret), b.core)).status,
    ).toBe(404);
    expect(
      (await handleAgentRequest(request('/api/agent/jobs', a.secret, body.replace('sea', 'sky')), a.core))
        .status,
    ).toBe(409);
  });
  it('rejects malformed generation requests before attempting a paid job', async () => {
    const a = await setup();
    expect(
      (
        await handleAgentRequest(
          request('/api/agent/jobs', a.secret, '{"modelId":"seedance-2-5-v2","prompt":12}'),
          a.core,
        )
      ).status,
    ).toBe(400);
    expect(
      (await handleAgentRequest(request('/api/agent/jobs', a.secret, '{}', 'bad key'), a.core)).status,
    ).toBe(400);
    expect(a.dispatch).not.toHaveBeenCalled();
  });
});
