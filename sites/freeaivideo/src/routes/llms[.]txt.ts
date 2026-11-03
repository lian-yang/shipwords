import { llmsTxt } from '@shipwords/core/seo';
import { createFileRoute } from '@tanstack/react-router';
import site from '../../site.config';

export const Route = createFileRoute('/llms.txt')({
  server: {
    handlers: {
      GET: () =>
        llmsTxt(
          site,
          `An AI video generator using Seedance 2.5. Daily free allowance per device, shared before and after sign-in: ${site.guest.dailyPerDevice}. Trial videos are set to 4 seconds at 480p, subject to shared limits and daily availability. Account-credit videos are set to 10 seconds at 720p and cost 100 credits each. Create from text or a reference photo; with a photo, the aspect ratio follows the image automatically. Eligible new verified accounts can receive one additional 4-second, 480p registration trial voucher, valid for 30 days from registration, subject to daily allocation. Daily trials and registration vouchers are separate from credits and are used when a generation request is accepted; failure or cancellation does not automatically restore them. Previously issued credits remain valid under their original terms. Credit packs are one-time purchases: $4.99 for one 10-second, 720p video (100 credits), or $19.99 for five (500 credits). Purchased credits never expire.`,
          [
            {
              title: 'AI Video Generator',
              path: '/#tool',
              description: 'Generate a short AI video from a text prompt or an optional reference photo.',
            },
            {
              title: 'Frequently Asked Questions',
              path: '/#faq',
              description:
                'Free access, watermarks, the model, reference photos, clip length, aspect ratios, and failed renders.',
            },
            {
              title: 'Pricing',
              path: '/#pricing',
              description: 'One-time credit packs for additional videos.',
            },
            {
              title: 'Seedance 2.5 Free Online',
              path: '/seedance-2-5-free',
              description: 'The video model and the limits of the free try.',
            },
            {
              title: 'AI Video Generator with No Watermark',
              path: '/no-watermark',
              description: 'How free and paid video downloads work without a site-added watermark.',
            },
            {
              title: 'W Chews / L Nibbles',
              path: '/w-chews-l-nibbles',
              description:
                'What the October 2026 food slang pair means and how to make your own version with the free generator.',
            },
          ],
        ),
    },
  },
});
