import { describe, expect, it, vi } from 'vitest';
import { handleMcp } from '../src/agent-mcp.server';

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request('https://freeaivideo.test/api/mcp', {
    method: 'POST',
    headers: { authorization: 'Bearer test-key', 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}
function agent() {
  return vi.fn(async (req: Request) => {
    if (req.headers.get('authorization') !== 'Bearer test-key')
      return Response.json({ error: 'unauthorized' }, { status: 401 });
    if (new URL(req.url).pathname === '/api/agent/jobs' && req.method === 'POST')
      return Response.json(
        { job: { id: 'job_abc', key: req.headers.get('idempotency-key'), input: await req.json() } },
        { status: 201 },
      );
    return Response.json({ balance: 10 });
  });
}
const rpc = (method: string, params?: unknown) => ({ jsonrpc: '2.0', id: 1, method, params });
const json = async <T>(response: Response) => (await response.json()) as T;

describe('MCP agent adapter', () => {
  it('authenticates initialization and responds with a supported protocol', async () => {
    const handler = agent();
    const res = await handleMcp(request(rpc('initialize', { protocolVersion: '2025-11-25' })), handler);
    expect((await json<{ result: { protocolVersion: string } }>(res)).result.protocolVersion).toBe(
      '2025-06-18',
    );
    const unauthorized = await handleMcp(
      request(rpc('tools/list'), { authorization: 'Bearer wrong' }),
      handler,
    );
    expect(unauthorized.status).toBe(401);
  });
  it('rejects untrusted browser origins and accepts initialized notifications', async () => {
    const handler = agent();
    expect(
      (await handleMcp(request(rpc('tools/list'), { origin: 'https://attacker.invalid' }), handler)).status,
    ).toBe(403);
    expect(handler).not.toHaveBeenCalled();
    const initialized = await handleMcp(
      request({ jsonrpc: '2.0', method: 'notifications/initialized' }),
      handler,
    );
    expect(initialized.status).toBe(202);
    expect(await initialized.text()).toBe('');
  });
  it('passes the same idempotency key and generation parameters to the internal API', async () => {
    const handler = agent();
    const args = {
      idempotencyKey: 'retry-123',
      modelId: 'model',
      prompt: 'A cat',
      parameters: { duration: 5 },
    };
    const res = await handleMcp(
      request(rpc('tools/call', { name: 'create_video', arguments: args })),
      handler,
    );
    const data = await json<{ result: { content: [{ text: string }] } }>(res);
    const payload = JSON.parse(data.result.content[0].text);
    expect(payload.job.key).toBe('retry-123');
    expect(payload.job.input).toEqual({ modelId: 'model', prompt: 'A cat', parameters: { duration: 5 } });
  });
  it('preserves the same downstream body when MCP argument properties are reordered', async () => {
    const bodies: string[] = [];
    const handler = vi.fn(async (req: Request) => {
      if (req.method === 'POST') bodies.push(await req.text());
      return Response.json({ balance: 10 });
    });
    await handleMcp(
      request(
        rpc('tools/call', {
          name: 'create_video',
          arguments: {
            idempotencyKey: 'x',
            modelId: 'm',
            prompt: 'p',
            parameters: { resolution: '720p', duration: 5 },
          },
        }),
      ),
      handler,
    );
    await handleMcp(
      request(
        rpc('tools/call', {
          name: 'create_video',
          arguments: {
            prompt: 'p',
            parameters: { duration: 5, resolution: '720p' },
            modelId: 'm',
            idempotencyKey: 'x',
          },
        }),
      ),
      handler,
    );
    expect(bodies[0]).toBe(bodies[1]);
  });
  it('does not silently retry a failed paid generation', async () => {
    const handler = vi.fn(async (req: Request) =>
      new URL(req.url).pathname.endsWith('/balance')
        ? Response.json({ balance: 10 })
        : Response.json({ error: 'conflict' }, { status: 409 }),
    );
    const res = await handleMcp(
      request(
        rpc('tools/call', {
          name: 'create_video',
          arguments: { idempotencyKey: 'x', modelId: 'm', prompt: 'p' },
        }),
      ),
      handler,
    );
    expect((await json<{ result: { isError: boolean } }>(res)).result.isError).toBe(true);
    expect(handler).toHaveBeenCalledTimes(2);
  });
  it('rejects invalid idempotency headers before dispatching a generation', async () => {
    const handler = agent();
    const res = await handleMcp(
      request(
        rpc('tools/call', {
          name: 'create_video',
          arguments: { idempotencyKey: 'bad\nkey', modelId: 'm', prompt: 'p' },
        }),
      ),
      handler,
    );
    expect((await json<{ error: { code: number } }>(res)).error.code).toBe(-32602);
    expect(handler).toHaveBeenCalledTimes(1);
  });
  it('limits the actual UTF-8 request bytes even without a content-length header', async () => {
    const handler = agent();
    const res = await handleMcp(
      request(
        rpc('tools/call', {
          name: 'create_video',
          arguments: { idempotencyKey: 'x', modelId: 'm', prompt: '猫'.repeat(12000) },
        }),
      ),
      handler,
    );
    expect(res.status).toBe(413);
    expect(handler).toHaveBeenCalledTimes(1);
  });
  it('does not offer SSE and rejects unsupported protocol versions', async () => {
    const handler = agent();
    const get = new Request('https://freeaivideo.test/api/mcp', {
      headers: { authorization: 'Bearer test-key' },
    });
    expect((await handleMcp(get, handler)).status).toBe(405);
    expect(
      (await handleMcp(request(rpc('ping'), { 'mcp-protocol-version': 'unknown' }), handler)).status,
    ).toBe(400);
  });
});
