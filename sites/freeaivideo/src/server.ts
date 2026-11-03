import { proxyRybbit } from '@shipwords/core/analytics';
import handler from '@tanstack/react-start/server-entry';
import { paraglideMiddleware } from '~/paraglide/server.js';
import { GenerationWorkflow } from './generation-workflow.server';

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
} satisfies ExportedHandler<Env>;
