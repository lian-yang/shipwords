import { pageHead } from '@shipwords/core/seo';
import { createFileRoute } from '@tanstack/react-router';
import site from '../../site.config';
import '~/site/api-docs.css';

// Keep the public, machine-readable guide in public/agent-api.md in sync with this page.
export const Route = createFileRoute('/api-docs')({
  head: () =>
    pageHead(site, {
      title: 'Free AI Video API and MCP documentation',
      description: 'Connect your application or AI agent to Free AI Video with the API or MCP.',
      path: '/api-docs',
    }),
  component: ApiDocsPage,
});

const endpoints = [
  { method: 'GET', path: '/api/agent/models', detail: 'List models, supported settings, and credit prices.' },
  { method: 'GET', path: '/api/agent/balance', detail: 'Read your account credit balance.' },
  { method: 'POST', path: '/api/agent/uploads', detail: 'Upload a reference image.' },
  { method: 'POST', path: '/api/agent/jobs', detail: 'Create a paid video job.' },
  { method: 'GET', path: '/api/agent/jobs', detail: 'List up to 30 recent jobs for your account.' },
  { method: 'GET', path: '/api/agent/jobs/{jobId}', detail: 'Check an owned job and its results.' },
] as const;

const jobExample = `{
  "modelId": "seedance-2-5-v2",
  "prompt": "A paper boat sailing across a moonlit lake",
  "parameters": {
    "resolution": "720p",
    "duration": 5,
    "aspect_ratio": "16:9"
  }
}`;
const curlExample = `curl https://www.freeaivideo.app/api/agent/jobs \\
  -H "Authorization: Bearer $FREEAIVIDEO_API_KEY" \\
  -H 'Content-Type: application/json' \\
  -H 'Idempotency-Key: example-video-001' \\
  --data '{"modelId":"seedance-2-5-v2","prompt":"A paper boat sailing across a moonlit lake"}'`;

function ApiDocsPage() {
  return (
    <article className="api-docs">
      <header className="api-docs-intro">
        <p className="api-docs-eyebrow">Developer documentation</p>
        <h1>Free AI Video API &amp; MCP</h1>
        <p>Generate videos with your account credits from an application or an AI agent.</p>
        <nav className="api-docs-jump" aria-label="On this page">
          <a href="#getting-started">Get started</a>
          <a href="#http-api">HTTP API</a>
          <a href="#create-a-job">Create a job</a>
          <a href="#mcp">MCP</a>
        </nav>
      </header>

      <section id="getting-started" className="api-docs-section">
        <h2>Get started</h2>
        <ol>
          <li>
            Sign in to Free AI Video and open <strong>Account</strong>.
          </li>
          <li>
            Under <strong>AI agent access</strong>, create an API key and save it when it appears. You can
            revoke it from the same screen.
          </li>
          <li>
            Send the key with each request in the <code>Authorization: Bearer YOUR_API_KEY</code> header.
          </li>
        </ol>
        <p>
          Keep your key private. Do not embed it in browser code or commit it to a public repository. Keys are
          shown only once.
        </p>
        <p>
          The API uses paid account credits; website free trials are not available through this interface.
          Each account can make 3,000 agent API requests per UTC day across all its keys. Some MCP calls use
          two requests. The limit returns HTTP 429.
        </p>
      </section>

      <section id="http-api" className="api-docs-section">
        <h2>HTTP API</h2>
        <p>
          Base URL: <code>https://www.freeaivideo.app</code>
        </p>
        <div className="api-docs-endpoints">
          {endpoints.map((endpoint) => (
            <div className="api-docs-endpoint" key={`${endpoint.method} ${endpoint.path}`}>
              <span className={`api-docs-method ${endpoint.method === 'POST' ? 'api-docs-method-post' : ''}`}>
                {endpoint.method}
              </span>
              <div>
                <code>{endpoint.path}</code>
                <p>{endpoint.detail}</p>
              </div>
            </div>
          ))}
        </div>
        <h3>Reference images</h3>
        <p>
          To upload an image, send raw bytes to <code>POST /api/agent/uploads</code> with a{' '}
          <code>Content-Length</code> and a content type of <code>image/png</code>, <code>image/jpeg</code>,
          or <code>image/webp</code>. The maximum is 10 MB and each dimension must be at least 160 pixels. The
          response contains a site path and URL.
        </p>
        <p>
          Use the returned site path in a job’s <code>references</code> array. External image URLs are not
          accepted, and reference requirements vary by model.
        </p>
      </section>

      <section id="create-a-job" className="api-docs-section">
        <h2>Create a job</h2>
        <p>
          Choose a model and supported settings from <code>GET /api/agent/models</code>. Send a model ID and a
          nonempty prompt; settings and references are optional.
        </p>
        <pre>
          <code>{jobExample}</code>
        </pre>
        <p>
          Send this body to <code>POST /api/agent/jobs</code> with <code>Content-Type: application/json</code>{' '}
          and an <code>Idempotency-Key</code>. The response contains a <code>job</code> with an ID. Poll{' '}
          <code>GET /api/agent/jobs/&#123;jobId&#125;</code> for status and output URLs. Anyone with an output
          URL can access it, so treat the URL as private.
        </p>
        <h3>Retrying safely</h3>
        <p>
          Use a fresh idempotency key for each intended generation. It must contain 1–128 ASCII letters,
          digits, <code>.</code>, <code>_</code>, <code>~</code>, or <code>-</code>. If a response is lost,
          retry with the same key and the same JSON values. Object property order and whitespace do not
          matter; changed values with the same key are rejected. A new key may create and charge for another
          job.
        </p>
        <p>
          In the rare case that service is interrupted after a job and its credit reservation are created but
          before dispatch, a retry can return that job as <code>queued</code>. It will be handled by the
          timeout process. Do not retry with a new key; contact{' '}
          <a href="mailto:support@freeaivideo.app">support@freeaivideo.app</a> with the job ID.
        </p>
        <p>
          Errors include an <code>error</code> object. For example, insufficient credits return HTTP 402.
        </p>
        <h3>Example request</h3>
        <p>Store the key in an environment variable before running this command:</p>
        <pre>
          <code>{curlExample}</code>
        </pre>
      </section>

      <section id="mcp" className="api-docs-section">
        <h2>Connect an AI agent with MCP</h2>
        <p>
          Use an MCP client that supports <strong>Streamable HTTP</strong> and a static authorization header.
        </p>
        <dl className="api-docs-config">
          <div>
            <dt>URL</dt>
            <dd>
              <code>https://www.freeaivideo.app/api/mcp</code>
            </dd>
          </div>
          <div>
            <dt>Header</dt>
            <dd>
              <code>Authorization: Bearer YOUR_API_KEY</code>
            </dd>
          </div>
          <div>
            <dt>Protocol version</dt>
            <dd>
              <code>2025-06-18</code>
            </dd>
          </div>
        </dl>
        <p>
          The stateless server returns JSON responses and provides <code>list_video_models</code>,{' '}
          <code>get_credit_balance</code>, <code>create_video</code>, and <code>get_video_job</code>.
        </p>
        <p>
          <code>create_video</code> spends credits and accepts <code>idempotencyKey</code>,{' '}
          <code>modelId</code>, <code>prompt</code>, and optional <code>parameters</code> and{' '}
          <code>references</code>. Reuse the same key and arguments when retrying. Upload any reference image
          with the HTTP API first.
        </p>
        <p>
          The endpoint does not support server-initiated SSE, MCP sessions, OAuth discovery or login, the
          older HTTP+SSE transport, or an MCP upload tool. Your client must send the Bearer header on every
          request. Browser-origin requests are accepted only from the site’s own origin.
        </p>
      </section>
    </article>
  );
}
