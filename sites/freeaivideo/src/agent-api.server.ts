import { getBalance } from '@shipwords/core/credits/ledger';
import { errorResponse, json } from '@shipwords/core/http';
import { consumeQuota, dayWindow } from '@shipwords/core/quota/counters';
import type { Core } from '@shipwords/core/server';
import { createJobs } from '@shipwords/jobs/handlers';
import { creditsFor } from '@shipwords/jobs/models';
import { and, eq } from 'drizzle-orm';
import catalog from '../site.models';
import { createAgentKeys } from './agent-keys.server';
import { core } from './core.server';
import { createSiteJob } from './create-job.server';
import models from './models.server';
import { agentRequests } from './site/schema';
import { VIDEO_OPTIONS } from './video-options';

const MAX_BODY = 16 * 1024;

async function digest(value: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** JSON object key order and whitespace do not change a generation request. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(object[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

/** A narrow machine interface. A key never authenticates billing or browser endpoints. */
export async function handleAgentRequest(request: Request, appCore: Core = core): Promise<Response> {
  const core = appCore;
  const keys = createAgentKeys(core);
  const user = await keys.authenticate(request);
  if (!user) return errorResponse(401, 'unauthorized');
  if (!(await consumeQuota(core.db, [{ key: `agent-api:${user.id}`, window: dayWindow(), limit: 3000 }])))
    return errorResponse(429, 'rate_limit');
  const agentCore = { ...core, getUser: async () => user };
  const api = createJobs(agentCore, models);
  const path = new URL(request.url).pathname.replace(/\/$/, '');
  if (path === '/api/agent/models' && request.method === 'GET') {
    return json({
      models: catalog.map((model) => {
        const options = VIDEO_OPTIONS[model.id]!;
        return {
          id: model.id,
          name: model.name,
          maxReferences: model.maxReferences,
          defaults: model.defaults,
          aspectRatios: options.aspectRatios,
          imageAspectRatio: options.imageAspectRatio ?? null,
          requiresReference: options.requiresReference ?? false,
          options: options.options.map((option) => ({
            resolution: option.resolution,
            durations: option.durations.map((duration) => ({
              duration,
              credits: creditsFor(model, { ...model.defaults, resolution: option.resolution, duration }),
            })),
          })),
        };
      }),
    });
  }
  if (path === '/api/agent/balance' && request.method === 'GET')
    return json({ balance: await getBalance(core.db, user.id) });
  if (path === '/api/agent/uploads' && request.method === 'POST') return api.upload(request);
  if (path === '/api/agent/jobs' && request.method === 'GET') return api.list(request);
  if (path === '/api/agent/jobs' && request.method === 'POST') {
    const key = request.headers.get('Idempotency-Key');
    if (!key || !/^[A-Za-z0-9._~-]{1,128}$/.test(key)) return errorResponse(400, 'invalid_idempotency_key');
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
      return errorResponse(415, 'invalid_content_type');
    if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY)
      return errorResponse(413, 'request_too_large');
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > MAX_BODY) {
          await reader.cancel();
          return errorResponse(413, 'request_too_large');
        }
        chunks.push(value);
      }
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const raw = new TextDecoder().decode(bytes);
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return errorResponse(400, 'invalid_json');
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return errorResponse(400, 'invalid_body');
    const data = body as Record<string, unknown>;
    if (
      Object.keys(data).some((field) => !['modelId', 'prompt', 'parameters', 'references'].includes(field)) ||
      typeof data.modelId !== 'string' ||
      typeof data.prompt !== 'string' ||
      (data.references !== undefined &&
        (!Array.isArray(data.references) ||
          data.references.length > 1 ||
          data.references.some((ref) => typeof ref !== 'string'))) ||
      (data.parameters !== undefined &&
        (!data.parameters ||
          typeof data.parameters !== 'object' ||
          Array.isArray(data.parameters) ||
          Object.entries(data.parameters).some(([key, value]) =>
            key === 'duration'
              ? typeof value !== 'number'
              : !['resolution', 'aspect_ratio'].includes(key) || typeof value !== 'string',
          )))
    )
      return errorResponse(400, 'invalid_body');
    const requestHash = await digest(canonical(data));
    const idempotency = {
      async lookup() {
        const [row] = await core.db
          .select()
          .from(agentRequests)
          .where(and(eq(agentRequests.userId, user.id), eq(agentRequests.key, key)))
          .limit(1);
        return row ? { jobId: row.jobId, matches: row.requestHash === requestHash } : null;
      },
      insert(jobId: string) {
        return core.db.insert(agentRequests).values({ userId: user.id, key, requestHash, jobId });
      },
    };
    // A previously accepted request stays replayable even if its model is later removed.
    const existing = await idempotency.lookup();
    if (existing)
      return existing.matches ? api.get(request, existing.jobId) : errorResponse(409, 'idempotency_conflict');
    const paid = new Request(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify({ ...data, mode: 'paid' }),
    });
    return createSiteJob(agentCore, paid, idempotency);
  }
  const match = path.match(/^\/api\/agent\/jobs\/(job_[a-z0-9]+)$/);
  if (match && request.method === 'GET') return api.get(request, match[1]!);
  return errorResponse(404, 'not_found');
}
