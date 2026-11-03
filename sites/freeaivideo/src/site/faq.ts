import { m } from '~/paraglide/messages.js';
import site from '../../site.config';

type Faq = {
  question: string;
  answer: string;
  link?: { href: string; label: string };
};

// Resolve locale per request/render for both the visible FAQ and its matching structured data.
export function getFaqs(): readonly Faq[] {
  return [
    {
      question: m.home_faq_free_question(),
      answer: m.home_faq_free_answer({ count: site.guest.dailyPerDevice }),
    },
    {
      question: m.home_faq_signup_question(),
      answer: m.home_faq_signup_answer(),
    },
    {
      question: m.home_faq_watermark_question(),
      answer: m.home_faq_watermark_answer(),
      link: { href: '/no-watermark', label: m.home_faq_watermark_link() },
    },
    {
      question: m.home_faq_model_question(),
      answer: m.home_faq_model_answer(),
      link: { href: '/seedance-2-5-free', label: m.home_faq_model_link() },
    },
    { question: m.home_faq_photo_question(), answer: m.home_faq_photo_answer() },
    { question: m.home_faq_duration_question(), answer: m.home_faq_duration_answer() },
    { question: m.home_faq_aspect_question(), answer: m.home_faq_aspect_answer() },
    {
      question: m.home_faq_failure_question(),
      answer: m.home_faq_failure_answer(),
      link: { href: '/refunds', label: m.home_faq_failure_link() },
    },
  ];
}
