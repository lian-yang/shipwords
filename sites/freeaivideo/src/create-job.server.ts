import { errorResponse } from '@shipwords/core/http';
import type { Core } from '@shipwords/core/server';
import { createJobs } from '@shipwords/jobs/handlers';
import models from './models.server';
import { createTrialJob, type SiteJobBody } from './trials.server';

/** Resolve identity once so selecting the trial settings and charging the job use the same user. */
export async function createSiteJob(core: Core, request: Request): Promise<Response> {
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
  const usesImage = Array.isArray(body?.references) && body.references.length > 0;
  const selectedModels = models;
  // Seedance first-frame requests require auto aspect ratio; do not let the client override it.
  const requestModels = usesImage
    ? selectedModels.map((model) => ({
        ...model,
        defaults: { ...model.defaults, aspect_ratio: 'auto' },
        allowedParameters: model.allowedParameters.filter((key) => key !== 'aspect_ratio'),
      }))
    : selectedModels;
  return createJobs(requestCore, requestModels).create(request);
}
