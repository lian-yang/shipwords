import { pageHead } from '@shipwords/core/seo';
import { createFileRoute } from '@tanstack/react-router';
import { m } from '~/paraglide/messages.js';
import site from '../../site.config';

export const Route = createFileRoute('/shoulder-carry-ai')({
  head: () =>
    pageHead(site, {
      title: m.pages_shoulder_meta_title({ siteName: site.name }),
      description: m.pages_shoulder_meta_description(),
      path: '/shoulder-carry-ai',
      image: `${site.url}/og.jpg`,
      jsonLd: [
        {
          '@type': 'FAQPage',
          mainEntity: [
            { question: m.pages_shoulder_question_meaning(), answer: m.pages_shoulder_answer_meaning() },
            { question: m.pages_shoulder_question_photo(), answer: m.pages_shoulder_answer_photo() },
            { question: m.pages_shoulder_question_exact(), answer: m.pages_shoulder_answer_exact() },
            { question: m.pages_shoulder_question_free(), answer: m.pages_shoulder_answer_free() },
          ].map(({ question, answer }) => ({
            '@type': 'Question',
            name: question,
            acceptedAnswer: { '@type': 'Answer', text: answer },
          })),
        },
      ],
    }),
  component: ShoulderCarryPage,
});

function ShoulderCarryPage() {
  return (
    <section className="content">
      <h1>{m.pages_shoulder_title()}</h1>
      <p className="lead">{m.pages_shoulder_intro()}</p>
      <p>
        <a className="button primary" href="/?preset=shoulder-carry#tool">
          {m.pages_shoulder_generate_link()}
        </a>
      </p>
      <h2>{m.pages_shoulder_format_heading()}</h2>
      <p>{m.pages_shoulder_format_body()}</p>
      <h2>{m.pages_shoulder_make_heading()}</h2>
      <p>{m.pages_shoulder_make_body()}</p>
      <h2>{m.pages_shoulder_photo_heading()}</h2>
      <p>{m.pages_shoulder_photo_body()}</p>
      <h2>{m.pages_shoulder_prompt_heading()}</h2>
      <ul>
        <li>{m.pages_shoulder_prompt_a()}</li>
        <li>{m.pages_shoulder_prompt_b()}</li>
        <li>{m.pages_shoulder_prompt_c()}</li>
      </ul>
      <p>{m.pages_shoulder_prompt_note()}</p>
      <h2>{m.pages_shoulder_questions_heading()}</h2>
      <p><strong>{m.pages_shoulder_question_meaning()}</strong> {m.pages_shoulder_answer_meaning()}</p>
      <p><strong>{m.pages_shoulder_question_photo()}</strong> {m.pages_shoulder_answer_photo()}</p>
      <p><strong>{m.pages_shoulder_question_exact()}</strong> {m.pages_shoulder_answer_exact()}</p>
      <p><strong>{m.pages_shoulder_question_free()}</strong> {m.pages_shoulder_answer_free()}</p>
      <p>{m.pages_shoulder_ready()} <a href="/?preset=shoulder-carry#tool">{m.pages_shoulder_open_generator()}</a></p>
    </section>
  );
}
