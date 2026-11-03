import type { WorkflowEvent, WorkflowStep } from 'cloudflare:workers';
import { createDb } from '@shipwords/core/db/client';
import { loadJob, markFailed } from '@shipwords/jobs/lifecycle';
import { defineGenerationWorkflow } from '@shipwords/jobs/workflow';
import site from '../site.config';
import models, { guestModels } from './models.server';

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
    let policy: 'trial' | 'account' | 'legacy';
    try {
      policy = await step.do('site:generation-policy:v1', async () => {
        const job = await loadJob(db, event.payload.jobId);
        if (!job) return 'legacy' as const;
        try {
          const input = JSON.parse(job.inputJson) as {
            parameters?: { duration?: unknown; resolution?: unknown };
          };
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
    const workflow =
      policy === 'trial' ? TrialWorkflow : policy === 'account' ? AccountWorkflow : LegacyWorkflow;
    return workflow.prototype.run.call(this, event, step);
  }
}
