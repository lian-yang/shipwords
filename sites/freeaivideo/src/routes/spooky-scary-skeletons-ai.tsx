import { pageHead } from '@shipwords/core/seo';
import { createFileRoute } from '@tanstack/react-router';
import { m } from '~/paraglide/messages.js';
import site from '../../site.config';

export const Route = createFileRoute('/spooky-scary-skeletons-ai')({
  head: () =>
    pageHead(site, {
      title: m.pages_skeletons_meta_title({ siteName: site.name }),
      description: m.pages_skeletons_meta_description(),
      path: '/spooky-scary-skeletons-ai',
      image: `${site.url}/og.jpg`,
      jsonLd: [
        {
          '@type': 'FAQPage',
          mainEntity: [
            { question: m.pages_skeletons_question_meaning(), answer: m.pages_skeletons_answer_meaning() },
            { question: m.pages_skeletons_question_photo(), answer: m.pages_skeletons_answer_photo() },
            { question: m.pages_skeletons_question_exact(), answer: m.pages_skeletons_answer_exact() },
            { question: m.pages_skeletons_question_free(), answer: m.pages_skeletons_answer_free() },
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
      <h1>{m.pages_skeletons_title()}</h1>
      <p className="lead">{m.pages_skeletons_intro()}</p>
      <p>
        <a className="button primary" href="/?preset=spooky-skeletons#tool">
          {m.pages_skeletons_generate_link()}
        </a>
      </p>
      <h2>{m.pages_skeletons_format_heading()}</h2>
      <p>{m.pages_skeletons_format_body()}</p>
      <h2>{m.pages_skeletons_make_heading()}</h2>
      <p>{m.pages_skeletons_make_body()}</p>
      <h2>{m.pages_skeletons_photo_heading()}</h2>
      <p>{m.pages_skeletons_photo_body()}</p>
      <h2>{m.pages_skeletons_prompt_heading()}</h2>
      <ul>
        <li>{m.pages_skeletons_prompt_a()}</li>
        <li>{m.pages_skeletons_prompt_b()}</li>
        <li>{m.pages_skeletons_prompt_c()}</li>
      </ul>
      <p>{m.pages_skeletons_prompt_note()}</p>
      <h2>{m.pages_skeletons_questions_heading()}</h2>
      <p><strong>{m.pages_skeletons_question_meaning()}</strong> {m.pages_skeletons_answer_meaning()}</p>
      <p><strong>{m.pages_skeletons_question_photo()}</strong> {m.pages_skeletons_answer_photo()}</p>
      <p><strong>{m.pages_skeletons_question_exact()}</strong> {m.pages_skeletons_answer_exact()}</p>
      <p><strong>{m.pages_skeletons_question_free()}</strong> {m.pages_skeletons_answer_free()}</p>
      <p>{m.pages_skeletons_ready()} <a href="/?preset=spooky-skeletons#tool">{m.pages_skeletons_open_generator()}</a></p>
    </section>
  );
}
