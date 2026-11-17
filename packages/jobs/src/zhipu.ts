// Zhipu BigModel upstream: the free cogvideox-flash video model behind an async task API.
// Docs: https://docs.bigmodel.cn/api-reference/模型-api/视频生成异步.md — submit returns a task id and
// `GET /paas/v4/async-result/{id}` reports PROCESSING/SUCCESS/FAIL. The model is free, so there is no
// billing to read; there is also no cancel endpoint and no long-poll parameter, so cancel is a no-op and
// poll returns immediately. See docs/live/zhipu-adapter.md.

import type {
  PollResult,
  SubmitInput,
  UpstreamAdapter,
  UpstreamCost,
} from './upstream';
import { UpstreamError } from './upstream';

const DEFAULT_BASE_URL = 'https://open.bigmodel.cn/api';

/** cogvideox-flash's fixed size enum by aspect ratio; there is no true 16:9 below 1080p. */
const SIZES: Readonly<Record<string, string>> = {
  '16:9': '1920x1080',
  '9:16': '1080x1920',
  '1:1': '1024x1024',
  '4:3': '1280x960',
  '3:4': '960x1280',
};

/**
 * A plain fetch can fail before a task exists; unlike the Yir SDK there is no built-in retry, so network
 * errors and 429/5xx stay retryable and a Workflow step retry resubmits with the same `request_id`.
 * A duplicate free task is harmless (see cost).
 */
function toUpstreamError(error: unknown): UpstreamError {
  const e = error as { code?: string; message?: string; status?: number };
  const retryable = e?.status === undefined || e.status === 429 || e.status >= 500;
  const rejected = e?.status !== undefined && [400, 401, 403, 404, 422].includes(e.status);
  return new UpstreamError(e?.code ?? 'zhipu_error', e?.message ?? String(error), retryable, rejected);
}

/** The task body for one video: text and/or a single reference image; `request_id` carries the idempotency key. */
export function buildZhipuVideoRequest(input: SubmitInput, idempotencyKey: string): Record<string, unknown> {
  if (input.kind !== 'video')
    throw new UpstreamError('invalid_input', `zhipu takes video jobs, got ${input.kind}`, false, true);
  if (input.references.length > 1)
    throw new UpstreamError('invalid_input', 'zhipu takes at most one reference image', false, true);
  // The model fixes the length (~5 s), so duration/resolution parameters are dropped; the aspect ratio
  // becomes the size. Watermarks stay at their default (on): Zhipu requires a signed disclaimer to turn them off.
  const aspect = input.parameters['aspect_ratio'];
  if (aspect !== undefined && !SIZES[String(aspect)])
    throw new UpstreamError('invalid_input', `unsupported aspect_ratio ${String(aspect)}`, false, true);
  return {
    model: input.upstreamModel,
    prompt: input.prompt,
    ...(input.references[0] ? { image_url: input.references[0]!.url } : {}),
    ...(aspect !== undefined ? { size: SIZES[String(aspect)] } : {}),
    request_id: idempotencyKey,
  };
}

interface ZhipuTask {
  task_status?: string;
  video_result?: { url?: string }[];
}

export class ZhipuAdapter implements UpstreamAdapter {
  readonly name = 'zhipu';

  constructor(private readonly options: { apiKey: string; baseURL?: string }) {}

  /** Created lazily: a missing API key raises a non-retryable error inside a step, so the job fails and is refunded instead of hanging. */
  private get apiKey(): string {
    if (!this.options.apiKey)
      throw new UpstreamError('zhipu_not_configured', 'ZHIPU_API_KEY is not set', false, true);
    return this.options.apiKey;
  }

  private get baseURL(): string {
    return (this.options.baseURL ?? DEFAULT_BASE_URL).replace(/\/$/, '');
  }

  /** One JSON API call; non-2xx raises with the platform's `error.code` when present. */
  private async request(path: string, method: 'POST' | 'GET', body?: unknown): Promise<Record<string, unknown>> {
    let response: Response;
    try {
      response = await fetch(`${this.baseURL}${path}`, {
        method,
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch (error) {
      throw new UpstreamError('zhipu_network', `request failed: ${String(error)}`, true);
    }
    const payload = (await response.json().catch(() => null)) as
      | (Record<string, unknown> & { error?: { code?: string; message?: string } })
      | null;
    if (!response.ok) {
      throw new UpstreamError(
        payload?.error?.code ?? `http_${response.status}`,
        payload?.error?.message ?? `HTTP ${response.status}`,
        response.status === 429 || response.status >= 500,
        [400, 401, 403, 404, 422].includes(response.status),
      );
    }
    return payload ?? {};
  }

  prepare(input: SubmitInput): void {
    const request = buildZhipuVideoRequest(input, 'prepare');
    JSON.stringify(request);
    void this.apiKey;
  }

  async submit(input: SubmitInput, idempotencyKey: string) {
    const task = await this.request('/paas/v4/videos/generations', 'POST', buildZhipuVideoRequest(input, idempotencyKey));
    const id = task['id'];
    if (typeof id !== 'string' || !id)
      throw new UpstreamError('zhipu_no_task_id', 'submit returned no task id', true);
    return { upstreamJobId: id };
  }

  async poll(upstreamJobId: string): Promise<PollResult> {
    const task = (await this.request(`/paas/v4/async-result/${encodeURIComponent(upstreamJobId)}`, 'GET')) as ZhipuTask;
    if (task.task_status === 'SUCCESS') {
      const url = task.video_result?.[0]?.url;
      if (!url)
        return { state: 'failed', code: 'result_missing', message: 'zhipu task succeeded without a video url' };
      return { state: 'succeeded', files: [{ url, mediaType: 'video/mp4' }] };
    }
    // The API reports FAIL without detail; content policy rejections included.
    if (task.task_status === 'FAIL')
      return { state: 'failed', code: 'upstream_failed', message: 'zhipu reported task FAIL' };
    return { state: 'running' };
  }

  /** The model is free: settle at zero so a failed job refunds immediately in settlement. */
  async cost(_upstreamJobId: string): Promise<UpstreamCost> {
    return { usd: '0', settled: true };
  }

  /** No cancel endpoint: an abandoned task keeps rendering on Zhipu's free quota. */
  async cancel(_upstreamJobId: string): Promise<void> {}
}
