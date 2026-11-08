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
