import { definePublicModels } from '@shipwords/jobs/models';

// Models available on this site, as pages see them: credits is charged per job; models with guest: true can be tried free by guests.
// Pages import this file, so it ships to the browser. Upstream models, cost caps and effect presets go in src/models.server.ts;
// definePublicModels throws on any other field.
// Account videos cost 100 credits. The trial model's budget and execution ceiling are configured separately on the server.
export default definePublicModels([
  {
    id: 'seedance-2-5',
    name: 'Seedance 2.5',
    kind: 'video',
    credits: 100,
    guest: true,
    allowedParameters: ['aspect_ratio'],
    defaults: { aspect_ratio: '16:9', duration: 10, resolution: '720p' },
    maxReferences: 1,
  },
]);
