import { sitemapXml } from '@shipwords/core/seo';
import { createFileRoute } from '@tanstack/react-router';
import site from '../../site.config';

// Register new indexable pages here.
export const PAGES = ['/', '/seedance-2-5-free', '/no-watermark', '/w-chews-l-nibbles', '/frutiger-aero-yams', '/fancy-cafe-ai', '/privacy', '/terms', '/refunds', '/dmca'];

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
