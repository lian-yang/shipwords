/** Public output choices. Upstream identifiers and budget ceilings are server-only. */
export interface VideoOptions {
  options: readonly { resolution: string; durations: readonly number[] }[];
  trial: { resolution: string; duration: number };
  default: { resolution: string; duration: number };
  aspectRatios: readonly string[];
  imageAspectRatio?: string;
  requiresReference?: boolean;
}
export const VIDEO_OPTIONS: Readonly<Record<string, VideoOptions>> = {
  'gemini-omni-1-1-flash-v2': {
    options: [
      { resolution: '720p', durations: [4, 6, 8, 10] },
      { resolution: '1080p', durations: [4, 6, 8, 10] },
      { resolution: '4K', durations: [4, 6, 8, 10] },
    ],
    trial: { resolution: '720p', duration: 4 },
    default: { resolution: '720p', duration: 4 },
    aspectRatios: ['16:9', '9:16'],
  },
  'seedance-2-5-v2': {
    options: [
      {
        resolution: '480p',
        durations: [
          4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
          30,
        ],
      },
      {
        resolution: '720p',
        durations: [
          4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
          30,
        ],
      },
      {
        resolution: '1080p',
        durations: [
          4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
          30,
        ],
      },
    ],
    trial: { resolution: '480p', duration: 4 },
    // Must fit the Starter pack (100 credits): 8s at 720p costs 92.
    default: { resolution: '720p', duration: 8 },
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'],
    imageAspectRatio: 'auto',
  },
  'seedance-2-0-mini-v2': {
    options: [
      { resolution: '480p', durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
      { resolution: '720p', durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
    ],
    trial: { resolution: '480p', duration: 4 },
    default: { resolution: '480p', duration: 5 },
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'],
  },
  'minimax-h3-v2': {
    options: [
      { resolution: '768P', durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
      { resolution: '2K', durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
    ],
    trial: { resolution: '480p', duration: 4 },
    default: { resolution: '768P', duration: 6 },
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'],
    imageAspectRatio: 'adaptive',
  },
  'kling-2-6-v2': {
    options: [
      { resolution: '720p', durations: [5, 10] },
      { resolution: '1080p', durations: [5, 10] },
    ],
    trial: { resolution: '720p', duration: 5 },
    default: { resolution: '720p', duration: 5 },
    aspectRatios: ['16:9', '9:16', '1:1'],
    imageAspectRatio: 'auto',
  },
  'grok-imagine-video-v2': {
    options: [
      { resolution: '480p', durations: [6, 10, 15, 30] },
      { resolution: '720p', durations: [6, 10, 15, 30] },
    ],
    trial: { resolution: '480p', duration: 6 },
    default: { resolution: '480p', duration: 6 },
    aspectRatios: ['16:9', '9:16', '1:1', '3:2', '2:3'],
    imageAspectRatio: 'auto',
  },
  'gemini-omni-1-2-flash-v2': {
    options: [
      { resolution: '360p', durations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
      { resolution: '720p', durations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
    ],
    trial: { resolution: '360p', duration: 3 },
    default: { resolution: '360p', duration: 3 },
    aspectRatios: ['16:9', '9:16'],
  },
  'wan-2-6-v2': {
    options: [
      { resolution: '720p', durations: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
      { resolution: '1080p', durations: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
    ],
    trial: { resolution: '720p', duration: 5 },
    default: { resolution: '720p', duration: 5 },
    aspectRatios: ['16:9', '9:16', '1:1'],
  },
  'wan-2-7-v2': {
    options: [
      { resolution: '720p', durations: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
      { resolution: '1080p', durations: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
    ],
    trial: { resolution: '720p', duration: 2 },
    default: { resolution: '720p', duration: 2 },
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
    imageAspectRatio: 'adaptive',
  },
  'wan-3-0-v2': {
    options: [
      {
        resolution: '480p',
        durations: [
          2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28,
          29, 30,
        ],
      },
      {
        resolution: '720p',
        durations: [
          2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28,
          29, 30,
        ],
      },
      {
        resolution: '1080p',
        durations: [
          2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28,
          29, 30,
        ],
      },
    ],
    trial: { resolution: '480p', duration: 2 },
    default: { resolution: '480p', duration: 2 },
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
  },
  'wan-3-0-prime-v2': {
    options: [
      {
        resolution: '480p',
        durations: [
          2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28,
          29, 30,
        ],
      },
      {
        resolution: '1080p',
        durations: [
          2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28,
          29, 30,
        ],
      },
    ],
    trial: { resolution: '480p', duration: 2 },
    default: { resolution: '480p', duration: 2 },
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4'],
  },
  'happyhorse-1-1-v2': {
    options: [
      { resolution: '720p', durations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
      { resolution: '1080p', durations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
    ],
    trial: { resolution: '720p', duration: 3 },
    default: { resolution: '720p', duration: 3 },
    aspectRatios: ['16:9'],
    imageAspectRatio: 'adaptive',
  },
  'flux-3-max-v2': {
    options: [
      { resolution: '720p', durations: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20] },
      { resolution: '1080p', durations: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20] },
    ],
    trial: { resolution: '720p', duration: 5 },
    default: { resolution: '720p', duration: 5 },
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'],
    imageAspectRatio: 'auto',
  },
  'flux-3-video-v2': {
    options: [
      { resolution: '720p', durations: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20] },
      { resolution: '4K', durations: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20] },
    ],
    trial: { resolution: '720p', duration: 5 },
    default: { resolution: '720p', duration: 5 },
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'],
    imageAspectRatio: 'auto',
  },
  'kling-3-0-v2': {
    options: [
      { resolution: '720p', durations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
      { resolution: '1080p', durations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
    ],
    trial: { resolution: '720p', duration: 3 },
    default: { resolution: '720p', duration: 3 },
    aspectRatios: ['16:9', '9:16', '1:1'],
  },
  'kling-4-0-v2': {
    options: [
      {
        resolution: '720p',
        durations: [
          3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
          30,
        ],
      },
      {
        resolution: '1080p',
        durations: [
          3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29,
          30,
        ],
      },
    ],
    trial: { resolution: '720p', duration: 3 },
    default: { resolution: '720p', duration: 3 },
    aspectRatios: ['16:9', '9:16', '1:1', '21:9'],
    imageAspectRatio: 'auto',
  },
  'kling-4-0-flash-v2': {
    options: [
      { resolution: '720p', durations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20] },
    ],
    trial: { resolution: '720p', duration: 3 },
    default: { resolution: '720p', duration: 3 },
    aspectRatios: ['16:9', '9:16', '1:1', '21:9'],
    imageAspectRatio: 'auto',
  },
  'veo-3-1-fast-v2': {
    options: [
      { resolution: '720p', durations: [4, 6, 8] },
      { resolution: '1080p', durations: [4, 6, 8] },
      { resolution: '4K', durations: [4, 6, 8] },
    ],
    trial: { resolution: '720p', duration: 4 },
    default: { resolution: '720p', duration: 4 },
    aspectRatios: ['16:9', '9:16'],
  },
  'veo-3-1-v2': {
    options: [
      { resolution: '720p', durations: [4, 6, 8] },
      { resolution: '1080p', durations: [4, 6, 8] },
      { resolution: '4K', durations: [4, 6, 8] },
    ],
    trial: { resolution: '720p', duration: 4 },
    default: { resolution: '720p', duration: 4 },
    aspectRatios: ['16:9', '9:16'],
  },
  'seedance-1-5-pro-v2': {
    options: [
      { resolution: '480p', durations: [4, 5, 6, 7, 8, 9, 10, 11, 12] },
      { resolution: '720p', durations: [4, 5, 6, 7, 8, 9, 10, 11, 12] },
      { resolution: '1080p', durations: [4, 5, 6, 7, 8, 9, 10, 11, 12] },
    ],
    trial: { resolution: '480p', duration: 4 },
    default: { resolution: '480p', duration: 4 },
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'],
  },
  'seedance-2-0-v2': {
    options: [
      { resolution: '480p', durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
      { resolution: '720p', durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
      { resolution: '1080p', durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
      { resolution: '4K', durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
    ],
    trial: { resolution: '480p', duration: 4 },
    default: { resolution: '480p', duration: 4 },
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'],
  },
  'seedance-2-0-fast-v2': {
    options: [
      { resolution: '480p', durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
      { resolution: '720p', durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
    ],
    trial: { resolution: '480p', duration: 4 },
    default: { resolution: '480p', duration: 4 },
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'],
  },
  'minimax-h3-max-v2': {
    options: [
      { resolution: '480p', durations: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
      { resolution: '768P', durations: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
    ],
    trial: { resolution: '480p', duration: 5 },
    default: { resolution: '480p', duration: 5 },
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'],
    imageAspectRatio: 'adaptive',
  },
  'minimax-h3-highspeed-v2': {
    options: [{ resolution: '768P', durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] }],
    trial: { resolution: '768P', duration: 4 },
    default: { resolution: '768P', duration: 4 },
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'],
    requiresReference: true,
  },
  'minimax-h3-lite-v2': {
    options: [{ resolution: '480p', durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] }],
    trial: { resolution: '480p', duration: 4 },
    default: { resolution: '480p', duration: 4 },
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'],
    requiresReference: true,
  },
  'hailuo-2-3-v2': {
    options: [
      { resolution: '768P', durations: [6, 10] },
      { resolution: '1080p', durations: [6, 10] },
    ],
    trial: { resolution: '768P', duration: 6 },
    default: { resolution: '768P', duration: 6 },
    aspectRatios: ['16:9'],
  },
  'hailuo-2-3-fast-v2': {
    options: [
      { resolution: '768P', durations: [6, 10] },
      { resolution: '1080p', durations: [6, 10] },
    ],
    trial: { resolution: '768P', duration: 6 },
    default: { resolution: '768P', duration: 6 },
    aspectRatios: ['16:9'],
    requiresReference: true,
  },
  'grok-imagine-video-1-5-v2': {
    options: [
      { resolution: '480p', durations: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
      { resolution: '720p', durations: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
    ],
    trial: { resolution: '480p', duration: 1 },
    default: { resolution: '480p', duration: 1 },
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '3:2', '2:3'],
    imageAspectRatio: 'auto',
  },
  'grok-imagine-video-1-5-lite-v2': {
    options: [
      { resolution: '480p', durations: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
      { resolution: '720p', durations: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
    ],
    trial: { resolution: '480p', duration: 1 },
    default: { resolution: '480p', duration: 1 },
    aspectRatios: ['16:9', '9:16', '1:1', '4:3', '3:4', '3:2', '2:3'],
    imageAspectRatio: 'auto',
  },
  'heygen-video-1-v2': {
    options: [
      { resolution: '768P', durations: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
      { resolution: '2K', durations: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
    ],
    trial: { resolution: '768P', duration: 5 },
    default: { resolution: '768P', duration: 5 },
    aspectRatios: ['16:9', '9:16'],
    imageAspectRatio: 'adaptive',
  },
};

// Public identifiers shared with the server's private routing table.
export const SHARED_VIDEO_IDS = {
  gemini11: 'gemini-omni-1-1-flash-v2',
  gemini: 'gemini-omni-1-2-flash-v2',
  grok15: 'grok-imagine-video-1-5-v2',
  grok15lite: 'grok-imagine-video-1-5-lite-v2',
} as const;
