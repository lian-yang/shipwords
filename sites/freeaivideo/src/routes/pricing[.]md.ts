import { createFileRoute } from '@tanstack/react-router';
import site from '../../site.config';

// Machine-readable pricing for AI agents comparing tools (see the ai-seo practice): a plain
// markdown file needs no rendering or login. Generated from site.config so prices never fork.
export const Route = createFileRoute('/pricing.md')({
  server: {
    handlers: {
      GET: () => {
        const packs = site.products
          .map((product) => {
            const price = (product.price.amount / 100).toFixed(2);
            const credits = 'credits' in product ? product.credits : product.creditsPerPeriod;
            return [
              `## ${product.name}`,
              '',
              `- Price: $${price} (one-time purchase, ${product.price.currency.toUpperCase()})`,
              `- Credits: ${credits.toLocaleString('en-US')}`,
              '- Expires: never',
              '',
            ].join('\n');
          })
          .join('');
        const body = `# Pricing — ${site.name}

One daily free trial per device when available (${site.guest.dailyPerDevice} per day, shared before and after sign-in, subject to shared limits). Paid videos use one-time credit packs; per-video credit costs depend on the model, resolution and duration and are shown before each generation.

${packs}
## Payment

- Provider: Stripe checkout (cards, wallets)
- No subscription: packs are one-time purchases
- Support: support@freeaivideo.app

Full details: ${site.url}/#pricing
`;
        return new Response(body, {
          headers: { 'content-type': 'text/markdown; charset=utf-8' },
        });
      },
    },
  },
});
