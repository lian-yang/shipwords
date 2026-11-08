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
  'buggin-dance': m.pages_buggindance_prompt_a,
  'dog-elevator-prank': m.pages_dogelevator_prompt_a,
  'chipmunks-dance': m.pages_chipmunks_prompt_a,
  'anime-star-eye': m.pages_animestareye_prompt_a,
  'can-i-ride': m.pages_canride_prompt_a,
  'ba-ba-ba': m.pages_bababa_prompt_a,
  'birthday-car': m.pages_bdaycar_prompt_a,
  'dog-rhapsody': m.pages_dogrhapsody_prompt_a,
  'fish-cutting': m.pages_fishcut_prompt_a,
  'pimpwalk-entrance': m.pages_pimpwalk_prompt_a,
  'flamingo-float': m.pages_flamingofloat_prompt_a,
  'snatch-back-splash': m.pages_snatchback_prompt_a,
  'tears-falling-down': m.pages_tearsfall_prompt_a,
  'dog-couple-dance': m.pages_dogcouple_prompt_a,
};

export function getPromptPreset(id: string): string | undefined {
  return Object.hasOwn(presets, id) ? presets[id]?.() : undefined;
}
