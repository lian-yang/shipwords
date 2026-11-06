import { pageHead } from '@shipwords/core/seo';
import { createFileRoute } from '@tanstack/react-router';
import { m } from '~/paraglide/messages.js';
import site from '../../site.config';

export const Route = createFileRoute('/paws-at-you-ai')({
  head: () =>
    pageHead(site, {
      title: m.pages_paws_meta_title({ siteName: site.name }),
      description: m.pages_paws_meta_description(),
      path: '/paws-at-you-ai',
      image: `${site.url}/og.jpg`,
      jsonLd: [
        {
          '@type': 'FAQPage',
          mainEntity: [
            { question: m.pages_paws_question_meaning(), answer: m.pages_paws_answer_meaning() },
            { question: m.pages_paws_question_photo(), answer: m.pages_paws_answer_photo() },
            { question: m.pages_paws_question_exact(), answer: m.pages_paws_answer_exact() },
            { question: m.pages_paws_question_free(), answer: m.pages_paws_answer_free() },
          ].map(({ question, answer }) => ({
            '@type': 'Question',
            name: question,
            acceptedAnswer: { '@type': 'Answer', text: answer },
          })),
        },
      ],
    }),
  component: PawsPage,
});

function PawsPage() {
  return (
    <section className="content">
      <h1>{m.pages_paws_title()}</h1>
      <p className="lead">{m.pages_paws_intro()}</p>
      <p>
        <a className="button primary" href="/?preset=paws-at-you#tool">
          {m.pages_paws_generate_link()}
        </a>
      </p>
      <h2>{m.pages_paws_format_heading()}</h2>
      <p>{m.pages_paws_format_body()}</p>
      <h2>{m.pages_paws_make_heading()}</h2>
      <p>{m.pages_paws_make_body()}</p>
      <h2>{m.pages_paws_photo_heading()}</h2>
      <p>{m.pages_paws_photo_body()}</p>
      <h2>{m.pages_paws_prompt_heading()}</h2>
      <ul>
        <li>{m.pages_paws_prompt_close()}</li>
        <li>{m.pages_paws_prompt_snow()}</li>
        <li>{m.pages_paws_prompt_blanket()}</li>
      </ul>
      <p>{m.pages_paws_prompt_note()}</p>
      <h2>{m.pages_paws_questions_heading()}</h2>
      <p><strong>{m.pages_paws_question_meaning()}</strong> {m.pages_paws_answer_meaning()}</p>
      <p><strong>{m.pages_paws_question_photo()}</strong> {m.pages_paws_answer_photo()}</p>
      <p><strong>{m.pages_paws_question_exact()}</strong> {m.pages_paws_answer_exact()}</p>
      <p><strong>{m.pages_paws_question_free()}</strong> {m.pages_paws_answer_free()}</p>
      <p>{m.pages_paws_ready()} <a href="/?preset=paws-at-you#tool">{m.pages_paws_open_generator()}</a></p>
    </section>
  );
}
