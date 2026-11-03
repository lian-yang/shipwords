import { pageHead } from '@shipwords/core/seo';
import { createFileRoute } from '@tanstack/react-router';
import { m } from '~/paraglide/messages.js';
import { LegalPage } from '~/site/legal';
import site from '../../site.config';

export const Route = createFileRoute('/privacy')({
  head: () =>
    pageHead(site, {
      title: m.legal_privacy_meta_title({ siteName: site.name }),
      description: m.legal_privacy_meta_description({ siteName: site.name }),
      path: '/privacy',
    }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <LegalPage title={m.legal_privacy_title()} intro={m.legal_privacy_intro({ siteName: site.name })}>
      <h2>{m.legal_privacy_collect_heading()}</h2>
      <ul>
        <li>{m.legal_privacy_collect_account()}</li>
        <li>{m.legal_privacy_collect_content()}</li>
        <li>{m.legal_privacy_collect_payment()}</li>
        <li>{m.legal_privacy_collect_security()}</li>
      </ul>

      <h2>{m.legal_privacy_use_heading()}</h2>
      <p>{m.legal_privacy_use_body()}</p>

      <h2>{m.legal_privacy_processors_heading()}</h2>
      <p>{m.legal_privacy_processors_body()}</p>
      <p>{m.legal_privacy_processors_more()}</p>
      <p>
        {m.legal_privacy_provider_links()}{' '}
        <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">
          Cloudflare
        </a>
        {' · '}
        <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">
          Stripe
        </a>
        {' · '}
        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">
          Google
        </a>
        {' · '}
        <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">
          Resend
        </a>
      </p>

      <h2>{m.legal_privacy_access_heading()}</h2>
      <p>{m.legal_privacy_access_body()}</p>

      <h2>{m.legal_privacy_retention_heading()}</h2>
      <p>{m.legal_privacy_retention_body()}</p>
      <p>{m.legal_privacy_retention_more()}</p>

      <h2>{m.legal_privacy_cookies_heading()}</h2>
      <p>{m.legal_privacy_cookies_body()}</p>
      <p>{m.legal_privacy_cookies_more()}</p>

      <h2>{m.legal_privacy_analytics_heading()}</h2>
      <p>{m.legal_privacy_analytics_body()}</p>
      <p>{m.legal_privacy_analytics_more()}</p>
      <p>
        <a
          href="https://support.google.com/analytics/answer/6004245"
          target="_blank"
          rel="noopener noreferrer"
        >
          {m.legal_privacy_analytics_link()}
        </a>
      </p>

      <h2>{m.legal_privacy_choices_heading()}</h2>
      <p>{m.legal_privacy_choices_body()}</p>

      <h2>{m.legal_privacy_children_heading()}</h2>
      <p>{m.legal_privacy_children_body()}</p>
    </LegalPage>
  );
}
