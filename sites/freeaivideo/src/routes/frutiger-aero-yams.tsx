import { pageHead } from '@shipwords/core/seo';
import { createFileRoute } from '@tanstack/react-router';
import { m } from '~/paraglide/messages.js';
import site from '../../site.config';

// Trend explainer page: the catchphrase background is factual (Know Your Meme, Oct-Nov 2026);
// prompts deliberately render the Frutiger Aero aesthetic on objects and scenes, not on
// people's bodies, so the page stays on the safe side of the slang.
export const Route = createFileRoute('/frutiger-aero-yams')({
  head: () =>
    pageHead(site, {
      title: m.pages_frutigerayams_meta_title({ siteName: site.name }),
      description: m.pages_frutigerayams_meta_description(),
      path: '/frutiger-aero-yams',
      image: `${site.url}/og.jpg`,
      jsonLd: [
        {
          '@type': 'FAQPage',
          mainEntity: [
            { question: m.pages_frutigerayams_question_meaning(), answer: m.pages_frutigerayams_answer_meaning() },
            { question: m.pages_frutigerayams_question_origin(), answer: m.pages_frutigerayams_answer_origin() },
            { question: m.pages_frutigerayams_question_make(), answer: m.pages_frutigerayams_answer_make() },
            { question: m.pages_frutigerayams_question_free(), answer: m.pages_frutigerayams_answer_free() },
          ].map(({ question, answer }) => ({
            '@type': 'Question',
            name: question,
            acceptedAnswer: { '@type': 'Answer', text: answer },
          })),
        },
      ],
    }),
  component: FrutigerAeroYamsPage,
});

function FrutigerAeroYamsPage() {
  return (
    <section className="content">
      <h1>{m.pages_frutigerayams_title()}</h1>
      <p className="lead">{m.pages_frutigerayams_intro()}</p>
      <p>
        <a className="button primary" href="/?preset=frutiger-aero-yams#tool">
          {m.pages_frutigerayams_generate_link()}
        </a>
      </p>
      <h2>{m.pages_frutigerayams_meaning_heading()}</h2>
      <p>{m.pages_frutigerayams_meaning_body()}</p>
      <h2>{m.pages_frutigerayams_origin_heading()}</h2>
      <p>{m.pages_frutigerayams_origin_body()}</p>
      <h2>{m.pages_frutigerayams_format_heading()}</h2>
      <p>{m.pages_frutigerayams_format_body()}</p>
      <h2>{m.pages_frutigerayams_make_heading()}</h2>
      <p>{m.pages_frutigerayams_make_body()}</p>
      <h2>{m.pages_frutigerayams_prompt_heading()}</h2>
      <ul>
        <li>{m.pages_frutigerayams_prompt_1()}</li>
        <li>{m.pages_frutigerayams_prompt_2()}</li>
        <li>{m.pages_frutigerayams_prompt_3()}</li>
      </ul>
      <p>{m.pages_frutigerayams_prompt_note()}</p>
      <h2>{m.pages_frutigerayams_questions_heading()}</h2>
      <p>
        <strong>{m.pages_frutigerayams_question_meaning()}</strong> {m.pages_frutigerayams_answer_meaning()}
      </p>
      <p>
        <strong>{m.pages_frutigerayams_question_origin()}</strong> {m.pages_frutigerayams_answer_origin()}
      </p>
      <p>
        <strong>{m.pages_frutigerayams_question_make()}</strong> {m.pages_frutigerayams_answer_make()}
      </p>
      <p>
        <strong>{m.pages_frutigerayams_question_free()}</strong> {m.pages_frutigerayams_answer_free()}
      </p>
      <p>
        {m.pages_frutigerayams_ready()} <a href="/?preset=frutiger-aero-yams#tool">{m.pages_frutigerayams_generate_link()}</a>
      </p>
    </section>
  );
}
