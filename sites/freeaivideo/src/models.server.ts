import { type ModelDefinition, type ServerModel, serverModels } from '@shipwords/jobs/models';
import catalog from '../site.models';
import { VIDEO_OPTIONS } from './video-options';
import { trialMaxCost, VIDEO_UPSTREAMS } from './video-pricing.server';

// Upstream IDs and execution ceilings stay server-side. Public prices live in site.models.ts.
const server = Object.fromEntries(
  catalog.map((model) => {
    const spec = VIDEO_UPSTREAMS[model.id];
    if (!spec) throw new Error(`Missing upstream model for ${model.id}`);
    return [
      model.id,
      {
        upstream: 'yir',
        upstreamModel: spec.upstreamModel,
        verifiedBilling: true,
        timeoutMinutes: 20,
        ...(spec.referenceRole ? { referenceRole: spec.referenceRole } : {}),
      },
    ];
  }),
) as { readonly [K in (typeof catalog)[number]['id']]: ServerModel };

// Keep the original model and caps for jobs queued before the new catalog.
const legacy: ModelDefinition = {
  id: 'seedance-2-5',
  name: 'Seedance 2.5',
  kind: 'video',
  credits: 100,
  guest: true,
  allowedParameters: ['aspect_ratio'],
  defaults: { aspect_ratio: '16:9', duration: 10, resolution: '720p' },
  maxReferences: 1,
  upstream: 'yir',
  upstreamModel: 'bytedance/seedance-2.5',
  maxCost: '2.60',
  timeoutMinutes: 20,
};

const models = [
  ...serverModels(catalog, server).map((model) => ({
    ...model,
    // Audio changes the cost on several upstreams. It is set by the server, never by a request.
    defaults: {
      ...model.defaults,
      ...(VIDEO_UPSTREAMS[model.id]!.generateAudio === undefined
        ? {}
        : { generate_audio: VIDEO_UPSTREAMS[model.id]!.generateAudio }),
    },
    allowedParameters: model.allowedParameters.filter((key) => key !== 'generate_audio'),
  })),
  legacy,
];

export const guestModels = models.map((model) => {
  if (model.id === legacy.id)
    return {
      ...model,
      credits: 60,
      maxCost: '0.60',
      defaults: { ...model.defaults, duration: 4, resolution: '480p' },
    };
  if (!model.guest) return model;
  const option = (
    VIDEO_OPTIONS as Readonly<Record<string, { trial: { duration: number; resolution: string } }>>
  )[model.id];
  const cap = trialMaxCost(model.id);
  if (!option || !cap) throw new Error(`Missing trial configuration for ${model.id}`);
  return {
    ...model,
    maxCost: cap,
    allowedParameters: model.allowedParameters.filter((key) => key === 'aspect_ratio'),
    defaults: { ...model.defaults, ...option.trial },
  };
});

export default models;
