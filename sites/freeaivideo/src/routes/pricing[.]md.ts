import { createFileRoute } from '@tanstack/react-router';
import { SUPPORT_EMAIL } from '~/site/legal';
import { creditPackPrice, creditPacks, registrationVoucherDays } from '~/site/public-offer';
import site from '../../site.config';

const providerNames = { stripe: 'Stripe Checkout', paypal: 'PayPal Checkout' };

export const Route = createFileRoute('/pricing.md')({
  server: {
    handlers: {
      GET: () => {
        const packs = creditPacks
          .map((pack) =>
            [
              `## ${pack.name}`,
              '',
              `- Price: ${creditPackPrice(pack)} (one-time purchase, ${pack.price.currency.toUpperCase()})`,
              `- Credits: ${pack.credits.toLocaleString('en-US')}`,
              `- Expires: ${pack.expiresDays === null ? 'never' : `${pack.expiresDays} days`}`,
            ].join('\n'),
          )
          .join('\n\n');
        const body = `# Pricing — ${site.name}

## Free access

- The daily trial limit is ${site.guest.dailyPerDevice} per device, shared before and after sign-in. The limit resets at 00:00 UTC. Network and shared daily limits also affect availability.
- Eligible new verified accounts may receive one voucher, valid for ${registrationVoucherDays} days from registration and subject to daily allocation. The voucher is separate from credits.

Trials use fixed settings for the selected model. An accepted free request uses the trial or voucher even if the video later fails or the request is canceled.

## Video credits

Credit costs depend on the model, resolution and duration. The generator shows the cost before you submit a request. Free AI Video adds no watermark and charges no separate export fee.

${packs}

## Payment

- Provider: ${providerNames[site.billing.provider]}
- Credit packs are one-time purchases.
- Support: ${SUPPORT_EMAIL}

## Credit returns and purchase refunds

A credit generation request qualifies for a credit return if the provider confirms a zero final charge or the request is rejected before submission. A request stays pending while billing is unconfirmed. If the provider charges, credits are not automatically returned. Purchase refunds follow the [refund policy](${site.url}/refunds).

[View the credit packs](${site.url}/#pricing)
`;
        return new Response(body, {
          headers: { 'content-type': 'text/markdown; charset=utf-8' },
        });
      },
    },
  },
});
