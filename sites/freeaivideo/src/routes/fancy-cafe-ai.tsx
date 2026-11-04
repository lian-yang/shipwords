import { pageHead } from '@shipwords/core/seo';
import { createFileRoute } from '@tanstack/react-router';
import { m } from '~/paraglide/messages.js';
import site from '../../site.config';

// Trend explainer page: the meme background is factual (Know Your Meme, Nov 2026);
// prompts describe original scenes and characters, and the note tells users to add
// their own audio instead of using the original viral sound recording.
export const Route = createFileRoute('/fancy-cafe-ai')({
  head: () =>
    pageHead(site, {
      title: m.pages_fancycafe_meta_title({ siteName: site.name }),
      description: m.pages_fancycafe_meta_description(),
      path: '/fancy-cafe-ai',
      image: `${site.url}/og.jpg`,
      jsonLd: [
        {
          '@type': 'FAQPage',
          mainEntity: [
            { question: m.pages_fancycafe_question_meaning(), answer: m.pages_fancycafe_answer_meaning() },
            { question: m.pages_fancycafe_question_origin(), answer: m.pages_fancycafe_answer_origin() },
            { question: m.pages_fancycafe_question_make(), answer: m.pages_fancycafe_answer_make() },
            { question: m.pages_fancycafe_question_free(), answer: m.pages_fancycafe_answer_free() },
          ].map(({ question, answer }) => ({
            '@type': 'Question',
            name: question,
            acceptedAnswer: { '@type': 'Answer', text: answer },
          })),
        },
      ],
    }),
  component: FancyCafePage,
});

function FancyCafePage() {
  return (
    <section className="content">
      <h1>{m.pages_fancycafe_title()}</h1>
      <p className="lead">{m.pages_fancycafe_intro()}</p>
      <p>
        <a className="button primary" href="/#tool">
          {m.pages_fancycafe_generate_link()}
        </a>
      </p>
      <h2>{m.pages_fancycafe_meaning_heading()}</h2>
      <p>{m.pages_fancycafe_meaning_body()}</p>
      <h2>{m.pages_fancycafe_origin_heading()}</h2>
      <p>{m.pages_fancycafe_origin_body()}</p>
      <h2>{m.pages_fancycafe_format_heading()}</h2>
      <p>{m.pages_fancycafe_format_body()}</p>
      <h2>{m.pages_fancycafe_make_heading()}</h2>
      <p>{m.pages_fancycafe_make_body()}</p>
      <h2>{m.pages_fancycafe_prompt_heading()}</h2>
      <ul>
        <li>{m.pages_fancycafe_prompt_1()}</li>
        <li>{m.pages_fancycafe_prompt_2()}</li>
        <li>{m.pages_fancycafe_prompt_3()}</li>
      </ul>
      <p>{m.pages_fancycafe_prompt_note()}</p>
      <h2>{m.pages_fancycafe_questions_heading()}</h2>
      <p>
        <strong>{m.pages_fancycafe_question_meaning()}</strong> {m.pages_fancycafe_answer_meaning()}
      </p>
      <p>
        <strong>{m.pages_fancycafe_question_origin()}</strong> {m.pages_fancycafe_answer_origin()}
      </p>
      <p>
        <strong>{m.pages_fancycafe_question_make()}</strong> {m.pages_fancycafe_answer_make()}
      </p>
      <p>
        <strong>{m.pages_fancycafe_question_free()}</strong> {m.pages_fancycafe_answer_free()}
      </p>
      <p>
        {m.pages_fancycafe_ready()} <a href="/#tool">{m.pages_fancycafe_generate_link()}</a>
      </p>
    </section>
  );
}
