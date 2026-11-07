import { user } from '@shipwords/core/db/schema';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/** Site-scoped credentials; the secret itself is never stored. */
export const agentKeys = sqliteTable(
  'agent_keys',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    keyHash: text('key_hash').notNull().unique(),
    createdAt: integer('created_at').notNull(),
    revokedAt: integer('revoked_at'),
  },
  (t) => [index('agent_keys_user_idx').on(t.userId)],
);

/** Permanent reservation makes retries of a paid agent request resolve to the same job. */
export const agentRequests = sqliteTable(
  'agent_requests',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    requestHash: text('request_hash').notNull(),
    jobId: text('job_id').notNull().unique(),
  },
  (t) => [uniqueIndex('agent_requests_user_key_idx').on(t.userId, t.key)],
);
