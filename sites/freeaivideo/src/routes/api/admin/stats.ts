import { createFileRoute } from '@tanstack/react-router';
import { adminGate, adminStats } from '~/admin.server';

export const Route = createFileRoute('/api/admin/stats')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = await adminGate(request);
        if (denied) return denied;
        return Response.json({ stats: await adminStats() }, { headers: { 'cache-control': 'no-store' } });
      },
    },
  },
});
