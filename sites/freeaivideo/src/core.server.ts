import { createCore } from '@shipwords/core/server';
import { createJobs } from '@shipwords/jobs/handlers';
import site from '../site.config';
import { createSiteJob } from './create-job.server';
import models from './models.server';

// Server singleton: route files only delegate; business logic lives in packages.
export const core = createCore(site);
export const jobsApi = {
  ...createJobs(core, models),
  create: (request: Request) => createSiteJob(core, request),
};
