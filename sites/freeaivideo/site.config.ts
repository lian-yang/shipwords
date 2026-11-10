import { defineSite, type Product } from '@shipwords/core/site';

// All config for this site. Prices are in the smallest currency unit (cents). Do not change id after launch.
// Model credit prices live in site.models.ts; execution cost ceilings live in src/models.server.ts.
// Guest limits count accepted attempts; signup limits cap daily registration-voucher recipients.
export default defineSite({
  id: 'freeaivideo',
  name: 'Free AI Video',
  url: 'https://www.freeaivideo.app',
  locales: ['en'],
  defaultLocale: 'en',
  products: [
    {
      id: 'pack_100',
      kind: 'credits',
      name: 'Starter',
      price: { amount: 499, currency: 'usd' },
      credits: 100,
      expiresDays: null,
    },
    {
      id: 'pack_500',
      kind: 'credits',
      name: 'Creator',
      price: { amount: 1999, currency: 'usd' },
      credits: 500,
      expiresDays: null,
    },
    {
      id: 'pack_1250',
      kind: 'credits',
      name: 'Studio',
      price: { amount: 4999, currency: 'usd' },
      credits: 1250,
      expiresDays: null,
    },
  ] as readonly Product[],
  // Registration vouchers are issued by src/trials.server.ts; previously issued credits stay valid.
  // Site budgets are sized for referral bursts (ChatGPT citations sent 58 signups on 2026-11-06/07
  // while the old budgets of 2/4 were exhausted every day). Worst case ≈ $0.31 upstream per trial.
  signup: { bonusCredits: 0, bonusExpiresDays: 30, bonusPerIpDaily: 4, bonusSiteDaily: 40 },
  guest: { dailyPerDevice: 1, dailyPerIp: 3, dailySiteBudget: 100, minRecaptchaScore: 0.5 },
  billing: { provider: 'stripe', automaticTax: false },
  analytics: { ga4: 'G-YJ3Q2BRW3C' },
});
