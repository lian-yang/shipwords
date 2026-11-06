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
  signup: { bonusCredits: 0, bonusExpiresDays: 30, bonusPerIpDaily: 2, bonusSiteDaily: 2 },
  guest: { dailyPerDevice: 1, dailyPerIp: 3, dailySiteBudget: 4, minRecaptchaScore: 0.5 },
  billing: { provider: 'stripe', automaticTax: false },
  analytics: { ga4: 'G-YJ3Q2BRW3C' },
});
