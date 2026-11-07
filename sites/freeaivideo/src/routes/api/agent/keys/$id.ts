import { createFileRoute } from '@tanstack/react-router';
import { createAgentKeys } from '~/agent-keys.server';
import { core } from '~/core.server';

const keys = createAgentKeys(core);
export const Route = createFileRoute('/api/agent/keys/$id')({
  server: { handlers: { DELETE: ({ request, params }) => keys.revoke(request, params.id) } },
});
