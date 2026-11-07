import { createFileRoute } from '@tanstack/react-router';
import { handleAgentRequest } from '~/agent-api.server';
import { handleMcp } from '~/agent-mcp.server';

export const Route = createFileRoute('/api/mcp')({
  server: {
    handlers: {
      GET: ({ request }) => handleMcp(request, handleAgentRequest),
      POST: ({ request }) => handleMcp(request, handleAgentRequest),
    },
  },
});
