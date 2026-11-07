import { createFileRoute } from '@tanstack/react-router';
import { handleAgentRequest } from '~/agent-api.server';
export const Route = createFileRoute('/api/agent/uploads')({
  server: { handlers: { POST: ({ request }) => handleAgentRequest(request) } },
});
