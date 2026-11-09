import { sitemapXml } from '@shipwords/core/seo';
import { createFileRoute } from '@tanstack/react-router';
import site from '../../site.config';

// Register new indexable pages here.
export const PAGES = [
  '/',
  '/seedance-2-5-free',
  '/no-watermark',
  '/w-chews-l-nibbles',
  '/frutiger-aero-yams',
  '/fancy-cafe-ai',
  '/red-carpet-ai',
  '/mulmannan-gwangeo-ai',
  '/when-two-legends-try-to-make-coffee',
  '/paws-at-you-ai',
  '/bicep-heart-ai',
  '/epic-dunk-ai',
  '/burning-bridges-ai',
  '/tiptoeing-in-my-jordans-ai',
  '/buggin-dance-ai',
  '/dog-elevator-prank-ai',
  '/chipmunks-dance-ai',
  '/anime-star-eye-ai',
  '/api-docs',
  '/can-i-ride-dance-ai',
  '/ba-ba-ba-dance-ai',
  '/birthday-car-ai',
  '/dog-bohemian-rhapsody-ai',
  '/fish-cutting-meme-ai',
  '/pimpwalk-entrance-ai',
  '/flamingo-float-ai',
  '/snatch-back-splash-ai',
  '/tears-falling-down-filter-ai',
  '/dog-couple-dance-ai',
  '/i-love-the-smiths-ai',
  '/christmas-lights-wife-ai',
  '/i-want-wings-ai',
  '/its-my-life-dog-ai',
  '/car-alarm-ai-dance',
  '/privacy',
  '/terms',
  '/refunds',
  '/dmca',
];

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: () =>
        sitemapXml(
          site,
          PAGES.map((path) => ({ path })),
        ),
    },
  },
});
