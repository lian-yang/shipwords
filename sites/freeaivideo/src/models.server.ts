import { serverModels } from '@shipwords/jobs/models';
import catalog from '../site.models';

// Server only (never import from pages): the upstream side of each model in site.models.ts, by ID.
// Seedance 2.5 on Yir: 480p from $0.0961/s, 720p from $0.216/s, clips up to 30 s (yir.ai/models/seedance-2-5, observed 2026-10-30).
// First real job (2026-11-01) billed $0.873 at the provider default spec, ~2.9 min.
// Account videos use 10 seconds at 720p; guest trials use 4 seconds at 480p with a separate execution ceiling.
const models = serverModels(catalog, {
  'seedance-2-5': {
    upstream: 'yir',
    upstreamModel: 'bytedance/seedance-2.5',
    maxCost: '2.60',
    timeoutMinutes: 20,
  },
});

export const guestModels = models.map((model) =>
  model.guest && model.kind === 'video'
    ? {
        ...model,
        credits: 60,
        maxCost: '0.60',
        allowedParameters: model.allowedParameters.filter(
          (key) => key !== 'duration' && key !== 'resolution',
        ),
        defaults: { ...model.defaults, duration: 4, resolution: '480p' },
      }
    : model,
);

export default models;
