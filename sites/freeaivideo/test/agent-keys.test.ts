import { env } from 'cloudflare:test';
import type { SessionUser } from '@shipwords/core/billing/handlers';
import { createDb } from '@shipwords/core/db/client';
import type { Core } from '@shipwords/core/server';
import { describe, expect, it } from 'vitest';
import { createAgentKeys } from '../src/agent-keys.server';

const base = 'https://www.freeaivideo.app';
async function makeUser(): Promise<SessionUser> {
  const id = `u_${crypto.randomUUID().replaceAll('-', '')}`;
  const value = { id, email: `${id}@example.test`, name: 'Test user' };
  await env.DB.prepare(
    'INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)',
  )
    .bind(id, value.name, value.email, Date.now(), Date.now())
    .run();
  return value;
}
function keysFor(user: SessionUser | null) {
  return createAgentKeys({
    db: createDb(env.DB),
    env: { DB: env.DB },
    getUser: async () => user,
  } as unknown as Core);
}
function request(method: string, options: { body?: string; origin?: string; token?: string } = {}) {
  return new Request(`${base}/api/agent/keys/`, {
    method,
    headers: {
      origin: options.origin ?? base,
      'content-type': 'application/json',
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    ...(options.body ? { body: options.body } : {}),
  });
}

describe('agent credentials', () => {
  it('stores only the hash, isolates accounts and revokes immediately', async () => {
    const owner = await makeUser();
    const other = await makeUser();
    const keys = keysFor(owner);
    const response = await keys.create(request('POST', { body: JSON.stringify({ name: 'My agent' }) }));
    expect(response.status).toBe(201);
    const { key, secret } = (await response.json()) as { key: { id: string }; secret: string };
    expect(secret).toMatch(/^fav_[a-f0-9]{64}$/);
    const row = await env.DB.prepare('SELECT key_hash FROM agent_keys WHERE id = ?')
      .bind(key.id)
      .first<{ key_hash: string }>();
    expect(row?.key_hash).toHaveLength(64);
    expect(row?.key_hash).not.toBe(secret);
    expect(await keys.authenticate(request('GET', { token: secret }))).toEqual(owner);
    expect(await keys.authenticate(request('GET', { token: `${secret}x` }))).toBeNull();
    const list = await keys.list(request('GET'));
    expect(await list.text()).not.toContain(secret);
    expect((await keysFor(other).revoke(request('DELETE'), key.id)).status).toBe(404);
    expect(await keys.authenticate(request('GET', { token: secret }))).toEqual(owner);
    expect((await keys.revoke(request('DELETE'), key.id)).status).toBe(200);
    expect(await keys.authenticate(request('GET', { token: secret }))).toBeNull();
    expect((await keys.revoke(request('DELETE'), key.id)).status).toBe(404);
  });
  it('requires a login and same-origin state changes', async () => {
    const owner = await makeUser();
    const body = JSON.stringify({ name: 'agent' });
    expect((await keysFor(null).create(request('POST', { body }))).status).toBe(401);
    expect((await keysFor(owner).create(request('POST', { body, origin: 'https://evil.test' }))).status).toBe(
      403,
    );
    expect(
      (await keysFor(owner).create(request('POST', { body: JSON.stringify({ name: '' }) }))).status,
    ).toBe(400);
  });
  it('atomically enforces the active-key limit under concurrent requests', async () => {
    const keys = keysFor(await makeUser());
    const replies = await Promise.all(
      Array.from({ length: 12 }, () => keys.create(request('POST', { body: '{"name":"agent"}' }))),
    );
    expect(replies.filter((r) => r.status === 201)).toHaveLength(10);
    expect(replies.filter((r) => r.status === 429)).toHaveLength(2);
  });
});
