import { createFileRoute } from '@tanstack/react-router';
import { core } from '~/core.server';
import { claimSignupTrial, getTrialStatus } from '~/trials.server';

export const Route = createFileRoute('/api/trials')({
  server: {
    handlers: {
      GET: ({ request }) => getTrialStatus(core, request),
      POST: ({ request }) => claimSignupTrial(core, request),
    },
  },
});
