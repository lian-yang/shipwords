import { proxyRybbit } from '@shipwords/core/analytics';
import { createDb } from '@shipwords/core/db/client';
import handler from '@tanstack/react-start/server-entry';
import { sweepStaleJobs } from '@shipwords/jobs/sweep';
import { createAdapters } from '@shipwords/jobs/workflow';
import { paraglideMiddleware } from '~/paraglide/server.js';
import { reconcilePendingBilling } from './billing-reconciliation.server';
import { GenerationWorkflow } from './generation-workflow.server';
import models from './models.server';

// Worker entry: pages and API go to TanStack Start; also exports the generation Workflow class.
export { GenerationWorkflow };

export default {
  async fetch(request, env) {
    // Rybbit analytics goes through this site's /stats/ and is proxied upstream here.
    const stats = await proxyRybbit(request, env.RYBBIT_UPSTREAM);
    if (stats) return stats;
    // Only local dev picks the locale from a cookie (for zh review); production is English only and passes requests straight to TanStack Start.
    return import.meta.env.DEV
      ? paraglideMiddleware(request, () => handler.fetch(request))
      : handler.fetch(request);
  },
  // Hourly cron: end stuck jobs whose client never came back (or whose Workflow instance was lost at dispatch).
  async scheduled(_controller, env, ctx) {
    const db = createDb(env.DB);
    ctx.waitUntil(sweepStaleJobs(db, models));
    ctx.waitUntil(
      Promise.resolve()
        .then(() => reconcilePendingBilling(db, createAdapters(env)))
        .catch((error: unknown) => console.error('billing reconciliation unavailable', {
          error: error instanceof Error ? error.name : 'unknown',
        })),
    );
  },
} satisfies ExportedHandler<Env>;
