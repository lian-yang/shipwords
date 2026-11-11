import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PackEstimate } from '../src/site/pricing';

function render(credits: number, cost?: number | null) {
  return renderToStaticMarkup(createElement(PackEstimate, { credits, cost }));
}

describe('pricing pack estimates', () => {
  it('shows requests the pack itself can cover for the selected specification', () => {
    expect(render(100, 19)).toContain('up to 5 requests');
    expect(render(100, 92)).toContain('covers one request');
    expect(render(500, 92)).toContain('up to 5 requests');
    expect(render(100, 101)).toContain('does not cover one request');
  });

  it('does not imply a free or unknown selection has a paid estimate', () => {
    expect(render(100, 0)).toBe('');
    expect(render(100, null)).toBe('');
    expect(render(100)).toBe('');
  });
});
