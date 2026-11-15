import type { CreditPackProduct } from '@shipwords/core/site';
import site from '../../site.config';
import models from '../../site.models';
import { VIDEO_OPTIONS } from '../video-options';

export const modelCount = models.length;
export const trialModels = models
  .filter((model) => model.guest)
  .map(({ id, name }) => ({ id, name, ...VIDEO_OPTIONS[id]!.trial }));
export const registrationVoucherDays = site.signup.bonusExpiresDays ?? 30;
export const creditPacks = site.products.filter((product) => product.kind === 'credits');

export function creditPackPrice(product: CreditPackProduct, locale = 'en-US') {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: product.price.currency,
  }).format(product.price.amount / 100);
}
