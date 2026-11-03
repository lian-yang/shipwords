import { pageHead } from '@shipwords/core/seo';
import { createFileRoute } from '@tanstack/react-router';
import { m } from '~/paraglide/messages.js';
import site from '../../site.config';

// Trend explainer page: the slang pair is factual background (Know Your Meme, Oct 2026);
// the page does not claim the trend was created here or that it is the market's newest model.
export const Route = createFileRoute('/w-chews-l-nibbles')({
  head: () =>
    pageHead(site, {
      title: m.pages_wchews_meta_title({ siteName: site.name }),
      description: m.pages_wchews_meta_description(),
      path: '/w-chews-l-nibbles',
      image: `${site.url}/og.jpg`,
      jsonLd: [
        {
          '@type': 'FAQPage',
          mainEntity: [
            { question: m.pages_wchews_question_meaning(), answer: m.pages_wchews_answer_meaning() },
            { question: m.pages_wchews_question_origin(), answer: m.pages_wchews_answer_origin() },
            { question: m.pages_wchews_question_make(), answer: m.pages_wchews_answer_make() },
            { question: m.pages_wchews_question_free(), answer: m.pages_wchews_answer_free() },
          ].map(({ question, answer }) => ({
            '@type': 'Question',
            name: question,
            acceptedAnswer: { '@type': 'Answer', text: answer },
          })),
        },
      ],
    }),
  component: WChewsPage,
});

function WChewsPage() {
  return (
    <section className="content">
      <h1>{m.pages_wchews_title()}</h1>
      <p className="lead">{m.pages_wchews_intro()}</p>
      <p>
        <a className="button primary" href="/#tool">
          {m.pages_wchews_generate_link()}
        </a>
      </p>
      <h2>{m.pages_wchews_meaning_w_heading()}</h2>
      <p>{m.pages_wchews_meaning_w_body()}</p>
      <h2>{m.pages_wchews_meaning_l_heading()}</h2>
      <p>{m.pages_wchews_meaning_l_body()}</p>
      <h2>{m.pages_wchews_origin_heading()}</h2>
      <p>{m.pages_wchews_origin_body()}</p>
      <h2>{m.pages_wchews_format_heading()}</h2>
      <p>{m.pages_wchews_format_body()}</p>
      <h2>{m.pages_wchews_make_heading()}</h2>
      <p>{m.pages_wchews_make_body()}</p>
      <h2>{m.pages_wchews_prompt_heading()}</h2>
      <ul>
        <li>{m.pages_wchews_prompt_w()}</li>
        <li>{m.pages_wchews_prompt_l()}</li>
        <li>{m.pages_wchews_prompt_family()}</li>
      </ul>
      <p>{m.pages_wchews_prompt_note()}</p>
      <h2>{m.pages_wchews_questions_heading()}</h2>
      <p>
        <strong>{m.pages_wchews_question_meaning()}</strong> {m.pages_wchews_answer_meaning()}
      </p>
      <p>
        <strong>{m.pages_wchews_question_origin()}</strong> {m.pages_wchews_answer_origin()}
      </p>
      <p>
        <strong>{m.pages_wchews_question_make()}</strong> {m.pages_wchews_answer_make()}
      </p>
      <p>
        <strong>{m.pages_wchews_question_free()}</strong> {m.pages_wchews_answer_free()}
      </p>
      <p>
        {m.pages_wchews_ready()} <a href="/#tool">{m.pages_wchews_generate_link()}</a>
      </p>
    </section>
  );
}
