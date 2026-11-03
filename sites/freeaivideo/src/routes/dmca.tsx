import { pageHead } from '@shipwords/core/seo';
import { createFileRoute } from '@tanstack/react-router';
import { m } from '~/paraglide/messages.js';
import { LegalPage } from '~/site/legal';
import site from '../../site.config';

export const Route = createFileRoute('/dmca')({
  head: () =>
    pageHead(site, {
      title: m.legal_dmca_meta_title({ siteName: site.name }),
      description: m.legal_dmca_meta_description({ siteName: site.name }),
      path: '/dmca',
    }),
  component: DmcaPage,
});

function DmcaPage() {
  return (
    <LegalPage title={m.legal_dmca_title()} intro={m.legal_dmca_intro({ siteName: site.name })}>
      <h2>{m.legal_dmca_notice_heading()}</h2>
      <p>{m.legal_dmca_notice_body()}</p>
      <ul>
        <li>{m.legal_dmca_notice_item_1()}</li>
        <li>{m.legal_dmca_notice_item_2()}</li>
        <li>{m.legal_dmca_notice_item_3()}</li>
        <li>{m.legal_dmca_notice_item_4()}</li>
      </ul>
      <p>{m.legal_dmca_notice_after()}</p>

      <h2>{m.legal_dmca_counter_heading()}</h2>
      <p>{m.legal_dmca_counter_body()}</p>
      <ul>
        <li>{m.legal_dmca_counter_item_1()}</li>
        <li>{m.legal_dmca_counter_item_2()}</li>
      </ul>
      <p>{m.legal_dmca_counter_after()}</p>

      <h2>{m.legal_dmca_repeat_heading()}</h2>
      <p>{m.legal_dmca_repeat_body()}</p>
      <p>
        <a
          href="https://www.copyright.gov/title17/92chap5.html#512"
          target="_blank"
          rel="noopener noreferrer"
        >
          {m.legal_dmca_law_link()}
        </a>
      </p>
    </LegalPage>
  );
}
