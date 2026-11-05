import { pageHead } from '@shipwords/core/seo';
import { createFileRoute } from '@tanstack/react-router';
import { m } from '~/paraglide/messages.js';
import site from '../../site.config';

// Public format reference: https://www.kavel.ai/video/when-two-legends-try-to-make-coffee.
// This guide suggests an original two-person scene; it is not that service's fixed template.
export const Route = createFileRoute('/when-two-legends-try-to-make-coffee')({
  head: () =>
    pageHead(site, {
      title: m.pages_coffeelegends_meta_title({ siteName: site.name }),
      description: m.pages_coffeelegends_meta_description(),
      path: '/when-two-legends-try-to-make-coffee',
      image: `${site.url}/og.jpg`,
      jsonLd: [
        {
          '@type': 'FAQPage',
          mainEntity: [
            {
              question: m.pages_coffeelegends_question_format(),
              answer: m.pages_coffeelegends_answer_format(),
            },
            {
              question: m.pages_coffeelegends_question_photo(),
              answer: m.pages_coffeelegends_answer_photo(),
            },
            {
              question: m.pages_coffeelegends_question_exact(),
              answer: m.pages_coffeelegends_answer_exact(),
            },
            { question: m.pages_coffeelegends_question_free(), answer: m.pages_coffeelegends_answer_free() },
          ].map(({ question, answer }) => ({
            '@type': 'Question',
            name: question,
            acceptedAnswer: { '@type': 'Answer', text: answer },
          })),
        },
      ],
    }),
  component: CoffeeLegendsPage,
});

function CoffeeLegendsPage() {
  return (
    <section className="content">
      <h1>{m.pages_coffeelegends_title()}</h1>
      <p className="lead">{m.pages_coffeelegends_intro()}</p>
      <p>
        <a className="button primary" href="/?preset=coffee-duo#tool">
          {m.pages_coffeelegends_generate_link()}
        </a>
      </p>
      <h2>{m.pages_coffeelegends_format_heading()}</h2>
      <p>{m.pages_coffeelegends_format_body()}</p>
      <h2>{m.pages_coffeelegends_make_heading()}</h2>
      <p>{m.pages_coffeelegends_make_body()}</p>
      <h2>{m.pages_coffeelegends_prompt_heading()}</h2>
      <ul>
        <li>{m.pages_coffeelegends_prompt_duo()}</li>
        <li>{m.pages_coffeelegends_prompt_beans()}</li>
        <li>{m.pages_coffeelegends_prompt_reaction()}</li>
      </ul>
      <p>{m.pages_coffeelegends_prompt_note()}</p>
      <h2>{m.pages_coffeelegends_tips_heading()}</h2>
      <p>{m.pages_coffeelegends_tips_body()}</p>
      <h2>{m.pages_coffeelegends_questions_heading()}</h2>
      <p>
        <strong>{m.pages_coffeelegends_question_format()}</strong> {m.pages_coffeelegends_answer_format()}
      </p>
      <p>
        <strong>{m.pages_coffeelegends_question_photo()}</strong> {m.pages_coffeelegends_answer_photo()}
      </p>
      <p>
        <strong>{m.pages_coffeelegends_question_exact()}</strong> {m.pages_coffeelegends_answer_exact()}
      </p>
      <p>
        <strong>{m.pages_coffeelegends_question_free()}</strong> {m.pages_coffeelegends_answer_free()}
      </p>
      <p>
        {m.pages_coffeelegends_ready()} <a href="/#tool">{m.pages_coffeelegends_open_generator()}</a>
      </p>
    </section>
  );
}
