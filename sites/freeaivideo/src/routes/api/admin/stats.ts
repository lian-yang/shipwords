import { createFileRoute } from '@tanstack/react-router';
import { adminGate, adminStats } from '~/admin.server';

export const Route = createFileRoute('/api/admin/stats')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const denied = await adminGate(request);
        if (denied) return denied;
        const rawOffset = new URL(request.url).searchParams.get('billingOffset');
        const offset = rawOffset === null ? 0 : Number(rawOffset);
        if (!Number.isSafeInteger(offset) || offset < 0 || offset > 1_000_000)
          return new Response(null, { status: 400 });
        return Response.json({ stats: await adminStats(offset) }, { headers: { 'cache-control': 'no-store' } });
      },
    },
  },
});
