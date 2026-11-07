import { errorResponse } from '@shipwords/core/http';
import type { Core } from '@shipwords/core/server';
import { createJobs, type JobIdempotency } from '@shipwords/jobs/handlers';
import models from './models.server';
import { createTrialJob, type SiteJobBody } from './trials.server';
import { VIDEO_OPTIONS } from './video-options';
import { VIDEO_UPSTREAMS } from './video-pricing.server';

interface Options {
  options: readonly { resolution: string; durations: readonly number[] }[];
  default: { resolution: string; duration: number };
  aspectRatios: readonly string[];
  imageAspectRatio?: string;
}

/** The same model/spec allowlist is used before the shared handler calculates and spends credits. */
export function paidParameters(modelId: unknown, input: unknown, usesImage = false): boolean {
  if (typeof modelId !== 'string') return false;
  const choice = (VIDEO_OPTIONS as Readonly<Record<string, Options>>)[modelId];
  if (!choice) return false;
  if (input !== undefined && (!input || typeof input !== 'object' || Array.isArray(input))) return false;
  const parameters = (input ?? {}) as Record<string, unknown>;
  if (Object.keys(parameters).some((key) => !['resolution', 'duration', 'aspect_ratio'].includes(key)))
    return false;
  const resolution = parameters.resolution ?? choice.default.resolution;
  const duration = parameters.duration ?? choice.default.duration;
  const ratio = parameters.aspect_ratio;
  return (
    typeof resolution === 'string' &&
    typeof duration === 'number' &&
    Number.isSafeInteger(duration) &&
    choice.options.some(
      (option) => option.resolution === resolution && option.durations.includes(duration),
    ) &&
    (ratio === undefined ||
      (typeof ratio === 'string' &&
        (choice.aspectRatios.includes(ratio) || (usesImage && choice.imageAspectRatio === ratio))))
  );
}

/** Resolve identity once so selecting the trial settings and charging the job use the same user. */
export async function createSiteJob(
  core: Core,
  request: Request,
  idempotency?: JobIdempotency,
): Promise<Response> {
  const user = await core.getUser(request);
  const requestCore: Core = { ...core, getUser: async () => user };
  const body = (await request
    .clone()
    .json()
    .catch(() => null)) as SiteJobBody | null;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return errorResponse(400, 'invalid_prompt');
  const mode = body.mode === undefined ? (user ? 'paid' : 'daily-trial') : body.mode;
  if (mode !== 'paid' && mode !== 'daily-trial' && mode !== 'signup-trial')
    return errorResponse(400, 'invalid_generation_mode');
  if (mode !== 'paid') return createTrialJob(requestCore, request, user, body, mode);
  if (!user) return errorResponse(401, 'login_required');
  const usesImage = Array.isArray(body.references) && body.references.length > 0;
  if (!paidParameters(body.modelId, body.parameters, usesImage))
    return errorResponse(400, 'invalid_parameters');
  if (
    VIDEO_UPSTREAMS[body.modelId as string]?.requiresReference &&
    (!Array.isArray(body.references) || body.references.length !== 1)
  )
    return errorResponse(400, 'invalid_references');
  const choice = (VIDEO_OPTIONS as Readonly<Record<string, Options>>)[body.modelId as string]!;
  // Some upstreams require a fixed aspect ratio for a first-frame request.
  const requestModels =
    usesImage && choice.imageAspectRatio
      ? models.map((model) =>
          model.id === body.modelId
            ? {
                ...model,
                defaults: { ...model.defaults, aspect_ratio: choice.imageAspectRatio },
                allowedParameters: model.allowedParameters.filter((key) => key !== 'aspect_ratio'),
              }
            : model,
        )
      : models;
  return createJobs(requestCore, requestModels).create(request, idempotency);
}
