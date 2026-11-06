import { pageHead } from '@shipwords/core/seo';
import { createFileRoute } from '@tanstack/react-router';
import { AdminPanel } from '~/site/admin';
import site from '../../site.config';

// Internal stats page in Chinese regardless of the site locale; the data endpoint answers 404 to
// anyone but ADMIN_EMAIL, so this page shows the denied text for everyone else. noindex.
export const Route = createFileRoute('/admin')({
  head: () =>
    pageHead(site, {
      title: `管理后台 — ${site.name}`,
      description: '站内数据统计。',
      path: '/admin',
      noindex: true,
    }),
  component: () => (
    <section className="admin page">
      <AdminPanel />
    </section>
  ),
});
