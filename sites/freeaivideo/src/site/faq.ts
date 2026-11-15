import { m } from '~/paraglide/messages.js';
import { getLocale } from '~/paraglide/runtime.js';
import site from '../../site.config';
import {
  creditPackPrice,
  creditPacks,
  modelCount,
  registrationVoucherDays,
  trialModels,
} from './public-offer';

type Faq = {
  question: string;
  answer: string;
  link?: { href: string; label: string };
};

// Resolve locale per request/render for both the visible FAQ and its matching structured data.
export function getFaqs(): readonly Faq[] {
  const locale = getLocale();
  const list = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' });
  const trialSettings = list.format(trialModels.map((model) => m.home_faq_trial_setting(model)));
  const packs = list.format(
    creditPacks.map((pack) =>
      m.home_faq_credit_pack({
        price: creditPackPrice(pack, locale),
        credits: pack.credits.toLocaleString(locale),
      }),
    ),
  );
  const pricingAnswer = [m.home_faq_pricing_answer({ packs })];
  if (creditPacks.every((pack) => pack.expiresDays === null)) {
    pricingAnswer.push(m.home_faq_credits_no_expiry());
  }

  return [
    {
      question: m.home_faq_free_question(),
      answer: m.home_faq_free_answer({ count: site.guest.dailyPerDevice }),
    },
    {
      question: m.home_faq_signup_question(),
      answer: m.home_faq_signup_answer({ days: registrationVoucherDays }),
    },
    {
      question: m.home_faq_pricing_question(),
      answer: pricingAnswer.join(' '),
      link: { href: '/#pricing', label: m.home_faq_pricing_link() },
    },
    {
      question: m.home_faq_watermark_question(),
      answer: m.home_faq_watermark_answer(),
      link: { href: '/no-watermark', label: m.home_faq_watermark_link() },
    },
    {
      question: m.home_faq_model_question(),
      answer: m.home_faq_model_answer({ models: modelCount, trials: trialModels.length }),
      link: { href: '/seedance-2-5-free', label: m.home_faq_model_link() },
    },
    { question: m.home_faq_photo_question(), answer: m.home_faq_photo_answer() },
    {
      question: m.home_faq_duration_question(),
      answer: m.home_faq_duration_answer({ settings: trialSettings }),
    },
    { question: m.home_faq_aspect_question(), answer: m.home_faq_aspect_answer() },
    {
      question: m.home_faq_failure_question(),
      answer: m.home_faq_failure_answer(),
      link: { href: '/refunds', label: m.home_faq_failure_link() },
    },
  ];
}
