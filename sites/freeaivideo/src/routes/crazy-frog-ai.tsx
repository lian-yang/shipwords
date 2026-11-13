import { pageHead } from '@shipwords/core/seo';
import { createFileRoute } from '@tanstack/react-router';
import { m } from '~/paraglide/messages.js';
import site from '../../site.config';

export const Route = createFileRoute('/crazy-frog-ai')({
  head: () =>
    pageHead(site, {
      title: m.pages_crazyfrog_meta_title({ siteName: site.name }),
      description: m.pages_crazyfrog_meta_description(),
      path: '/crazy-frog-ai',
      image: `${site.url}/og.jpg`,
      jsonLd: [
        {
          '@type': 'FAQPage',
          mainEntity: [
            { question: m.pages_crazyfrog_question_meaning(), answer: m.pages_crazyfrog_answer_meaning() },
            { question: m.pages_crazyfrog_question_photo(), answer: m.pages_crazyfrog_answer_photo() },
            { question: m.pages_crazyfrog_question_exact(), answer: m.pages_crazyfrog_answer_exact() },
            { question: m.pages_crazyfrog_question_free(), answer: m.pages_crazyfrog_answer_free() },
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
      <h1>{m.pages_crazyfrog_title()}</h1>
      <p className="lead">{m.pages_crazyfrog_intro()}</p>
      <p>
        <a className="button primary" href="/?preset=crazy-frog#tool">
          {m.pages_crazyfrog_generate_link()}
        </a>
      </p>
      <h2>{m.pages_crazyfrog_format_heading()}</h2>
      <p>{m.pages_crazyfrog_format_body()}</p>
      <h2>{m.pages_crazyfrog_make_heading()}</h2>
      <p>{m.pages_crazyfrog_make_body()}</p>
      <h2>{m.pages_crazyfrog_photo_heading()}</h2>
      <p>{m.pages_crazyfrog_photo_body()}</p>
      <h2>{m.pages_crazyfrog_prompt_heading()}</h2>
      <ul>
        <li>{m.pages_crazyfrog_prompt_a()}</li>
        <li>{m.pages_crazyfrog_prompt_b()}</li>
        <li>{m.pages_crazyfrog_prompt_c()}</li>
      </ul>
      <p>{m.pages_crazyfrog_prompt_note()}</p>
      <h2>{m.pages_crazyfrog_questions_heading()}</h2>
      <p><strong>{m.pages_crazyfrog_question_meaning()}</strong> {m.pages_crazyfrog_answer_meaning()}</p>
      <p><strong>{m.pages_crazyfrog_question_photo()}</strong> {m.pages_crazyfrog_answer_photo()}</p>
      <p><strong>{m.pages_crazyfrog_question_exact()}</strong> {m.pages_crazyfrog_answer_exact()}</p>
      <p><strong>{m.pages_crazyfrog_question_free()}</strong> {m.pages_crazyfrog_answer_free()}</p>
      <p>{m.pages_crazyfrog_ready()} <a href="/?preset=crazy-frog#tool">{m.pages_crazyfrog_open_generator()}</a></p>
    </section>
  );
}
