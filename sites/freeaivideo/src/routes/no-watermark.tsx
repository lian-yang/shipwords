import { pageHead } from '@shipwords/core/seo';
import { createFileRoute } from '@tanstack/react-router';
import { m } from '~/paraglide/messages.js';
import { getLocale } from '~/paraglide/runtime.js';
import site from '../../site.config';

// Keep this search landing page at its existing URL; copy is resolved per request.
export const Route = createFileRoute('/no-watermark')({
  head: () =>
    pageHead(site, {
      title: m.pages_watermark_meta_title({ siteName: site.name }),
      description: m.pages_watermark_meta_description(),
      path: '/no-watermark',
      image: `${site.url}/og.jpg`,
    }),
  component: WatermarkPage,
});

function WatermarkPage() {
  const entryPack = [...site.products].sort((a, b) => a.price.amount - b.price.amount)[0];
  const price = entryPack
    ? new Intl.NumberFormat(getLocale() === 'zh' ? 'zh-CN' : 'en-US', {
        style: 'currency',
        currency: entryPack.price.currency,
      }).format(entryPack.price.amount / 100)
    : null;

  return (
    <section className="content">
      <h1>{m.pages_watermark_title()}</h1>
      <p className="lead">
        {m.pages_watermark_intro()} <strong>{m.pages_watermark_clean()}</strong>
      </p>
      <p>
        <a className="button primary" href="/#tool">
          {m.pages_watermark_cta()}
        </a>
      </p>
      <h2>{m.pages_watermark_free_heading()}</h2>
      <ul>
        <li>{m.pages_watermark_free_daily({ daily: site.guest.dailyPerDevice })}</li>
        <li>{m.pages_watermark_free_download()}</li>
        <li>{m.pages_watermark_free_refunds()}</li>
        {price !== null && <li>{m.pages_watermark_free_more({ price })}</li>}
      </ul>
      <h2>{m.pages_watermark_meaning_heading()}</h2>
      <p>{m.pages_watermark_meaning_body()}</p>
      <p>
        {m.pages_watermark_model_before()} <a href="/seedance-2-5-free">{m.pages_watermark_model_link()}</a>
      </p>
    </section>
  );
}
