# Signup trial tests

Run from the repository root after installing the existing workspace dependencies:

```bash
ln -s ../../../packages/jobs/node_modules sites/freeaivideo/test/node_modules
pnpm --dir packages/jobs exec vitest run --config ../../sites/freeaivideo/test/vitest.config.ts
pnpm --dir packages/jobs exec tsc --project ../../sites/freeaivideo/test/tsconfig.json --noEmit
```

Create the ignored dependency symlink only when it does not already exist. It reuses the jobs package's pinned test tooling without changing the workspace lockfile. The test worker loads the site's migrations into its own in-memory D1 and uses an isolated R2 bucket; it has no production database, payment, email, or Workflow binding.

The tests exercise the real site job handler, entitlement service, credit ledger and Workflow run method. They cover concurrent claims and redemption, shared issuance and device limits, expiry, old signup credits, adversarial parameters, and transactional rollback through injected SQLite triggers. Compatibility cases preserve the current account policy, both legacy guest and account budgets, and the outer-abort settlement. Workflow steps are cached in memory to simulate a replay; this does not validate Cloudflare's persistent step engine.

Captcha verification and all upstream adapter methods are mocked. Unexpected external requests fail the tests. No video is generated, purchased, or billed during verification.
