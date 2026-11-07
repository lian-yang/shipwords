import { createFileRoute } from '@tanstack/react-router';
import { handleAgentRequest } from '~/agent-api.server';
export const Route = createFileRoute('/api/agent/jobs/$id')({
  server: { handlers: { GET: ({ request }) => handleAgentRequest(request) } },
});
