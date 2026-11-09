import { pageHead } from '@shipwords/core/seo';
import { createFileRoute } from '@tanstack/react-router';
import { m } from '~/paraglide/messages.js';
import site from '../../site.config';

export const Route = createFileRoute('/christmas-lights-wife-ai')({
  head: () =>
    pageHead(site, {
      title: m.pages_xmaslights_meta_title({ siteName: site.name }),
      description: m.pages_xmaslights_meta_description(),
      path: '/christmas-lights-wife-ai',
      image: `${site.url}/og.jpg`,
      jsonLd: [
        {
          '@type': 'FAQPage',
          mainEntity: [
            { question: m.pages_xmaslights_question_meaning(), answer: m.pages_xmaslights_answer_meaning() },
            { question: m.pages_xmaslights_question_photo(), answer: m.pages_xmaslights_answer_photo() },
            { question: m.pages_xmaslights_question_exact(), answer: m.pages_xmaslights_answer_exact() },
            { question: m.pages_xmaslights_question_free(), answer: m.pages_xmaslights_answer_free() },
          ].map(({ question, answer }) => ({
            '@type': 'Question',
            name: question,
            acceptedAnswer: { '@type': 'Answer', text: answer },
          })),
        },
      ],
    }),
  component: XmasLightsPage,
});

function XmasLightsPage() {
  return (
    <section className="content">
      <h1>{m.pages_xmaslights_title()}</h1>
      <p className="lead">{m.pages_xmaslights_intro()}</p>
      <p>
        <a className="button primary" href="/?preset=christmas-lights-wife#tool">
          {m.pages_xmaslights_generate_link()}
        </a>
      </p>
      <h2>{m.pages_xmaslights_format_heading()}</h2>
      <p>{m.pages_xmaslights_format_body()}</p>
      <h2>{m.pages_xmaslights_make_heading()}</h2>
      <p>{m.pages_xmaslights_make_body()}</p>
      <h2>{m.pages_xmaslights_photo_heading()}</h2>
      <p>{m.pages_xmaslights_photo_body()}</p>
      <h2>{m.pages_xmaslights_prompt_heading()}</h2>
      <ul>
        <li>{m.pages_xmaslights_prompt_a()}</li>
        <li>{m.pages_xmaslights_prompt_b()}</li>
        <li>{m.pages_xmaslights_prompt_c()}</li>
      </ul>
      <p>{m.pages_xmaslights_prompt_note()}</p>
      <h2>{m.pages_xmaslights_questions_heading()}</h2>
      <p><strong>{m.pages_xmaslights_question_meaning()}</strong> {m.pages_xmaslights_answer_meaning()}</p>
      <p><strong>{m.pages_xmaslights_question_photo()}</strong> {m.pages_xmaslights_answer_photo()}</p>
      <p><strong>{m.pages_xmaslights_question_exact()}</strong> {m.pages_xmaslights_answer_exact()}</p>
      <p><strong>{m.pages_xmaslights_question_free()}</strong> {m.pages_xmaslights_answer_free()}</p>
      <p>{m.pages_xmaslights_ready()} <a href="/?preset=christmas-lights-wife#tool">{m.pages_xmaslights_open_generator()}</a></p>
    </section>
  );
}
