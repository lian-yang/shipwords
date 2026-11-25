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
    it.each(pages)(`carries the ${locale} example behind every %s preset link`, (preset, route) => {
      const originalGetLocale = getLocale;
      overwriteGetLocale(() => locale);
      try {
        const Component = route.options.component;
        if (!Component) throw new Error(`Missing page component for ${preset}`);
        const html = renderToStaticMarkup(createElement(Component));
        const presetId = (href: string) => /^\/\?preset=([^&#]+)#tool$/.exec(href)?.[1];
        const links = [...html.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>/g)]
          .map((match) => match[1])
          .filter((href) => href?.startsWith('/?preset='));
        // The first two preset links are calls to action for the page's own prompt; a longer page
        // may add one "use this prompt" link per example, each pointing at the example it shows.
        expect(links.slice(0, 2)).toEqual([`/?preset=${preset}#tool`, `/?preset=${preset}#tool`]);
        for (const href of links) expect(getPromptPreset(presetId(href ?? '') ?? ''), href).toBeTruthy();

        // An example shows exactly one prompt, optionally followed by the link that loads it.
        const useLink = /<a\b[^>]*href="(\/\?preset=[^"]*)"[^>]*>([^<]*)<\/a>/;
        const check = (item: string, prompt: string | undefined, label: string) => {
          expect(prompt, label).toBeTruthy();
          const link = useLink.exec(item);
          expect(`<li>${item}</li>`, label).toBe(
            renderToStaticMarkup(
              createElement(
                'li',
                null,
                prompt,
                ...(link ? [' ', createElement('a', { href: link[1] }, link[2])] : []),
              ),
            ),
          );
        };
        const examples = [...html.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((match) => match[1] ?? '');
        check(examples[0]!, getPromptPreset(preset), `${preset}: first example`);
        for (const [index, item] of examples.entries()) {
          const link = useLink.exec(item);
          if (index > 0 && link)
            check(item, getPromptPreset(presetId(link[1]!)!), `${preset}: example ${index + 1}`);
        }
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
