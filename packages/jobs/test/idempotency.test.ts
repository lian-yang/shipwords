import { env } from 'cloudflare:test';
import { getBalance, grantCredits } from '@shipwords/core/credits/ledger';
import { createDb } from '@shipwords/core/db/client';
import type { Core } from '@shipwords/core/server';
import { and, eq } from 'drizzle-orm';
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { beforeAll, describe, expect, it } from 'vitest';
import { createJobs, type JobIdempotency } from '../src/handlers';
import type { ModelDefinition } from '../src/models';

const db = createDb(env.DB);
const requests = sqliteTable('test_agent_requests', {
  userId: text('user_id').notNull(),
  key: text('request_key').notNull(),
  fingerprint: text('fingerprint').notNull(),
  jobId: text('job_id').notNull(),
});
const model: ModelDefinition = {
  id: 'test',
  name: 'Test',
  kind: 'video',
  upstream: 'yir',
  upstreamModel: 'test',
  credits: 1,
  guest: false,
  allowedParameters: [],
  maxReferences: 0,
  maxCost: '0.01',
  timeoutMinutes: 10,
};

beforeAll(async () => {
  await env.DB.prepare(
    'CREATE TABLE test_agent_requests (user_id TEXT NOT NULL, request_key TEXT NOT NULL, fingerprint TEXT NOT NULL, job_id TEXT NOT NULL, UNIQUE(user_id, request_key))',
  ).run();
});

function api(userId: string | null, options: { failDispatch?: boolean; cost?: number } = {}) {
  const dispatched: string[] = [];
  const core = {
    db,
    site: { id: 'idempotency', url: 'https://example.test' },
    env: {
      APP_URL: 'https://example.test',
      GUEST_COOKIE_SECRET: 'secret',
      GENERATION_WORKFLOW: {
        create: async ({ id }: { id: string }) => {
          dispatched.push(id);
          if (options.failDispatch) throw new Error('dispatch failed');
        },
      },
    },
    getUser: async () => (userId ? { id: userId } : null),
    log: () => {},
  } as unknown as Core;
  return { jobs: createJobs(core, [{ ...model, credits: options.cost ?? 1 }]), dispatched };
}

async function funded(amount = 1) {
  const id = `u_${crypto.randomUUID().replaceAll('-', '')}`;
  await grantCredits(db, { userId: id, amount, idemKey: `grant:${id}`, source: 'test' });
  return id;
}

function hooks(userId: string, key: string, fingerprint = 'one', gate?: () => Promise<void>): JobIdempotency {
  let first = true;
  return {
    async lookup() {
      const [row] = await db
        .select()
        .from(requests)
        .where(and(eq(requests.userId, userId), eq(requests.key, key)));
      if (first && gate) {
        first = false;
        await gate();
      }
      return row ? { jobId: row.jobId, matches: row.fingerprint === fingerprint } : null;
    },
    insert(jobId) {
      return db.insert(requests).values({ userId, key, fingerprint, jobId });
    },
  };
}

const post = (prompt = 'hello') =>
  new Request('https://example.test/api/jobs', {
    method: 'POST',
    body: JSON.stringify({ modelId: 'test', prompt }),
  });

async function jobId(response: Response): Promise<string> {
  return ((await response.json()) as { job: { id: string } }).job.id;
}

describe('trusted idempotent job creation', () => {
  it('concurrent retries with only enough credit for one job return one job and dispatch once', async () => {
    const userId = await funded();
    const { jobs, dispatched } = api(userId);
    let arrivals = 0;
    let release!: () => void;
    const ready = new Promise<void>((resolve) => {
      release = resolve;
    });
    const gate = async () => {
      if (++arrivals === 2) release();
      await ready;
    };
    const [first, second] = await Promise.all([
      jobs.create(post(), hooks(userId, 'same', 'one', gate)),
      jobs.create(post(), hooks(userId, 'same', 'one', gate)),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 201]);
    expect(await jobId(first)).toBe(await jobId(second));
    expect(dispatched).toHaveLength(1);
    expect((await getBalance(db, userId)).available).toBe(0);
  });

  it('rejects a changed request, including when the original has spent the last credit', async () => {
    const userId = await funded();
    const { jobs, dispatched } = api(userId);
    expect((await jobs.create(post(), hooks(userId, 'same'))).status).toBe(201);
    const conflict = await jobs.create(post('different'), hooks(userId, 'same', 'two'));
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({ error: { code: 'idempotency_conflict' } });
    expect(dispatched).toHaveLength(1);
  });

  it('resolves concurrent different payloads with one success and one conflict', async () => {
    const userId = await funded(2);
    const { jobs, dispatched } = api(userId);
    let arrivals = 0;
    let release!: () => void;
    const ready = new Promise<void>((resolve) => {
      release = resolve;
    });
    const gate = async () => {
      if (++arrivals === 2) release();
      await ready;
    };
    const responses = await Promise.all([
      jobs.create(post(), hooks(userId, 'same', 'one', gate)),
      jobs.create(post('different'), hooks(userId, 'same', 'two', gate)),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(dispatched).toHaveLength(1);
    expect((await getBalance(db, userId)).available).toBe(1);
  });

  it('atomically records and replays a zero-credit job', async () => {
    const userId = await funded();
    const { jobs, dispatched } = api(userId, { cost: 0 });
    const first = await jobs.create(post(), hooks(userId, 'same'));
    const retry = await jobs.create(post(), hooks(userId, 'same'));
    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    expect(await jobId(first)).toBe(await jobId(retry));
    expect(dispatched).toHaveLength(1);
    expect((await getBalance(db, userId)).available).toBe(1);
  });

  it('rolls back the charge and job when the mapping insert fails', async () => {
    const userId = await funded();
    const { jobs, dispatched } = api(userId);
    const bad: JobIdempotency = {
      lookup: async () => null,
      insert: (id) =>
        db
          .insert(requests)
          .values({ userId, key: 'same', fingerprint: null as unknown as string, jobId: id }),
    };
    await expect(jobs.create(post(), bad)).rejects.toThrow();
    expect(dispatched).toHaveLength(0);
    expect((await getBalance(db, userId)).available).toBe(1);
    expect((await jobs.create(post(), hooks(userId, 'same'))).status).toBe(201);
  });

  it('keeps the same request key independent between accounts and denies foreign mappings', async () => {
    const first = await funded();
    const second = await funded();
    const a = api(first);
    const b = api(second);
    const aId = await jobId(await a.jobs.create(post(), hooks(first, 'same')));
    const bId = await jobId(await b.jobs.create(post(), hooks(second, 'same')));
    expect(aId).not.toBe(bId);
    const foreign: JobIdempotency = {
      lookup: async () => ({ jobId: aId, matches: true }),
      insert: hooks(second, 'foreign').insert,
    };
    expect((await b.jobs.create(post(), foreign)).status).toBe(500);
    expect(b.dispatched).toHaveLength(1);
  });

  it('does not dispatch again after a dispatch failure and returns the final job on retry', async () => {
    const userId = await funded();
    const { jobs, dispatched } = api(userId, { failDispatch: true });
    expect((await jobs.create(post(), hooks(userId, 'same'))).status).toBe(503);
    const retry = await jobs.create(post(), hooks(userId, 'same'));
    expect(retry.status).toBe(200);
    expect(await retry.json()).toMatchObject({ job: { status: 'failed' } });
    expect(dispatched).toHaveLength(1);
    expect((await getBalance(db, userId)).available).toBe(1);
  });

  it('requires a signed-in user when hooks are supplied', async () => {
    const { jobs, dispatched } = api(null);
    expect((await jobs.create(post(), hooks('user', 'same'))).status).toBe(401);
    expect(dispatched).toHaveLength(0);
  });

  it('returns a genuine low-balance error and does not leave a request record', async () => {
    const userId = await funded();
    const { jobs, dispatched } = api(userId, { cost: 2 });
    const request = hooks(userId, 'same');
    expect((await jobs.create(post(), request)).status).toBe(402);
    expect(await request.lookup()).toBeNull();
    expect(dispatched).toHaveLength(0);
    expect((await getBalance(db, userId)).available).toBe(1);
  });
});
