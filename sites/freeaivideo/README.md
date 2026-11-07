# Free AI Video

- Site: https://www.freeaivideo.app
- Target: free AI video generator, no sign-up; Seedance 2.5 video generation.
- Models: 30 for credit videos, including five trial-eligible models; text-to-video and reference-photo support depend on the selected model. Seedance 2.5 requires credits.
- Contact: support@freeaivideo.app
- Language: English in production; English and Chinese in local preview.
- Analytics: GA4 `G-YJ3Q2BRW3C`.
- Billing: Stripe one-time credit packs, configured in `site.config.ts`.

## Configured entitlements

| Entry | Output | Allowance |
| --- | --- | --- |
| Daily trial | Selected model's trial settings | One accepted request per signed device per UTC day, shared before and after sign-in; IP cap 3, site cap 4 |
| Registration voucher | Selected model's trial settings | One voucher per eligible verified new account, valid until 30 days after registration; issuance capped at 2 per IP and 2 site-wide per UTC day |
| Credits | Selected model, resolution and duration | Cost shown before generation; Starter $4.99/100, Creator $19.99/500, Studio $49.99/1,250; purchased credits never expire |

The site adds no watermark. Photo support and aspect ratio behavior depend on the selected model. Trial settings and upstream cost ceilings are fixed per model on the server; paid cost ceilings depend on the selected specification. Earlier jobs keep their established execution policy. See [video pricing](design/video-pricing.md).

Registration vouchers are separate from credits and daily trials. `src/trials.server.ts` defines the registration eligibility timestamp, reads verified identity from D1 and excludes accounts with an earlier signup-credit grant. Existing credit balances and expiry terms are preserved. Verification establishes eligibility; the first signed-in visit to the generator or account claims the voucher when allocation is available. Its expiry is always measured from registration.

Issuance and usage markers live in existing `quota_counters` rows. Conditional assertions, quota changes and the corresponding job creation share an atomic D1 batch. The two-voucher limit counts issuance, not daily redemption or a hard daily cash-spend ceiling. Outstanding vouchers can be redeemed on later days before expiry.

Accepted free requests use their allowance even if later canceled or failed. They have no `quotaJson` automatic-return path, preventing a supplier charge or unknown dispatch outcome from enabling repeated free attempts. Validation, verification and transaction failures before acceptance do not consume the allowance. Paid jobs retain the shared credit settlement behavior.

## Verification and deployment

Use the site `check` script and the isolated workerd/D1 tests in [test/README.md](test/README.md). Tests mock upstream and CAPTCHA requests and cannot spend production credits. Deployment uses the established Worker, D1, R2 and Workflow bindings; this feature requires no database migration or new resource.
