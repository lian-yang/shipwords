import type { WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import { createDb } from '@shipwords/core/db/client';
import { loadJob, markFailed } from '@shipwords/jobs/lifecycle';
import { defineGenerationWorkflow } from '@shipwords/jobs/workflow';
import site from '../site.config';
import models, { guestModels } from './models.server';
import { VIDEO_OPTIONS } from './video-options';
import { paidMaxCost, trialMaxCost } from './video-pricing.server';

const AccountWorkflow = defineGenerationWorkflow(models, site);
const TrialWorkflow = defineGenerationWorkflow(guestModels, site);
// Existing jobs did not persist a cost ceiling in their input. Keep their original ceiling on replay.
const LegacyWorkflow = defineGenerationWorkflow(
  models.map((model) => ({ ...model, maxCost: '1.20' })),
  site,
);

/** Select the execution ceiling from the saved job, never from a current session or client input. */
export class GenerationWorkflow extends AccountWorkflow {
  override async run(event: Readonly<WorkflowEvent<{ jobId: string }>>, step: WorkflowStep) {
    const db = createDb(this.env.DB);
    let policy: 'trial' | 'account' | 'legacy' | 'invalid' | { modelId: string; cap: string };
    try {
      policy = await step.do('site:generation-policy:v1', async () => {
        const job = await loadJob(db, event.payload.jobId);
        if (!job) return 'legacy' as const;
        try {
          const input = JSON.parse(job.inputJson) as {
            parameters?: Record<string, unknown>;
          };
          if (job.modelId.endsWith('-v2')) {
            const options = (
              VIDEO_OPTIONS as Readonly<
                Record<
                  string,
                  {
                    trial: { duration: number; resolution: string };
                  }
                >
              >
            )[job.modelId];
            if (!options || !input.parameters) return 'invalid' as const;
            const params = input.parameters;
            const cap =
              job.costCredits === 0
                ? params.duration === options.trial.duration && params.resolution === options.trial.resolution
                  ? trialMaxCost(job.modelId)
                  : null
                : // Protect a queued job from a subsequent retail-price change. The helper uses the
                  // smaller of its actual charged credits and the current quote for the same spec.
                  paidMaxCost(job.modelId, params, job.costCredits);
            return cap ? { modelId: job.modelId, cap } : ('invalid' as const);
          }
          // Authenticated free attempts retain real account ownership and the same trial ceiling.
          if (
            job.costCredits === 0 &&
            input.parameters?.duration === 4 &&
            input.parameters.resolution === '480p'
          )
            return 'trial' as const;
          // Claiming keeps guestId; old 10-second guest jobs retain their original ceiling.
          if (job.guestId)
            return input.parameters?.duration === 4 && input.parameters.resolution === '480p'
              ? ('trial' as const)
              : ('legacy' as const);
          if (input.parameters?.duration === 10 && input.parameters.resolution === '720p')
            return 'account' as const;
        } catch {
          if (job.modelId.endsWith('-v2')) return 'invalid' as const;
          // Let the standard runner handle malformed legacy inputs through its normal failure path.
        }
        return 'legacy' as const;
      });
    } catch (error) {
      // Match the shared Workflow's outer-abort settlement if policy lookup itself exhausts its retries.
      await step.do('abort:outer', async () => {
        await markFailed(db, event.payload.jobId, 'failed', 'internal_error', String(error));
        return true;
      });
      return;
    }
    // The generated run methods use closure-bound models and inherited env only, with no private fields.
    if (policy === 'invalid') {
      await step.do('abort:invalid-policy', async () => {
        await markFailed(
          db,
          event.payload.jobId,
          'failed',
          'internal_error',
          'Invalid saved generation policy',
        );
        return true;
      });
      return;
    }
    const workflow =
      typeof policy === 'object'
        ? defineGenerationWorkflow(
            models.map((model) => (model.id === policy.modelId ? { ...model, maxCost: policy.cap } : model)),
            site,
          )
        : policy === 'trial'
          ? TrialWorkflow
          : policy === 'account'
            ? AccountWorkflow
            : LegacyWorkflow;
    return workflow.prototype.run.call(this, event, step);
  }
}
