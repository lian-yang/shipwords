import { pageHead } from '@shipwords/core/seo';
import { createFileRoute } from '@tanstack/react-router';
import { m } from '~/paraglide/messages.js';
import site from '../../site.config';

export const Route = createFileRoute('/earth-zoom-out-video-generator')({
  head: () =>
    pageHead(site, {
      title: m.pages_earthzoom_meta_title({ siteName: site.name }),
      description: m.pages_earthzoom_meta_description(),
      path: '/earth-zoom-out-video-generator',
      image: `${site.url}/og.jpg`,
      jsonLd: [
        {
          '@type': 'FAQPage',
          mainEntity: [
            { question: m.pages_earthzoom_question_what(), answer: m.pages_earthzoom_answer_what() },
            { question: m.pages_earthzoom_question_photo(), answer: m.pages_earthzoom_answer_photo() },
            { question: m.pages_earthzoom_question_exact(), answer: m.pages_earthzoom_answer_exact() },
            { question: m.pages_earthzoom_question_free(), answer: m.pages_earthzoom_answer_free() },
          ].map(({ question, answer }) => ({
            '@type': 'Question',
            name: question,
            acceptedAnswer: { '@type': 'Answer', text: answer },
          })),
        },
      ],
    }),
  component: EarthZoomPage,
});

function EarthZoomPage() {
  return (
    <section className="content">
      <h1>{m.pages_earthzoom_title()}</h1>
      <p className="lead">{m.pages_earthzoom_intro()}</p>
      <p>
        <a className="button primary" href="/?preset=earth-zoom-out#tool">
          {m.pages_earthzoom_generate_link()}
        </a>
      </p>
      <h2>{m.pages_earthzoom_format_heading()}</h2>
      <p>{m.pages_earthzoom_format_body()}</p>
      <h2>{m.pages_earthzoom_make_heading()}</h2>
      <p>{m.pages_earthzoom_make_body()}</p>
      <h2>{m.pages_earthzoom_photo_heading()}</h2>
      <p>{m.pages_earthzoom_photo_body()}</p>
      <h2>{m.pages_earthzoom_prompt_heading()}</h2>
      <ul>
        <li>{m.pages_earthzoom_prompt_a()}</li>
        <li>{m.pages_earthzoom_prompt_b()}</li>
        <li>{m.pages_earthzoom_prompt_c()}</li>
      </ul>
      <p>{m.pages_earthzoom_prompt_note()}</p>
      <h2>{m.pages_earthzoom_questions_heading()}</h2>
      <p><strong>{m.pages_earthzoom_question_what()}</strong> {m.pages_earthzoom_answer_what()}</p>
      <p><strong>{m.pages_earthzoom_question_photo()}</strong> {m.pages_earthzoom_answer_photo()}</p>
      <p><strong>{m.pages_earthzoom_question_exact()}</strong> {m.pages_earthzoom_answer_exact()}</p>
      <p><strong>{m.pages_earthzoom_question_free()}</strong> {m.pages_earthzoom_answer_free()}</p>
      <p>{m.pages_earthzoom_ready()} <a href="/?preset=earth-zoom-out#tool">{m.pages_earthzoom_open_generator()}</a></p>
    </section>
  );
}
