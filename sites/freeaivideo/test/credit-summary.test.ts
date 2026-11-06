import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CreditSummary, creditShortfall } from '../src/site/credit-summary';

const noOp = () => {};

function render(
  status: 'signed_out' | 'loading' | 'ready' | 'error',
  available: number | null,
  cost: number,
) {
  return renderToStaticMarkup(
    createElement(CreditSummary, {
      status,
      available,
      cost,
      onRefresh: noOp,
      onSignIn: noOp,
    }),
  );
}

describe('credit guidance', () => {
  it('never reports an unknown balance as zero or asks for a top-up', () => {
    for (const status of ['signed_out', 'loading', 'error'] as const) {
      const html = render(status, null, 100);
      expect(html).not.toContain('Balance: 0 credits');
      expect(html).not.toContain('View credit packs');
      expect(creditShortfall(status, null, 100)).toBe(0);
    }
    expect(render('error', null, 100)).toContain('Retry');
  });

  it('offers packs only when the known balance is insufficient', () => {
    expect(render('ready', 114, 114)).not.toContain('View credit packs');
    expect(render('ready', 115, 114)).not.toContain('View credit packs');
    const html = render('ready', 4, 19);
    expect(html).toContain('Balance: 4 credits');
    expect(html).toContain('15 more credits');
    expect(html).toContain('View credit packs');
  });

  it('explains when a single available pack cannot cover the selected specification', () => {
    const covered = render('ready', 0, 1062);
    expect(covered).toContain('1,062 more credits');
    expect(covered).not.toContain('more than one purchase');
    const html = render('ready', 0, 2062);
    expect(html).toContain('2,062 more credits');
    expect(html).toContain('largest pack has 1,250 credits');
    expect(html).toContain('more than one purchase');
  });

  it('includes a negative balance when calculating the required top-up', () => {
    const html = render('ready', -50, 100);
    expect(html).toContain('Balance: 0 credits');
    expect(html).toContain('50 credits below zero');
    expect(html).toContain('150 more credits');
    expect(creditShortfall('ready', -50, 100)).toBe(150);
  });
});
