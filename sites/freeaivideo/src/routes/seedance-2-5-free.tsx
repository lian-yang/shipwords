import { pageHead } from '@shipwords/core/seo';
import { createFileRoute } from '@tanstack/react-router';
import { m } from '~/paraglide/messages.js';
import { getLocale } from '~/paraglide/runtime.js';
import { EditorialHeader } from '~/site/editorial-header';
import { VIDEO_OPTIONS } from '~/video-options';
import site from '../../site.config';

// The model version is explicit; this page does not claim it is the market's newest model.
export const Route = createFileRoute('/seedance-2-5-free')({
  head: () =>
    pageHead(site, {
      title: m.pages_seedance_meta_title({ siteName: site.name }),
      description: m.pages_seedance_meta_description(),
      path: '/seedance-2-5-free',
      image: `${site.url}/og.jpg`,
      jsonLd: [
        {
          '@type': 'FAQPage',
          mainEntity: [
            { question: m.pages_seedance_question_model(), answer: m.pages_seedance_answer_model() },
            { question: m.pages_seedance_question_account(), answer: m.pages_seedance_answer_account() },
            { question: m.pages_seedance_question_length(), answer: seedanceLengthAnswer() },
          ].map(({ question, answer }) => ({
            '@type': 'Question',
            name: question,
            acceptedAnswer: { '@type': 'Answer', text: answer },
          })),
        },
      ],
    }),
  component: SeedancePage,
});

function seedanceLengthAnswer() {
  const options = VIDEO_OPTIONS['seedance-2-5-v2']!.options;
  const durations = options.flatMap((option) => option.durations);
  return m.pages_seedance_answer_length({
    min: Math.min(...durations),
    max: Math.max(...durations),
    resolutions: new Intl.ListFormat(getLocale()).format(options.map((option) => option.resolution)),
  });
}

function SeedancePage() {
  return (
    <section className="content horizon-editorial">
      <EditorialHeader title={m.pages_seedance_title()}>
        <p className="lead">
          {m.pages_seedance_intro()} <strong>{m.pages_seedance_free()}</strong>{' '}
          {m.pages_seedance_limits({ daily: site.guest.dailyPerDevice })}
        </p>
        <p className="editorial-actions">
          <a className="button primary" href="/#tool">
            {m.pages_seedance_cta()}
          </a>
        </p>
      </EditorialHeader>
      <h2>{m.pages_seedance_version_heading()}</h2>
      <p>{m.pages_seedance_version_body()}</p>
      <h2>{m.pages_seedance_free_heading()}</h2>
      <ul>
        <li>{m.pages_seedance_free_daily({ daily: site.guest.dailyPerDevice })}</li>
        <li>{m.pages_seedance_free_length()}</li>
        <li>{m.pages_seedance_free_photo()}</li>
        <li>{m.pages_seedance_free_refunds()}</li>
      </ul>
      <h2>{m.pages_seedance_questions_heading()}</h2>
      <p>
        <strong>{m.pages_seedance_question_model()}</strong> {m.pages_seedance_answer_model()}
      </p>
      <p>
        <strong>{m.pages_seedance_question_account()}</strong> {m.pages_seedance_answer_account()}
      </p>
      <p>
        <strong>{m.pages_seedance_question_length()}</strong> {seedanceLengthAnswer()}
      </p>
      <p>
        {m.pages_seedance_ready()} <a href="/#tool">{m.pages_seedance_generate_link()}</a>
      </p>
    </section>
  );
}
