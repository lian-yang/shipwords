import { creditsFor } from '@shipwords/jobs/models';
import catalog from '../site.models';
import { SHARED_VIDEO_IDS, VIDEO_OPTIONS } from './video-options';

/** Source catalog snapshot 2026-11-06. Yir quotes and channels may change. */
export const VIDEO_UPSTREAMS: Readonly<
  Record<
    string,
    {
      upstreamModel: string;
      generateAudio?: boolean;
      referenceRole?: 'reference_image' | 'first_frame';
      requiresReference?: boolean;
    }
  >
> = {
  [SHARED_VIDEO_IDS.gemini11]: { upstreamModel: 'google/gemini-omni-1.1-flash' },
  'seedance-2-5-v2': { upstreamModel: 'bytedance/seedance-2.5', generateAudio: false },
  'seedance-2-0-mini-v2': { upstreamModel: 'bytedance/seedance-2.0-mini', generateAudio: false },
  'minimax-h3-v2': { upstreamModel: 'minimax/minimax-h3', generateAudio: true },
  'kling-2-6-v2': { upstreamModel: 'klingai/kling-2.6', generateAudio: false },
  'grok-imagine-video-v2': { upstreamModel: 'spacexai/grok-imagine-video', generateAudio: true },
  [SHARED_VIDEO_IDS.gemini]: { upstreamModel: 'google/gemini-omni-1.2-flash' },
  'wan-2-6-v2': { upstreamModel: 'alibaba/wan-2.6', generateAudio: true },
  'wan-2-7-v2': { upstreamModel: 'alibaba/wan-2.7', generateAudio: true },
  'wan-3-0-v2': { upstreamModel: 'alibaba/wan-3.0', generateAudio: false },
  'wan-3-0-prime-v2': { upstreamModel: 'alibaba/wan-3.0-prime', generateAudio: true },
  'happyhorse-1-1-v2': { upstreamModel: 'alibaba/happyhorse-1.1', generateAudio: true },
  'flux-3-max-v2': { upstreamModel: 'bfl/flux-3-max', generateAudio: true },
  'flux-3-video-v2': { upstreamModel: 'bfl/flux-3-video', generateAudio: true },
  'kling-3-0-v2': { upstreamModel: 'klingai/kling-3.0', generateAudio: false },
  'kling-4-0-v2': { upstreamModel: 'klingai/kling-4.0', generateAudio: true },
  'kling-4-0-flash-v2': { upstreamModel: 'klingai/kling-4.0-flash', generateAudio: true },
  'veo-3-1-fast-v2': { upstreamModel: 'google/veo-3.1-fast-generate-001', generateAudio: false },
  'veo-3-1-v2': { upstreamModel: 'google/veo-3.1-generate-001', generateAudio: false },
  'seedance-1-5-pro-v2': { upstreamModel: 'bytedance/seedance-1.5-pro', generateAudio: false },
  'seedance-2-0-v2': { upstreamModel: 'bytedance/seedance-2.0', generateAudio: false },
  'seedance-2-0-fast-v2': { upstreamModel: 'bytedance/seedance-2.0-fast', generateAudio: false },
  'minimax-h3-max-v2': { upstreamModel: 'minimax/minimax-h3-max', generateAudio: true },
  'minimax-h3-highspeed-v2': {
    upstreamModel: 'minimax/minimax-h3-highspeed',
    generateAudio: true,
    requiresReference: true,
    referenceRole: 'reference_image',
  },
  'minimax-h3-lite-v2': {
    upstreamModel: 'minimax/minimax-h3-lite',
    generateAudio: true,
    requiresReference: true,
    referenceRole: 'reference_image',
  },
  'hailuo-2-3-v2': { upstreamModel: 'minimax/hailuo-2.3', generateAudio: false },
  'hailuo-2-3-fast-v2': {
    upstreamModel: 'minimax/hailuo-2.3-fast',
    generateAudio: false,
    requiresReference: true,
  },
  [SHARED_VIDEO_IDS.grok15]: { upstreamModel: 'spacexai/grok-imagine-video-1.5', generateAudio: true },
  [SHARED_VIDEO_IDS.grok15lite]: {
    upstreamModel: 'spacexai/grok-imagine-video-1.5-lite',
    generateAudio: true,
  },
  'heygen-video-1-v2': { upstreamModel: 'heygen/heygen-video-1', generateAudio: true },
};
const COST_SHARE: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  [SHARED_VIDEO_IDS.gemini11]: { '720p': '0.7', '1080p': '0.7', '4K': '0.65' },
  'seedance-2-5-v2': { '480p': '0.65', '720p': '0.6', '1080p': '0.5' },
  'seedance-2-0-mini-v2': { '480p': '0.7', '720p': '0.7' },
  'minimax-h3-v2': { '768P': '0.7', '2K': '0.65' },
  'kling-2-6-v2': { '720p': '0.7', '1080p': '0.7' },
  'grok-imagine-video-v2': { '480p': '0.7', '720p': '0.7' },
  [SHARED_VIDEO_IDS.gemini]: { '360p': '0.7', '720p': '0.7' },
  'wan-2-6-v2': { '720p': '0.7', '1080p': '0.65' },
  'wan-2-7-v2': { '720p': '0.7', '1080p': '0.65' },
  'wan-3-0-v2': { '480p': '0.7', '720p': '0.65', '1080p': '0.65' },
  'wan-3-0-prime-v2': { '480p': '0.7', '1080p': '0.6' },
  'happyhorse-1-1-v2': { '720p': '0.65', '1080p': '0.65' },
  'flux-3-max-v2': { '720p': '0.7', '1080p': '0.7' },
  'flux-3-video-v2': { '720p': '0.65', '4K': '0.6' },
  'kling-3-0-v2': { '720p': '0.65', '1080p': '0.65' },
  'kling-4-0-v2': { '720p': '0.65', '1080p': '0.6' },
  'kling-4-0-flash-v2': { '720p': '0.65' },
  'veo-3-1-fast-v2': { '720p': '0.65', '1080p': '0.65', '4K': '0.6' },
  'veo-3-1-v2': { '720p': '0.6', '1080p': '0.6', '4K': '0.6' },
  'seedance-1-5-pro-v2': { '480p': '0.7', '720p': '0.7', '1080p': '0.65' },
  'seedance-2-0-v2': { '480p': '0.65', '720p': '0.6', '1080p': '0.6', '4K': '0.5' },
  'seedance-2-0-fast-v2': { '480p': '0.7', '720p': '0.65' },
  'minimax-h3-max-v2': { '480p': '0.7', '768P': '0.7' },
  'minimax-h3-highspeed-v2': { '768P': '0.7' },
  'minimax-h3-lite-v2': { '480p': '0.7' },
  'hailuo-2-3-v2': { '768P': '0.7', '1080p': '0.7' },
  'hailuo-2-3-fast-v2': { '768P': '0.7', '1080p': '0.7' },
  [SHARED_VIDEO_IDS.grok15]: { '480p': '0.7', '720p': '0.7' },
  [SHARED_VIDEO_IDS.grok15lite]: { '480p': '0.7', '720p': '0.7' },
  'heygen-video-1-v2': { '768P': '0.7', '2K': '0.65' },
};
const TRIAL_CAP: Readonly<Record<string, string>> = {
  'seedance-2-5-v2': '0.50',
  'seedance-2-0-mini-v2': '0.12',
  'minimax-h3-v2': '0.32',
  'kling-2-6-v2': '0.22',
  'grok-imagine-video-v2': '0.19',
  [SHARED_VIDEO_IDS.gemini]: '0.12',
};

/** Derive an upstream hard ceiling from the lowest retail pack and the target margin. */
export function paidMaxCost(
  id: string,
  parameters: Record<string, unknown>,
  chargedCredits?: number,
): string | null {
  const model = catalog.find((item) => item.id === id);
  const option = VIDEO_OPTIONS[id]?.options.find((item) => item.resolution === parameters.resolution);
  if (!model || !option || !option.durations.includes(parameters.duration as number)) return null;
  const share = COST_SHARE[id]?.[option.resolution];
  if (!share) return null;
  // Integer microdollars: 1 credit in the lowest-price pack = $0.03998.
  const sharePermille = Math.round(Number(share) * 1000);
  const quotedCredits = creditsFor(model, parameters);
  if (chargedCredits !== undefined && (!Number.isSafeInteger(chargedCredits) || chargedCredits <= 0))
    return null;
  const credits = chargedCredits === undefined ? quotedCredits : Math.min(quotedCredits, chargedCredits);
  const micros = Math.floor((credits * 39980 * sharePermille) / 1000);
  return (micros / 1_000_000).toFixed(6);
}
export function trialMaxCost(id: string): string | null {
  return TRIAL_CAP[id] ?? null;
}
