import { m } from '~/paraglide/messages.js';

// Resolve at use time so each preset uses the visitor's current language.
const presets: Record<string, () => string> = {
  'w-chews-l-nibbles': m.pages_wchews_prompt_w,
  'frutiger-aero-yams': m.pages_frutigerayams_prompt_1,
  'fancy-cafe': m.pages_fancycafe_prompt_1,
  'red-carpet': m.pages_redcarpet_prompt_1,
  'mulmannan-floor': m.pages_mulmannan_prompt_solo,
  'coffee-duo': m.pages_coffeelegends_prompt_duo,
  'paws-at-you': m.pages_paws_prompt_close,
  'bicep-heart': m.pages_bicep_prompt_close,
  'epic-dunk': m.pages_epicdunk_prompt_a,
  'burning-bridges': m.pages_burningbridges_prompt_a,
  'tiptoe-jordans': m.pages_tiptoejordans_prompt_a,
};

export function getPromptPreset(id: string): string | undefined {
  return Object.hasOwn(presets, id) ? presets[id]?.() : undefined;
}
