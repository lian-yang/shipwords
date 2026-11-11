import assert from 'node:assert/strict';
import { test } from 'node:test';
import vm from 'node:vm';
import { analyticsScripts } from '../../../packages/core/src/analytics.ts';
import { guardAnalyticsScripts } from '../src/lib/analytics-head.ts';

function execute(pathname) {
  const appended = [];
  const context = {
    location: { pathname },
    document: { createElement: () => ({}), head: { appendChild: (element) => appended.push(element) } },
  };
  context.window = context;
  vm.createContext(context);
  const scripts = guardAnalyticsScripts(analyticsScripts({ analytics: { ga4: 'G-TEST123' } }));
  for (const script of scripts) vm.runInContext(script.children, context);
  return { context, appended };
}

test('real GA snippets initialize and queue events on normal pages', () => {
  const { context, appended } = execute('/');
  assert.equal(appended.length, 1);
  assert.match(appended[0].src, /gtag\/js\?id=G-TEST123/);
  assert.equal(typeof context.gtag, 'function');
  context.gtag('event', 'pricing_open', { entry_point: 'nav' });
  assert.equal(context.dataLayer.length, 3);
  assert.equal(context.dataLayer[2][1], 'pricing_open');
});

test('checkout return does not load or initialize analytics', () => {
  const { context, appended } = execute('/billing/return');
  assert.equal(appended.length, 0);
  assert.equal(context.gtag, undefined);
  assert.equal(context.dataLayer, undefined);
});
