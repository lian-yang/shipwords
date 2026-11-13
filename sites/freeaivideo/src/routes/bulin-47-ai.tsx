import { pageHead } from '@shipwords/core/seo';
import { createFileRoute } from '@tanstack/react-router';
import { m } from '~/paraglide/messages.js';
import site from '../../site.config';

export const Route = createFileRoute('/bulin-47-ai')({
  head: () =>
    pageHead(site, {
      title: m.pages_bulin47_meta_title({ siteName: site.name }),
      description: m.pages_bulin47_meta_description(),
      path: '/bulin-47-ai',
      image: `${site.url}/og.jpg`,
      jsonLd: [
        {
          '@type': 'FAQPage',
          mainEntity: [
            { question: m.pages_bulin47_question_meaning(), answer: m.pages_bulin47_answer_meaning() },
            { question: m.pages_bulin47_question_photo(), answer: m.pages_bulin47_answer_photo() },
            { question: m.pages_bulin47_question_exact(), answer: m.pages_bulin47_answer_exact() },
            { question: m.pages_bulin47_question_free(), answer: m.pages_bulin47_answer_free() },
          ].map(({ question, answer }) => ({
            '@type': 'Question',
            name: question,
            acceptedAnswer: { '@type': 'Answer', text: answer },
          })),
        },
      ],
    }),
  component: MemePage,
});

function MemePage() {
  return (
    <section className="content">
      <h1>{m.pages_bulin47_title()}</h1>
      <p className="lead">{m.pages_bulin47_intro()}</p>
      <p>
        <a className="button primary" href="/?preset=bulin-47#tool">
          {m.pages_bulin47_generate_link()}
        </a>
      </p>
      <h2>{m.pages_bulin47_format_heading()}</h2>
      <p>{m.pages_bulin47_format_body()}</p>
      <h2>{m.pages_bulin47_make_heading()}</h2>
      <p>{m.pages_bulin47_make_body()}</p>
      <h2>{m.pages_bulin47_photo_heading()}</h2>
      <p>{m.pages_bulin47_photo_body()}</p>
      <h2>{m.pages_bulin47_prompt_heading()}</h2>
      <ul>
        <li>{m.pages_bulin47_prompt_a()}</li>
        <li>{m.pages_bulin47_prompt_b()}</li>
        <li>{m.pages_bulin47_prompt_c()}</li>
      </ul>
      <p>{m.pages_bulin47_prompt_note()}</p>
      <h2>{m.pages_bulin47_questions_heading()}</h2>
      <p><strong>{m.pages_bulin47_question_meaning()}</strong> {m.pages_bulin47_answer_meaning()}</p>
      <p><strong>{m.pages_bulin47_question_photo()}</strong> {m.pages_bulin47_answer_photo()}</p>
      <p><strong>{m.pages_bulin47_question_exact()}</strong> {m.pages_bulin47_answer_exact()}</p>
      <p><strong>{m.pages_bulin47_question_free()}</strong> {m.pages_bulin47_answer_free()}</p>
      <p>{m.pages_bulin47_ready()} <a href="/?preset=bulin-47#tool">{m.pages_bulin47_open_generator()}</a></p>
    </section>
  );
}
