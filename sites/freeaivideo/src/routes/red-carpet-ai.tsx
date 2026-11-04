import { pageHead } from '@shipwords/core/seo';
import { createFileRoute } from '@tanstack/react-router';
import { m } from '~/paraglide/messages.js';
import site from '../../site.config';

// Trend explainer page (contested trend, free-wedge angle): the format background is
// factual (trend trackers logged a fresh spike in early November 2026); prompts describe
// generic premiere scenes and the note keeps the star = the user's own photo, so no
// real-person likeness and no specific event trademarks are involved.
export const Route = createFileRoute('/red-carpet-ai')({
  head: () =>
    pageHead(site, {
      title: m.pages_redcarpet_meta_title({ siteName: site.name }),
      description: m.pages_redcarpet_meta_description(),
      path: '/red-carpet-ai',
      image: `${site.url}/og.jpg`,
      jsonLd: [
        {
          '@type': 'FAQPage',
          mainEntity: [
            { question: m.pages_redcarpet_question_meaning(), answer: m.pages_redcarpet_answer_meaning() },
            { question: m.pages_redcarpet_question_spike(), answer: m.pages_redcarpet_answer_spike() },
            { question: m.pages_redcarpet_question_make(), answer: m.pages_redcarpet_answer_make() },
            { question: m.pages_redcarpet_question_free(), answer: m.pages_redcarpet_answer_free() },
          ].map(({ question, answer }) => ({
            '@type': 'Question',
            name: question,
            acceptedAnswer: { '@type': 'Answer', text: answer },
          })),
        },
      ],
    }),
  component: RedCarpetPage,
});

function RedCarpetPage() {
  return (
    <section className="content">
      <h1>{m.pages_redcarpet_title()}</h1>
      <p className="lead">{m.pages_redcarpet_intro()}</p>
      <p>
        <a className="button primary" href="/#tool">
          {m.pages_redcarpet_generate_link()}
        </a>
      </p>
      <h2>{m.pages_redcarpet_meaning_heading()}</h2>
      <p>{m.pages_redcarpet_meaning_body()}</p>
      <h2>{m.pages_redcarpet_spike_heading()}</h2>
      <p>{m.pages_redcarpet_spike_body()}</p>
      <h2>{m.pages_redcarpet_format_heading()}</h2>
      <p>{m.pages_redcarpet_format_body()}</p>
      <h2>{m.pages_redcarpet_make_heading()}</h2>
      <p>{m.pages_redcarpet_make_body()}</p>
      <h2>{m.pages_redcarpet_prompt_heading()}</h2>
      <ul>
        <li>{m.pages_redcarpet_prompt_1()}</li>
        <li>{m.pages_redcarpet_prompt_2()}</li>
        <li>{m.pages_redcarpet_prompt_3()}</li>
      </ul>
      <p>{m.pages_redcarpet_prompt_note()}</p>
      <h2>{m.pages_redcarpet_questions_heading()}</h2>
      <p>
        <strong>{m.pages_redcarpet_question_meaning()}</strong> {m.pages_redcarpet_answer_meaning()}
      </p>
      <p>
        <strong>{m.pages_redcarpet_question_spike()}</strong> {m.pages_redcarpet_answer_spike()}
      </p>
      <p>
        <strong>{m.pages_redcarpet_question_make()}</strong> {m.pages_redcarpet_answer_make()}
      </p>
      <p>
        <strong>{m.pages_redcarpet_question_free()}</strong> {m.pages_redcarpet_answer_free()}
      </p>
      <p>
        {m.pages_redcarpet_ready()} <a href="/#tool">{m.pages_redcarpet_generate_link()}</a>
      </p>
    </section>
  );
}
