import type { SessionUser } from '@shipwords/core/billing/handlers';
import { newId } from '@shipwords/core/db/client';
import { user } from '@shipwords/core/db/schema';
import { errorResponse, json } from '@shipwords/core/http';
import { consumeQuota, dayWindow } from '@shipwords/core/quota/counters';
import type { Core } from '@shipwords/core/server';
import { and, eq, isNull } from 'drizzle-orm';
import { agentKeys } from './site/schema';

const KEY_PREFIX = 'fav_';
const MAX_ACTIVE_KEYS = 10;

async function hashKey(key: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  return origin !== null && origin === new URL(request.url).origin;
}

/** API keys authenticate only agent endpoints; key management always uses the browser session. */
export function createAgentKeys(core: Core) {
  return {
    async authenticate(request: Request): Promise<SessionUser | null> {
      const authorization = request.headers.get('authorization') ?? '';
      const match = /^Bearer (fav_[a-f0-9]{64})$/i.exec(authorization);
      if (!match) return null;
      const hash = await hashKey(match[1]!);
      const rows = await core.db
        .select({ id: user.id, email: user.email, name: user.name })
        .from(agentKeys)
        .innerJoin(user, eq(agentKeys.userId, user.id))
        .where(and(eq(agentKeys.keyHash, hash), isNull(agentKeys.revokedAt)))
        .limit(1);
      return rows[0] ?? null;
    },
    async list(request: Request): Promise<Response> {
      const current = await core.getUser(request);
      if (!current) return errorResponse(401, 'unauthorized');
      const rows = await core.db
        .select({ id: agentKeys.id, name: agentKeys.name, createdAt: agentKeys.createdAt })
        .from(agentKeys)
        .where(and(eq(agentKeys.userId, current.id), isNull(agentKeys.revokedAt)));
      return json({ keys: rows });
    },
    async create(request: Request): Promise<Response> {
      if (!sameOrigin(request)) return errorResponse(403, 'invalid_origin');
      const current = await core.getUser(request);
      if (!current) return errorResponse(401, 'unauthorized');
      if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
        return errorResponse(415, 'invalid_content_type');
      const data = await request.text();
      if (data.length > 1024) return errorResponse(413, 'too_large');
      let body: unknown;
      try {
        body = JSON.parse(data);
      } catch {
        return errorResponse(400, 'invalid_request');
      }
      if (
        !body ||
        typeof body !== 'object' ||
        Array.isArray(body) ||
        Object.keys(body).some((key) => key !== 'name')
      )
        return errorResponse(400, 'invalid_request');
      const name = (body as { name?: unknown }).name;
      if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 80)
        return errorResponse(400, 'invalid_name');
      const allowed = await consumeQuota(core.db, [
        { key: `agent-key-create:${current.id}`, window: dayWindow(), limit: 30 },
      ]);
      if (!allowed) return errorResponse(429, 'key_creation_limit');
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      const secret = KEY_PREFIX + Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
      const id = newId('key');
      const createdAt = Date.now();
      const result = await core.env.DB.prepare(
        'INSERT INTO agent_keys (id, user_id, name, key_hash, created_at) SELECT ?, ?, ?, ?, ? WHERE (SELECT count(*) FROM agent_keys WHERE user_id = ? AND revoked_at IS NULL) < ?',
      )
        .bind(id, current.id, name.trim(), await hashKey(secret), createdAt, current.id, MAX_ACTIVE_KEYS)
        .run();
      if (!result.meta.changes) return errorResponse(429, 'too_many_keys');
      return json({ key: { id, name: name.trim(), createdAt }, secret }, { status: 201 });
    },
    async revoke(request: Request, id: string): Promise<Response> {
      if (!sameOrigin(request)) return errorResponse(403, 'invalid_origin');
      const current = await core.getUser(request);
      if (!current) return errorResponse(401, 'unauthorized');
      if (!/^key_[a-f0-9]{32}$/.test(id)) return errorResponse(404, 'key_not_found');
      const result = await core.db
        .update(agentKeys)
        .set({ revokedAt: Date.now() })
        .where(and(eq(agentKeys.id, id), eq(agentKeys.userId, current.id), isNull(agentKeys.revokedAt)))
        .run();
      return result.meta.changes ? json({ revoked: true }) : errorResponse(404, 'key_not_found');
    },
  };
}
