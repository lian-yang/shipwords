import { pageHead } from '@shipwords/core/seo';
import { createFileRoute } from '@tanstack/react-router';
import { m } from '~/paraglide/messages.js';
import site from '../../site.config';

export const Route = createFileRoute('/chipmunks-dance-ai')({
  head: () =>
    pageHead(site, {
      title: m.pages_chipmunks_meta_title({ siteName: site.name }),
      description: m.pages_chipmunks_meta_description(),
      path: '/chipmunks-dance-ai',
      image: `${site.url}/og.jpg`,
      jsonLd: [
        {
          '@type': 'FAQPage',
          mainEntity: [
            { question: m.pages_chipmunks_question_meaning(), answer: m.pages_chipmunks_answer_meaning() },
            { question: m.pages_chipmunks_question_photo(), answer: m.pages_chipmunks_answer_photo() },
            { question: m.pages_chipmunks_question_exact(), answer: m.pages_chipmunks_answer_exact() },
            { question: m.pages_chipmunks_question_free(), answer: m.pages_chipmunks_answer_free() },
          ].map(({ question, answer }) => ({
            '@type': 'Question',
            name: question,
            acceptedAnswer: { '@type': 'Answer', text: answer },
          })),
        },
      ],
    }),
  component: ChipmunksDancePage,
});

function ChipmunksDancePage() {
  return (
    <section className="content">
      <h1>{m.pages_chipmunks_title()}</h1>
      <p className="lead">{m.pages_chipmunks_intro()}</p>
      <p>
        <a className="button primary" href="/?preset=chipmunks-dance#tool">
          {m.pages_chipmunks_generate_link()}
        </a>
      </p>
      <h2>{m.pages_chipmunks_format_heading()}</h2>
      <p>{m.pages_chipmunks_format_body()}</p>
      <h2>{m.pages_chipmunks_make_heading()}</h2>
      <p>{m.pages_chipmunks_make_body()}</p>
      <h2>{m.pages_chipmunks_photo_heading()}</h2>
      <p>{m.pages_chipmunks_photo_body()}</p>
      <h2>{m.pages_chipmunks_prompt_heading()}</h2>
      <ul>
        <li>{m.pages_chipmunks_prompt_a()}</li>
        <li>{m.pages_chipmunks_prompt_b()}</li>
        <li>{m.pages_chipmunks_prompt_c()}</li>
      </ul>
      <p>{m.pages_chipmunks_prompt_note()}</p>
      <h2>{m.pages_chipmunks_questions_heading()}</h2>
      <p><strong>{m.pages_chipmunks_question_meaning()}</strong> {m.pages_chipmunks_answer_meaning()}</p>
      <p><strong>{m.pages_chipmunks_question_photo()}</strong> {m.pages_chipmunks_answer_photo()}</p>
      <p><strong>{m.pages_chipmunks_question_exact()}</strong> {m.pages_chipmunks_answer_exact()}</p>
      <p><strong>{m.pages_chipmunks_question_free()}</strong> {m.pages_chipmunks_answer_free()}</p>
      <p>{m.pages_chipmunks_ready()} <a href="/?preset=chipmunks-dance#tool">{m.pages_chipmunks_open_generator()}</a></p>
    </section>
  );
}
