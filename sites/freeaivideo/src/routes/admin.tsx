import { pageHead } from '@shipwords/core/seo';
import { createFileRoute } from '@tanstack/react-router';
import { m } from '~/paraglide/messages.js';
import { AdminPanel } from '~/site/admin';
import site from '../../site.config';

// Internal stats page; the data endpoint answers 404 to anyone but ADMIN_EMAIL, so this page shows
// the denied text for everyone else. noindex keeps it out of search.
export const Route = createFileRoute('/admin')({
  head: () =>
    pageHead(site, {
      title: m.admin_meta_title({ siteName: site.name }),
      description: m.admin_meta_description(),
      path: '/admin',
      noindex: true,
    }),
  component: () => (
    <section className="admin page">
      <AdminPanel />
    </section>
  ),
});
