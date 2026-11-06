import type { D1Migration } from '@cloudflare/vitest-plugin';

declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      OUTPUTS: R2Bucket;
      TEST_MIGRATIONS: D1Migration[];
      ADMIN_EMAIL: string;
      YIR_API_KEY: string;
      GENERATION_WORKFLOW: Workflow<{ jobId: string }>;
    }
  }
}
