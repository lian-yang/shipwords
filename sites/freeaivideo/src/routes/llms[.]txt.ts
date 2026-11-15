import { llmsTxt } from '@shipwords/core/seo';
import { createFileRoute } from '@tanstack/react-router';
import {
  creditPackPrice,
  creditPacks,
  modelCount,
  registrationVoucherDays,
  trialModels,
} from '~/site/public-offer';
import { DEFAULT_TRIAL_MODEL_ID } from '~/video-options';
import site from '../../site.config';

const trialSettings = trialModels
  .map(({ name, resolution, duration }) => `${name} at ${resolution} for ${duration} seconds`)
  .join(', ');
const defaultTrialModel = trialModels.find(({ id }) => id === DEFAULT_TRIAL_MODEL_ID);
const packPrices = creditPacks
  .map((pack) => `${creditPackPrice(pack)} for ${pack.credits.toLocaleString('en-US')} credits`)
  .join(', ');
const summary = [
  `Free AI Video turns a prompt or reference photo into a short video. It offers ${modelCount} models for credit generation. ${trialModels.length} also support a free trial with fixed settings (${trialSettings}).`,
  defaultTrialModel ? `${defaultTrialModel.name} is selected by default for trials.` : '',
  `When daily trials are available, the device limit is ${site.guest.dailyPerDevice} per day, shared before and after sign-in. It resets at 00:00 UTC. Network and shared daily limits apply. Eligible new verified accounts may receive one separate registration trial voucher valid for ${registrationVoucherDays} days from registration, subject to daily allocation.`,
  'An accepted free request counts toward the daily trial or uses the voucher, even if it later fails or is canceled. Some models require a reference photo.',
  `The generator shows the credit cost before you submit a request. It depends on the model, resolution and duration. One-time packs cost ${packPrices}.`,
  creditPacks.every((pack) => pack.expiresDays === null) ? 'Purchased credits never expire.' : '',
  'Credits already issued keep their original terms. Free AI Video adds no watermark and charges no separate export fee. Credit returns for generation depend on confirmed provider billing. The refund policy covers credit pack purchases.',
]
  .filter(Boolean)
  .join(' ');

export const Route = createFileRoute('/llms.txt')({
  server: {
    handlers: {
      GET: () =>
        llmsTxt(
          site,
          // Keep model eligibility, trial settings and pack prices tied to the public offer.
          summary,
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
                'Free trials, registration vouchers, watermark-free downloads, models, settings, and credit returns.',
            },
            {
              title: 'Pricing',
              path: '/#pricing',
              description: 'One-time credit packs for additional videos.',
            },
            {
              title: 'Seedance 2.5 Video Generation',
              path: '/seedance-2-5-free',
              description:
                'Seedance 2.5 requires credits. See its supported settings and the models available for a free trial.',
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
              title: 'Generated Video Examples',
              path: '/#cases',
              description: 'See real clips and prompts from text-to-video and image-to-video requests.',
            },
            {
              title: 'Credit Packs and Free Trials in Markdown',
              path: '/pricing.md',
              description: 'Read pack prices, credit amounts, expiry, trial rules, and credit returns.',
            },
            {
              title: 'Agent API and MCP Guide in Markdown',
              path: '/agent-api.md',
              description:
                'Read the paid API and MCP setup, model options, upload, job, and retry instructions.',
            },
            {
              title: 'Refund Policy',
              path: '/refunds',
              description:
                'Read the rules for credit pack purchase refunds and credit returns for generation.',
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
            },
            {
              title: 'Earth Zoom Out Video Generator',
              path: '/earth-zoom-out-video-generator',
              description:
                'A photo-to-space-and-back Earth zoom out guide with editable prompts and optional single-photo input; name any target country.',
            },
            {
              title: "Tung Tung Tung Sahur AI",
              path: "/tung-tung-tung-sahur-ai",
              description:
                "The Indonesian brainrot stick-man meme guide with editable prompts and optional single-photo input.",
            },
            {
              title: "Bulin 47 AI",
              path: "/bulin-47-ai",
              description:
                "A Dame Hombro shoulder-shake dance guide with editable prompts and optional single-photo input.",
            },
            {
              title: "Ozil Goal AI",
              path: "/ozil-goal-ai",
              description:
                "A chip-collision-finish football goal meme guide with editable prompts and optional single-photo input.",
            },
            {
              title: "Raindance AI",
              path: "/raindance-ai",
              description:
                "A lean-and-rock dance challenge guide with editable prompts and optional one- or two-photo input.",
            },
            {
              title: "Smalltown Boy AI",
              path: "/smalltown-boy-ai",
              description:
                "An 80s photo-dance trend guide with editable prompts and two-photo input.",
            },
            {
              title: "Alors On Danse AI",
              path: "/alors-on-danse-ai",
              description:
                "A white-studio keyboard duo meme guide with editable prompts and two-photo input.",
            },
            {
              title: "Cheba Man Dance AI",
              path: "/cheba-man-dance-ai",
              description:
                "A red-stage Tecktonik revival dance guide with editable prompts and optional single-photo input.",
            },
            {
              title: "Tiny Desk AI",
              path: "/tiny-desk-ai",
              description:
                "An office-concert band meme guide with editable prompts and up-to-five-photo input.",
            },
            {
              title: "Venom Makeup AI",
              path: "/venom-makeup-ai",
              description:
                "A symbiote half-face transformation guide with editable prompts and single-photo input.",
            },
            {
              title: "What Stop Sign AI",
              path: "/what-stop-sign-ai",
              description:
                "A night traffic-stop misunderstanding meme guide with editable prompts and optional single-photo input.",
            },
            {
              title: "Hotel Lobby AI",
              path: "/hotel-lobby-ai",
              description:
                "An orange-studio hanging-mic duet guide with editable prompts and two-photo input.",
            },
            {
              title: "58th Floor AI",
              path: "/58th-floor-ai",
              description:
                "A teal-studio verse-trading duet guide with editable prompts and two-photo input.",
            },
            {
              title: "Crazy Frog AI",
              path: "/crazy-frog-ai",
              description:
                "An invisible-motorcycle pose chase guide with editable prompts and full-body photo input.",
            },
            {
              title: "Spooky Scary Skeletons AI",
              path: "/spooky-scary-skeletons-ai",
              description:
                "A Halloween skeleton dance guide with editable prompts; photos optional.",
            },
            {
              title: "Closing Door Prank AI",
              path: "/closing-door-prank-ai",
              description:
                "A countdown-sprint-squeeze prank guide with editable prompts and full-body photo input.",
            },
            {
              title: "Snow Leopard Meme AI",
              path: "/snow-leopard-meme-ai",
              description:
                "A big-eyes paws-at-you pleading meme guide with editable prompts and optional pet photo input.",
            },
            {
              title: "K/DA Firestarter AI",
              path: "/kda-firestarter-ai",
              description:
                "A neon-stage K-pop dance trend guide with editable prompts and single-photo input.",
            },
            {
              title: "Like Jennie AI",
              path: "/like-jennie-ai",
              description:
                "A slick-back hair-sweep dance challenge guide with editable prompts and single-photo input.",
            },
            {
              title: "KATSEYE Animal AI",
              path: "/katseye-animal-ai",
              description:
                "A dark-pop hair-flip and prowl-crouch dance guide with editable prompts and up-to-three-photo input.",
            },
            {
              title: "Chiikawa Dancing Nokia AI",
              path: "/chiikawa-dancing-nokia-ai",
              description:
                "A chibi phone-dance loop trend guide with editable prompts; photos optional.",
            },
          ],
        ),
    },
  },
});
