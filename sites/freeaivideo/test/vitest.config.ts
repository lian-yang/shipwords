import path from 'node:path';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

// Test dependencies reuse packages/jobs; this test worker has no production bindings.
export default defineConfig(async () => ({
  root: import.meta.dirname,
  plugins: [
    cloudflareTest({
      wrangler: { configPath: path.join(import.meta.dirname, 'wrangler.test.jsonc') },
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: await readD1Migrations(path.join(import.meta.dirname, '../migrations')),
        },
      },
    }),
  ],
  test: { include: ['./*.test.ts'], setupFiles: ['./apply-migrations.ts'] },
}));
