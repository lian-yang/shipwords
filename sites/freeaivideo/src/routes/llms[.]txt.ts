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
              title: 'Free AI Video API and MCP Documentation',
              path: '/api-docs',
              description:
                'Connect an application or AI agent with the agent API or MCP: models, balance, uploads, jobs and results.',
            },
            {
              title: 'Shoulder Carry AI',
              path: '/shoulder-carry-ai',
              description:
                'The parking-garage shoulder-lift flip guide with editable video prompts and an announcement-line finish.',
            },
            {
              title: 'Tough Like a Gorilla AI',
              path: '/tough-like-a-gorilla-ai',
              description:
                'The mirror-chant flatbread trend with the shocked headphone friend, explained with editable video prompts.',
            },
            {
              title: 'Jisoo Addicted Dance AI',
              path: '/jisoo-addicted-dance-ai',
              description:
                'The hallway cat-paw choreography guide with editable video prompts and optional single-photo input.',
            },
            {
              title: 'Christmas Pajama Dance AI',
              path: '/christmas-pajama-dance-ai',
              description:
                'The matching plaid pajama kitchen duo dance guide with editable video prompts and a pet remix option.',
            },
            {
              title: 'Housewife Dance AI',
              path: '/housewife-dance-ai',
              description:
                'The wide-stance hip-swing solo dance guide with editable video prompts and a hind-leg pet version.',
            },
            {
              title: 'I Need a Girl Dance AI',
              path: '/i-need-a-girl-dance-ai',
              description:
                'The night parking-lot duo dance guide with the spoken intro and peace-sign drop, with editable prompts.',
            },
            {
              title: 'Ice Ice Baby Dance AI',
              path: '/ice-ice-baby-dance-ai',
              description:
                'The wet winter basketball court windbreaker routine guide with editable video prompts.',
            },
            {
              title: 'I Thought We Were Having a Nice Date AI',
              path: '/i-thought-we-were-having-a-nice-date-ai',
              description:
                'The dinner-date giggle-to-tears turn guide with editable video prompts and a pet-at-the-table remix.',
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
            {
              title: 'Epic Dunk AI',
              path: '/epic-dunk-ai',
              description:
                'A slam dunk highlight guide with editable video prompts and optional single-photo input.',
            },
            {
              title: 'Burning Bridges AI',
              path: '/burning-bridges-ai',
              description:
                'A walk-away-from-the-explosion guide with original video prompts and optional single-photo input.',
            },
            {
              title: 'Tip Toeing in My Jordans AI',
              path: '/tiptoeing-in-my-jordans-ai',
              description:
                'A tiptoe sneaker meme guide with editable video prompts and optional single-photo input.',
            },
            {
              title: 'Buggin Dance AI',
              path: '/buggin-dance-ai',
              description:
                'A witch-hat pet dance trend guide with editable video prompts and optional single-photo input.',
            },
            {
              title: 'Dog Elevator Prank AI',
              path: '/dog-elevator-prank-ai',
              description:
                'A dog elevator prank guide with original security-camera style video prompts and optional single-photo input.',
            },
            {
              title: 'Chipmunks Dance AI',
              path: '/chipmunks-dance-ai',
              description:
                'A three-person rotation dance guide with editable video prompts and optional single-photo input.',
            },
            {
              title: 'Anime Star Eye AI',
              path: '/anime-star-eye-ai',
              description:
                'A sparkle-eye trend guide with editable video prompts and optional single-photo input.',
            },
            {
              title: 'Can I Ride Dance AI',
              path: '/can-i-ride-dance-ai',
              description:
                'A dusk parking-lot face-off dance guide with editable video prompts and optional single-photo input.',
            },
            {
              title: 'Ba Ba Ba Dance AI',
              path: '/ba-ba-ba-dance-ai',
              description:
                'A locker-hallway relay duo dance guide with editable video prompts and optional single-photo input.',
            },
            {
              title: 'Birthday Car AI',
              path: '/birthday-car-ai',
              description:
                'A car-window candle blow-out guide with editable video prompts and optional single-photo input.',
            },
            {
              title: 'Dog Bohemian Rhapsody AI',
              path: '/dog-bohemian-rhapsody-ai',
              description:
                'A stadium piano pet-performance guide with editable video prompts and optional single-photo input.',
            },
            {
              title: 'Fish Cutting Meme AI',
              path: '/fish-cutting-meme-ai',
              description:
                'A cowboy-hat precision fish-cutting guide with editable video prompts and optional single-photo input.',
            },
            {
              title: 'Pimpwalk Entrance AI',
              path: '/pimpwalk-entrance-ai',
              description:
                'A slow-motion door entrance guide with editable video prompts and optional single-photo input.',
            },
            {
              title: 'Flamingo Float AI',
              path: '/flamingo-float-ai',
              description:
                'A rooftop infinity-pool flamingo drift guide with editable video prompts and optional single-photo input.',
            },
            {
              title: 'Snatch Back Splash AI',
              path: '/snatch-back-splash-ai',
              description:
                'A crowd-view steal-back three-pointer guide with editable video prompts and optional single-photo input.',
            },
            {
              title: 'Tears Falling Down AI',
              path: '/tears-falling-down-filter-ai',
              description:
                'A quiet tear-filter close-up guide with editable video prompts and optional single-photo input.',
            },
            {
              title: 'Dog Couple Dance AI',
              path: '/dog-couple-dance-ai',
              description:
                'A mirrored pet slow-dance guide with editable video prompts and optional single-photo input.',
            },
            {
              title: 'I Love the Smiths AI',
              path: '/i-love-the-smiths-ai',
              description:
                'An elevator eye-contact meme guide with editable video prompts and optional one- or two-photo input.',
            },
            {
              title: 'Christmas Lights Wife AI',
              path: '/christmas-lights-wife-ai',
              description:
                'A holiday lights-drag sprint guide with editable video prompts and optional one- or two-photo input.',
            },
            {
              title: 'I Want Wings AI',
              path: '/i-want-wings-ai',
              description:
                'A roach-to-butterfly glow-up guide with editable two-beat prompts and optional single-photo input.',
            },
            {
              title: 'Its My Life Dog AI',
              path: '/its-my-life-dog-ai',
              description:
                'A split-screen highway pet lip-sync guide with editable video prompts and optional single-photo input.',
            },
            {
              title: 'Car Alarm AI Dance',
              path: '/car-alarm-ai-dance',
              description:
                'A car-alarm pet dance guide with editable video prompts and optional single-photo input.',
            }
          ],
        ),
    },
  },
});
