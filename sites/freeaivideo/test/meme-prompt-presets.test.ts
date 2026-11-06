import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { getLocale, overwriteGetLocale } from '../src/paraglide/runtime.js';
import { Route as BicepRoute } from '../src/routes/bicep-heart-ai';
import { Route as FancyCafeRoute } from '../src/routes/fancy-cafe-ai';
import { Route as FrutigerRoute } from '../src/routes/frutiger-aero-yams';
import { Route as MulmannanRoute } from '../src/routes/mulmannan-gwangeo-ai';
import { Route as PawsRoute } from '../src/routes/paws-at-you-ai';
import { Route as RedCarpetRoute } from '../src/routes/red-carpet-ai';
import { Route as WChewsRoute } from '../src/routes/w-chews-l-nibbles';
import { Route as CoffeeRoute } from '../src/routes/when-two-legends-try-to-make-coffee';
import { getPromptPreset } from '../src/site/prompt-presets';

const pages = [
  ['w-chews-l-nibbles', WChewsRoute],
  ['frutiger-aero-yams', FrutigerRoute],
  ['fancy-cafe', FancyCafeRoute],
  ['red-carpet', RedCarpetRoute],
  ['mulmannan-floor', MulmannanRoute],
  ['coffee-duo', CoffeeRoute],
  ['paws-at-you', PawsRoute],
  ['bicep-heart', BicepRoute],
] as const;

describe('meme page prompt presets', () => {
  for (const locale of ['en', 'zh'] as const) {
    it.each(pages)(`carries the first ${locale} example from both %s links`, (preset, route) => {
      const originalGetLocale = getLocale;
      overwriteGetLocale(() => locale);
      try {
        const Component = route.options.component;
        if (!Component) throw new Error(`Missing page component for ${preset}`);
        const html = renderToStaticMarkup(createElement(Component));
        const links = [...html.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>/g)]
          .map((match) => match[1])
          .filter((href) => href?.startsWith('/?preset='));
        expect(links).toEqual([`/?preset=${preset}#tool`, `/?preset=${preset}#tool`]);

        const prompt = getPromptPreset(preset);
        expect(prompt).toBeTruthy();
        const firstExample = html.match(/<li>.*?<\/li>/)?.[0];
        expect(firstExample).toBe(renderToStaticMarkup(createElement('li', null, prompt)));
      } finally {
        overwriteGetLocale(originalGetLocale);
      }
    });
  }

  it.each(['', 'unknown', '__proto__', 'constructor', 'toString', 'valueOf'])(
    'rejects unknown or inherited preset %s',
    (id) => expect(getPromptPreset(id)).toBeUndefined(),
  );

  it('resolves each preset in the active language at use time', () => {
    const originalGetLocale = getLocale;
    try {
      for (const [preset] of pages) {
        overwriteGetLocale(() => 'en');
        const english = getPromptPreset(preset);
        overwriteGetLocale(() => 'zh');
        expect(getPromptPreset(preset)).not.toBe(english);
      }
    } finally {
      overwriteGetLocale(originalGetLocale);
    }
  });
});
