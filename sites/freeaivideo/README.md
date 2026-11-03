# Free AI Video

- Site: https://www.freeaivideo.app
- Target: free AI video generator, no sign-up; Seedance 2.5 free online.
- Model: Seedance 2.5, text-to-video and one optional reference photo.
- Contact: support@freeaivideo.app
- Language: English in production; English and Chinese in local preview.
- Analytics: GA4 `G-YJ3Q2BRW3C`.
- Billing: Stripe one-time credit packs, configured in `site.config.ts`.

## Configured entitlements

| Entry | Output | Allowance |
| --- | --- | --- |
| Daily trial | 4 seconds, 480p | One accepted request per signed device per UTC day, shared before and after sign-in; IP cap 3, site cap 4 |
| Registration voucher | 4 seconds, 480p | One voucher per eligible verified new account, valid until 30 days after registration; issuance capped at 2 per IP and 2 site-wide per UTC day |
| Credits | 10 seconds, 720p | 100 credits per video; Starter $4.99/100, Creator $19.99/500; purchased credits never expire |

The site adds no watermark. Photo input uses its own aspect ratio automatically. Trial settings are fixed server-side, with a separate $0.60 upstream ceiling; paid jobs use $2.60. Earlier jobs keep their established execution policy.

Registration vouchers are separate from credits and daily trials. `src/trials.server.ts` defines the registration eligibility timestamp, reads verified identity from D1 and excludes accounts with an earlier signup-credit grant. Existing credit balances and expiry terms are preserved. Verification establishes eligibility; the first signed-in visit to the generator or account claims the voucher when allocation is available. Its expiry is always measured from registration.

Issuance and usage markers live in existing `quota_counters` rows. Conditional assertions, quota changes and the corresponding job creation share an atomic D1 batch. The two-voucher limit counts issuance, not daily redemption or a hard daily cash-spend ceiling. Outstanding vouchers can be redeemed on later days before expiry.

Accepted free requests use their allowance even if later canceled or failed. They have no `quotaJson` automatic-return path, preventing a supplier charge or unknown dispatch outcome from enabling repeated free attempts. Validation, verification and transaction failures before acceptance do not consume the allowance. Paid jobs retain the shared credit settlement behavior.

## Verification and deployment

Use the site `check` script and the isolated workerd/D1 tests in [test/README.md](test/README.md). Tests mock upstream and CAPTCHA requests and cannot spend production credits. Deployment uses the established Worker, D1, R2 and Workflow bindings; this feature requires no database migration or new resource.
