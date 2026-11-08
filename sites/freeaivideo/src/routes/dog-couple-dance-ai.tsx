import { pageHead } from '@shipwords/core/seo';
import { createFileRoute } from '@tanstack/react-router';
import { m } from '~/paraglide/messages.js';
import site from '../../site.config';

export const Route = createFileRoute('/dog-couple-dance-ai')({
  head: () =>
    pageHead(site, {
      title: m.pages_dogcouple_meta_title({ siteName: site.name }),
      description: m.pages_dogcouple_meta_description(),
      path: '/dog-couple-dance-ai',
      image: `${site.url}/og.jpg`,
      jsonLd: [
        {
          '@type': 'FAQPage',
          mainEntity: [
            { question: m.pages_dogcouple_question_meaning(), answer: m.pages_dogcouple_answer_meaning() },
            { question: m.pages_dogcouple_question_photo(), answer: m.pages_dogcouple_answer_photo() },
            { question: m.pages_dogcouple_question_exact(), answer: m.pages_dogcouple_answer_exact() },
            { question: m.pages_dogcouple_question_free(), answer: m.pages_dogcouple_answer_free() },
          ].map(({ question, answer }) => ({
            '@type': 'Question',
            name: question,
            acceptedAnswer: { '@type': 'Answer', text: answer },
          })),
        },
      ],
    }),
  component: DogCoupleDancePage,
});

function DogCoupleDancePage() {
  return (
    <section className="content">
      <h1>{m.pages_dogcouple_title()}</h1>
      <p className="lead">{m.pages_dogcouple_intro()}</p>
      <p>
        <a className="button primary" href="/?preset=dog-couple-dance#tool">
          {m.pages_dogcouple_generate_link()}
        </a>
      </p>
      <h2>{m.pages_dogcouple_format_heading()}</h2>
      <p>{m.pages_dogcouple_format_body()}</p>
      <h2>{m.pages_dogcouple_make_heading()}</h2>
      <p>{m.pages_dogcouple_make_body()}</p>
      <h2>{m.pages_dogcouple_photo_heading()}</h2>
      <p>{m.pages_dogcouple_photo_body()}</p>
      <h2>{m.pages_dogcouple_prompt_heading()}</h2>
      <ul>
        <li>{m.pages_dogcouple_prompt_a()}</li>
        <li>{m.pages_dogcouple_prompt_b()}</li>
        <li>{m.pages_dogcouple_prompt_c()}</li>
      </ul>
      <p>{m.pages_dogcouple_prompt_note()}</p>
      <h2>{m.pages_dogcouple_questions_heading()}</h2>
      <p><strong>{m.pages_dogcouple_question_meaning()}</strong> {m.pages_dogcouple_answer_meaning()}</p>
      <p><strong>{m.pages_dogcouple_question_photo()}</strong> {m.pages_dogcouple_answer_photo()}</p>
      <p><strong>{m.pages_dogcouple_question_exact()}</strong> {m.pages_dogcouple_answer_exact()}</p>
      <p><strong>{m.pages_dogcouple_question_free()}</strong> {m.pages_dogcouple_answer_free()}</p>
      <p>{m.pages_dogcouple_ready()} <a href="/?preset=dog-couple-dance#tool">{m.pages_dogcouple_open_generator()}</a></p>
    </section>
  );
}
