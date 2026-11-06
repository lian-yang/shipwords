import { pageHead } from '@shipwords/core/seo';
import { createFileRoute } from '@tanstack/react-router';
import { m } from '~/paraglide/messages.js';
import site from '../../site.config';

// Public format reference: https://vismuse.com/mulmannan-gwangeo-ai.
// The prompts below are original suggestions, not footage or a motion-locked preset.
export const Route = createFileRoute('/mulmannan-gwangeo-ai')({
  head: () =>
    pageHead(site, {
      title: m.pages_mulmannan_meta_title({ siteName: site.name }),
      description: m.pages_mulmannan_meta_description(),
      path: '/mulmannan-gwangeo-ai',
      image: `${site.url}/og.jpg`,
      jsonLd: [
        {
          '@type': 'FAQPage',
          mainEntity: [
            { question: m.pages_mulmannan_question_format(), answer: m.pages_mulmannan_answer_format() },
            { question: m.pages_mulmannan_question_photo(), answer: m.pages_mulmannan_answer_photo() },
            { question: m.pages_mulmannan_question_exact(), answer: m.pages_mulmannan_answer_exact() },
            { question: m.pages_mulmannan_question_free(), answer: m.pages_mulmannan_answer_free() },
          ].map(({ question, answer }) => ({
            '@type': 'Question',
            name: question,
            acceptedAnswer: { '@type': 'Answer', text: answer },
          })),
        },
      ],
    }),
  component: MulmannanPage,
});

function MulmannanPage() {
  return (
    <section className="content">
      <h1>{m.pages_mulmannan_title()}</h1>
      <p className="lead">{m.pages_mulmannan_intro()}</p>
      <p>
        <a className="button primary" href="/?preset=mulmannan-floor#tool">
          {m.pages_mulmannan_generate_link()}
        </a>
      </p>
      <h2>{m.pages_mulmannan_format_heading()}</h2>
      <p>{m.pages_mulmannan_format_body()}</p>
      <h2>{m.pages_mulmannan_make_heading()}</h2>
      <p>{m.pages_mulmannan_make_body()}</p>
      <h2>{m.pages_mulmannan_prompt_heading()}</h2>
      <ul>
        <li>{m.pages_mulmannan_prompt_solo()}</li>
        <li>{m.pages_mulmannan_prompt_group()}</li>
        <li>{m.pages_mulmannan_prompt_reaction()}</li>
      </ul>
      <p>{m.pages_mulmannan_prompt_note()}</p>
      <h2>{m.pages_mulmannan_tips_heading()}</h2>
      <p>{m.pages_mulmannan_tips_body()}</p>
      <h2>{m.pages_mulmannan_questions_heading()}</h2>
      <p>
        <strong>{m.pages_mulmannan_question_format()}</strong> {m.pages_mulmannan_answer_format()}
      </p>
      <p>
        <strong>{m.pages_mulmannan_question_photo()}</strong> {m.pages_mulmannan_answer_photo()}
      </p>
      <p>
        <strong>{m.pages_mulmannan_question_exact()}</strong> {m.pages_mulmannan_answer_exact()}
      </p>
      <p>
        <strong>{m.pages_mulmannan_question_free()}</strong> {m.pages_mulmannan_answer_free()}
      </p>
      <p>
        {m.pages_mulmannan_ready()} <a href="/?preset=mulmannan-floor#tool">{m.pages_mulmannan_open_generator()}</a>
      </p>
    </section>
  );
}
