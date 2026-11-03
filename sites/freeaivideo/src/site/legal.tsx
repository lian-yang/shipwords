import type { ReactNode } from 'react';
import { m } from '~/paraglide/messages.js';

// Shared layout for the bilingual privacy, terms, refunds and copyright pages.
// Copy lives in messages/legal; the policy date is common_legal_policy_date in messages/common.

/** Public contact address. Mail delivery is configured separately from page copy. */
export const SUPPORT_EMAIL = 'support@freeaivideo.app';

export function LegalPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <article className="legal">
      <nav aria-label={m.legal_nav_label()}>
        <p>
          <a href="/privacy">{m.legal_privacy_title()}</a>
          {' · '}
          <a href="/terms">{m.legal_terms_title()}</a>
          {' · '}
          <a href="/refunds">{m.legal_refunds_title()}</a>
          {' · '}
          <a href="/dmca">{m.legal_dmca_title()}</a>
        </p>
      </nav>
      <h1>{title}</h1>
      <p className="muted">{m.common_legal_updated({ date: m.common_legal_policy_date() })}</p>
      <p>{intro}</p>
      {children}
      <p>
        {m.common_legal_questions()} <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
    </article>
  );
}
