import site from '../site.config';

// Stateless MCP Streamable HTTP: JSON responses only, no server-initiated SSE or sessions.
const VERSION = '2025-06-18';
const tools = [
  {
    name: 'list_video_models',
    description: 'List available video models and their supported paid settings and credit prices.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_credit_balance',
    description: 'Get the credit balance for the authenticated account.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'create_video',
    description:
      'Create a paid video generation job. This spends credits. Reuse the same idempotency key for retries of the same request.',
    inputSchema: {
      type: 'object',
      properties: {
        idempotencyKey: {
          type: 'string',
          minLength: 1,
          description: 'Unique key for this generation; reuse it when retrying.',
        },
        modelId: { type: 'string', minLength: 1 },
        prompt: { type: 'string', minLength: 1, maxLength: 4000 },
        parameters: {
          type: 'object',
          properties: {
            resolution: { type: 'string' },
            duration: { type: 'integer' },
            aspect_ratio: { type: 'string' },
          },
          additionalProperties: false,
        },
        references: {
          type: 'array',
          items: { type: 'string' },
          description: 'Previously uploaded site reference paths, when supported by the model.',
        },
      },
      required: ['idempotencyKey', 'modelId', 'prompt'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_video_job',
    description: 'Get the status and result of one video generation job owned by this account.',
    inputSchema: {
      type: 'object',
      properties: { jobId: { type: 'string', minLength: 1 } },
      required: ['jobId'],
      additionalProperties: false,
    },
  },
] as const;

type AgentHandler = (request: Request) => Promise<Response>;
type JsonRecord = Record<string, unknown>;
const record = (value: unknown): value is JsonRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const rpcError = (id: unknown, code: number, message: string) =>
  Response.json({ jsonrpc: '2.0', id, error: { code, message } });

function originAllowed(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  if (origin === new URL(site.url).origin) return true;
  const url = new URL(request.url);
  return (
    import.meta.env.DEV && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && origin === url.origin
  );
}

// MCP clients may reorder object properties on a retry. Produce a stable HTTP body
// so the downstream byte-for-byte idempotency check still recognizes the request.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (!record(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonical(value[key])]),
  );
}

function internalRequest(
  request: Request,
  path: string,
  options: { body?: JsonRecord; key?: string } = {},
): Request {
  const headers = new Headers({ authorization: request.headers.get('authorization') ?? '' });
  if (options.key !== undefined) headers.set('idempotency-key', options.key);
  if (options.body) headers.set('content-type', 'application/json');
  return new Request(`https://agent.internal${path}`, {
    method: options.body ? 'POST' : 'GET',
    headers,
    ...(options.body ? { body: JSON.stringify(canonical(options.body)) } : {}),
  });
}

/** Adapter is injected so MCP never makes a network request or forwards credentials to another host. */
export async function handleMcp(request: Request, dispatch: AgentHandler): Promise<Response> {
  if (!originAllowed(request)) return new Response('Forbidden origin', { status: 403 });
  const authenticated = await dispatch(internalRequest(request, '/api/agent/balance'));
  if (!authenticated.ok) return authenticated;
  if (request.method === 'GET') return new Response(null, { status: 405, headers: { Allow: 'POST' } });
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'GET, POST' } });
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
    return new Response('Expected application/json', { status: 415 });
  const version = request.headers.get('mcp-protocol-version');
  if (version && version !== VERSION)
    return new Response('Unsupported MCP protocol version', { status: 400 });
  const reader = request.body?.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let raw = '';
  let bytes = 0;
  try {
    if (reader) {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 32_768) {
          await reader.cancel();
          return new Response('Request too large', { status: 413 });
        }
        raw += decoder.decode(chunk.value, { stream: true });
      }
    }
    raw += decoder.decode();
  } catch {
    return rpcError(null, -32700, 'Parse error');
  } finally {
    reader?.releaseLock();
  }
  let message: unknown;
  try {
    message = JSON.parse(raw);
  } catch {
    return rpcError(null, -32700, 'Parse error');
  }
  if (
    !record(message) ||
    message.jsonrpc !== '2.0' ||
    typeof message.method !== 'string' ||
    ('id' in message &&
      message.id !== null &&
      typeof message.id !== 'string' &&
      typeof message.id !== 'number')
  )
    return rpcError(null, -32600, 'Invalid Request');
  if (!('id' in message)) return new Response(null, { status: 202 });
  const id = message.id;
  const respond = (result: unknown) => Response.json({ jsonrpc: '2.0', id, result });
  if (message.method === 'initialize') {
    if (!record(message.params) || typeof message.params.protocolVersion !== 'string')
      return rpcError(id, -32602, 'Invalid params');
    return respond({
      protocolVersion: VERSION,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'freeaivideo', version: '1.0.0' },
    });
  }
  if (message.method === 'ping') return respond({});
  if (message.method === 'tools/list') return respond({ tools });
  if (message.method !== 'tools/call') return rpcError(id, -32601, 'Method not found');
  if (
    !record(message.params) ||
    typeof message.params.name !== 'string' ||
    (message.params.arguments !== undefined && !record(message.params.arguments))
  )
    return rpcError(id, -32602, 'Invalid params');
  const args = (message.params.arguments ?? {}) as JsonRecord;
  let response: Response;
  switch (message.params.name) {
    case 'list_video_models':
      if (Object.keys(args).length) return rpcError(id, -32602, 'Invalid params');
      response = await dispatch(internalRequest(request, '/api/agent/models'));
      break;
    case 'get_credit_balance':
      if (Object.keys(args).length) return rpcError(id, -32602, 'Invalid params');
      response = authenticated;
      break;
    case 'get_video_job':
      if (
        typeof args.jobId !== 'string' ||
        !/^job_[a-z0-9]+$/.test(args.jobId) ||
        Object.keys(args).some((k) => k !== 'jobId')
      )
        return rpcError(id, -32602, 'Invalid params');
      response = await dispatch(internalRequest(request, `/api/agent/jobs/${args.jobId}`));
      break;
    case 'create_video': {
      if (
        typeof args.idempotencyKey !== 'string' ||
        !/^[A-Za-z0-9._~-]{1,128}$/.test(args.idempotencyKey) ||
        typeof args.modelId !== 'string' ||
        !args.modelId ||
        typeof args.prompt !== 'string' ||
        !args.prompt ||
        Object.keys(args).some(
          (k) => !['idempotencyKey', 'modelId', 'prompt', 'parameters', 'references'].includes(k),
        )
      )
        return rpcError(id, -32602, 'Invalid params');
      const { idempotencyKey, ...body } = args;
      response = await dispatch(
        internalRequest(request, '/api/agent/jobs', { body, key: idempotencyKey as string }),
      );
      break;
    }
    default:
      return rpcError(id, -32602, 'Unknown tool');
  }
  const text = await response.text();
  return respond({ content: [{ type: 'text', text }], ...(response.ok ? {} : { isError: true }) });
}
