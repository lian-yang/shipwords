# Free AI Video API and MCP

Use your Free AI Video account credits to generate videos from an agent or application. Sign in, open **Account**, and create an API key in the agent API keys section. Copy the secret when it is created; it is only shown once. You can revoke keys from the same account screen. Keep the secret private and do not embed it in browser code or public repositories.

Base URL: `https://www.freeaivideo.app`. Send `Authorization: Bearer YOUR_API_KEY` on each request. The agent API supports paid generations only; it does not use the website's free trials. Each account is limited to 3,000 agent API requests per UTC day across all its keys; exceeding the limit returns HTTP 429. Some MCP calls make two agent API requests and therefore count twice.

## HTTP API

| Method and path | Purpose |
| --- | --- |
| `GET /api/agent/models` | List models, settings, and the credit cost for each available resolution and duration. |
| `GET /api/agent/balance` | Read the account credit balance. |
| `POST /api/agent/uploads` | Upload a reference image. Send the raw image bytes with `Content-Type: image/png`, `image/jpeg`, or `image/webp`, and `Content-Length`. Maximum 10 MB; both image dimensions must be at least 160 pixels. Returns `path` and `url`. |
| `POST /api/agent/jobs` | Create a paid job. Requires `Content-Type: application/json` and `Idempotency-Key`. |
| `GET /api/agent/jobs` | List up to 30 recent jobs belonging to the account. |
| `GET /api/agent/jobs/{jobId}` | Read one owned job's status and outputs. Poll this endpoint until the job completes. |

To create a job, supply a model ID and nonempty prompt, with optional settings and reference images:

```json
{
  "modelId": "MODEL_ID",
  "prompt": "A paper boat sailing across a moonlit lake",
  "parameters": {
    "resolution": "720p",
    "duration": 5,
    "aspect_ratio": "16:9"
  },
  "references": ["/files/uploads/up_0123456789abcdef0123456789abcdef.png"]
}
```

Choose a model and supported settings from the models response; omit optional fields when not needed. References must be paths returned by this site's upload endpoint, not arbitrary external URLs. Reference requirements vary by model. A successful creation returns `{ "job": ... }`; `job.id` is used to check progress. The completed job's `outputs` contain result URLs. Treat these URLs as private: anyone with a result URL can access it.

Use a fresh `Idempotency-Key` for each intended generation. A key is 1–128 ASCII letters, digits, `.`, `_`, `~`, or `-`. If the response is lost, retry with the **same key and the same JSON values**. Object property order and whitespace do not matter; a request with different values under the same key is rejected. Retrying with a new key can create another job and spend more credits. In the rare event of a service interruption after a job is created and credits are reserved but before dispatch starts, a retry can return the existing job in `queued` status. It will be handled by the timeout process. Do not retry with a new key; contact [support@freeaivideo.app](mailto:support@freeaivideo.app) with the job ID for help. Failed requests return an HTTP error and an `error` object; for example, insufficient credits return HTTP 402.

Example, using an environment variable to avoid putting your secret in the command:

```sh
curl https://www.freeaivideo.app/api/agent/jobs \
  -H "Authorization: Bearer $FREEAIVIDEO_API_KEY" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: example-video-001' \
  --data '{"modelId":"MODEL_ID","prompt":"A paper boat sailing across a moonlit lake"}'
```

## MCP

Connect an MCP client that supports **Streamable HTTP** and a static authorization header:

- URL: `https://www.freeaivideo.app/api/mcp`
- Header: `Authorization: Bearer YOUR_API_KEY`
- Protocol version: `2025-06-18`

This stateless server returns JSON responses and offers `list_video_models`, `get_credit_balance`, `create_video`, and `get_video_job`. `create_video` accepts `idempotencyKey`, `modelId`, `prompt`, and optional `parameters` and `references`; it spends credits. Reuse the same key and the same arguments for retries. Upload reference images through the HTTP API before passing their site paths to MCP.

The endpoint does not provide server-initiated SSE, MCP sessions, OAuth discovery or login, the older HTTP+SSE transport, or an MCP upload tool. Clients must support supplying the Bearer header on every request. A browser-origin request is accepted only from the site's own origin.
