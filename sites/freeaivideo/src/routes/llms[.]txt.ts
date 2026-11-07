import { llmsTxt } from '@shipwords/core/seo';
import { createFileRoute } from '@tanstack/react-router';
import site from '../../site.config';

export const Route = createFileRoute('/llms.txt')({
  server: {
    handlers: {
      GET: () =>
        llmsTxt(
          site,
          `An AI video generator with 30 models for credit generation and five eligible for free trials. The free trial settings are MiniMax H3 at 480p for 4 seconds, Seedance 2.0 Mini at 480p for 4 seconds, Kling 2.6 at 720p for 5 seconds, Grok Imagine Video at 480p for 6 seconds and Gemini Omni 1.2 Flash at 360p for 3 seconds. MiniMax H3 is the default trial model. Seedance 2.5 requires credits. Daily free allowance per device, shared before and after sign-in: ${site.guest.dailyPerDevice}, subject to shared limits and daily availability. Credit costs depend on the model, resolution and duration and are shown before generation; some models require a reference image. Eligible new verified accounts can receive one additional registration trial voucher, valid for 30 days from registration, subject to daily allocation. Daily trials and registration vouchers are separate from credits and are used when a generation request is accepted; failure or cancellation does not automatically restore them. For credit jobs, unsettled billing remains pending; a confirmed zero charge or pre-submission rejection is eligible for a credit return. Previously issued credits remain valid under their original terms. Credit packs are one-time purchases: $4.99 for 100 credits, $19.99 for 500 credits or $49.99 for 1,250 credits. Purchased credits never expire.`,
          [
            {
              title: 'AI Video Generator',
              path: '/#tool',
              description:
                'Generate a short AI video from a text prompt or a reference photo, depending on the model.',
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
              title: 'Seedance 2.5 Video Generation',
              path: '/seedance-2-5-free',
              description: 'Seedance 2.5 credit video generation and available trial models.',
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
            {
              title: 'Frutiger Aero Yams',
              path: '/frutiger-aero-yams',
              description:
                'What the late-2026 Frutiger Aero aesthetic catchphrase means and how to render the look as a free AI video.',
            },
            {
              title: 'First Time in a Fancy Cafe',
              path: '/fancy-cafe-ai',
              description:
                'The viral chair-versus-table cafe sketch format and how to make your own version with the free generator.',
            },
            {
              title: 'Red Carpet AI Video',
              path: '/red-carpet-ai',
              description:
                'Turn a photo into a cinematic premiere arrival with paparazzi flashbulbs, free with the daily try.',
            },
            {
              title: 'Mulmannan Gwangeo AI Floor Dance',
              path: '/mulmannan-gwangeo-ai',
              description:
                'Understand the floor-dance format and start an original short video with an editable example prompt.',
            },
            {
              title: 'When Two Legends Try to Make Coffee',
              path: '/when-two-legends-try-to-make-coffee',
              description:
                'A guide to the two-person coffee-fail format, with original prompts and an optional single reference photo.',
            },
            {
              title: 'Paws at You AI',
              path: '/paws-at-you-ai',
              description:
                'A pet paw-at-the-camera guide with original prompts and optional single-photo input.',
            },
            {
              title: 'Bicep Heart AI',
              path: '/bicep-heart-ai',
              description:
                'A bicep heart pose guide with editable video prompts and optional single-photo input.',
            },
          ],
        ),
    },
  },
});
