import { createFileRoute } from '@tanstack/react-router';
import { createAgentKeys } from '~/agent-keys.server';
import { core } from '~/core.server';

const keys = createAgentKeys(core);
export const Route = createFileRoute('/api/agent/keys/')({
  server: {
    handlers: {
      GET: ({ request }) => keys.list(request),
      POST: ({ request }) => keys.create(request),
    },
  },
});
