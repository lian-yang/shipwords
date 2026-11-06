import { ApiError, postJson } from '@shipwords/core/react/account';
import { getRecaptchaToken } from '@shipwords/core/react/recaptcha';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getTurnstileToken } from './turnstile';

// Headless hooks for generation jobs: submit, poll to completion, resume in-flight jobs after a refresh. Styling and layout are up to the site.

export interface PublicJob {
  id: string;
  modelId: string;
  status: 'queued' | 'submitted' | 'succeeded' | 'failed' | 'canceled';
  prompt: string;
  costCredits: number;
  settlement: 'not_applicable' | 'pending' | 'refunded' | 'charged';
  outputs: { url: string; mediaType: string }[];
  /** Failure code only; sites show their own copy for failed jobs. */
  error: { code: string } | null;
  createdAt: number;
  finishedAt: number | null;
}

export interface GenerateInput {
  modelId: string;
  /** Required for regular models; effects don't accept a prompt. */
  prompt?: string;
  /** Music models: the user's lyrics; without them the model writes lyrics from the prompt (or makes an instrumental). */
  lyrics?: string;
  references?: string[];
  parameters?: Record<string, unknown>;
  /** Effects: slot ID → path returned by uploadReference. */
  slots?: Record<string, string>;
}

const POLL_MS = 2500;
const SETTLEMENT_POLL_MS = 30_000;

/** Keep checking terminal jobs only while billing is pending; settled jobs stop polling. */
export function generationPollDelay(job: Pick<PublicJob, 'status' | 'settlement'>): number | null {
  if (job.status === 'queued' || job.status === 'submitted') return POLL_MS;
  return job.settlement === 'pending' ? SETTLEMENT_POLL_MS : null;
}

// The server takes PNG, JPEG and WebP up to 10 MB; phone screenshots and HEIC photos often aren't, so they're re-encoded here first.
const UPLOAD_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const UPLOAD_MAX_BYTES = 8 * 1024 * 1024;
const UPLOAD_MAX_SIDE = 2560;
const HEIC = /\.hei[cf]$/i;

/** For file inputs: any image, plus HEIC by extension so desktop pickers don't hide iPhone photos; uploadReference converts what the browser can decode. */
export const UPLOAD_ACCEPT = 'image/*,.heic,.heif';

/** For drag and drop: whether a dropped file is worth trying (Windows often reports HEIC with an empty type). */
export function acceptsUpload(file: File): boolean {
  return file.type.startsWith('image/') || HEIC.test(file.name);
}

async function fitForUpload(file: File): Promise<Blob> {
  if (file.size <= UPLOAD_MAX_BYTES && UPLOAD_TYPES.has(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, UPLOAD_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d')!;
    // JPEG has no alpha: without a fill, transparent areas turn black.
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (blob) return blob;
  } catch {
    // Not decodable here (HEIC outside Safari, for one); fall through.
  }
  if (UPLOAD_TYPES.has(file.type)) return file;
  throw new ApiError(
    "This browser can't read this photo format. Use a JPG or PNG.",
    'unsupported_type',
    415,
    {},
  );
}

export async function uploadReference(file: File): Promise<string> {
  const body = await fitForUpload(file);
  const response = await fetch('/api/uploads', {
    method: 'POST',
    headers: { 'content-type': body.type },
    body,
  });
  const data = (await response.json()) as { path?: string; error?: { code: string; message: string } };
  if (!response.ok || !data.path) {
    throw new ApiError(data.error?.message ?? 'Upload failed', data.error?.code, response.status, {});
  }
  return data.path;
}

/**
 * jobs: recent jobs (newest first); generate: submit a job.
 * When error.code is login_required, prompt sign-in; when insufficient_credits, prompt a purchase.
 */
export function useGeneration(options: {
  recaptchaSiteKey: string | null;
  /** Cloudflare Turnstile site key: takes precedence over reCAPTCHA when set. The page must render a `#turnstile-slot` container. */
  turnstileSiteKey?: string | null;
}) {
  const [jobs, setJobs] = useState<PublicJob[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const mounted = useRef(false);
  const timers = useRef(
    new Map<string, { timer?: ReturnType<typeof setTimeout>; active: boolean; delay: number }>(),
  );

  const upsert = useCallback((job: PublicJob) => {
    setJobs((list) =>
      [job, ...list.filter((item) => item.id !== job.id)].sort((a, b) => b.createdAt - a.createdAt),
    );
  }, []);

  const watch = useCallback(
    (jobId: string, initialDelay = POLL_MS) => {
      if (!mounted.current || timers.current.has(jobId)) return;
      const watcher: { timer?: ReturnType<typeof setTimeout>; active: boolean; delay: number } = {
        active: true,
        delay: initialDelay,
      };
      timers.current.set(jobId, watcher);
      const tick = async () => {
        try {
          const response = await fetch(`/api/jobs/${jobId}`);
          if (response.ok) {
            const { job } = (await response.json()) as { job: PublicJob };
            if (!watcher.active) return;
            upsert(job);
            const next = generationPollDelay(job);
            if (next === null) {
              watcher.active = false;
              timers.current.delete(jobId);
              return;
            }
            watcher.delay = next;
          }
        } catch {
          // Keep polling through network blips.
        }
        if (watcher.active) watcher.timer = setTimeout(tick, watcher.delay);
      };
      watcher.timer = setTimeout(tick, watcher.delay);
    },
    [upsert],
  );

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    void fetch('/api/jobs')
      .then((response) => (response.ok ? response.json() : { jobs: [] }))
      .then((value) => {
        const data = value as { jobs: PublicJob[] };
        if (cancelled) return;
        setJobs(data.jobs);
        for (const job of data.jobs) {
          const delay = generationPollDelay(job);
          if (delay !== null) watch(job.id, delay);
        }
      })
      .catch(() => undefined);
    const pending = timers.current;
    return () => {
      mounted.current = false;
      cancelled = true;
      for (const watcher of pending.values()) {
        watcher.active = false;
        if (watcher.timer) clearTimeout(watcher.timer);
      }
      pending.clear();
    };
  }, [watch]);

  const generate = useCallback(
    async (input: GenerateInput) => {
      setSubmitting(true);
      setError(null);
      try {
        const captchaToken = options.turnstileSiteKey
          ? await getTurnstileToken(options.turnstileSiteKey)
          : options.recaptchaSiteKey
            ? await getRecaptchaToken(options.recaptchaSiteKey, 'generate')
            : null;
        const { job } = await postJson<{ job: PublicJob }>('/api/jobs', {
          ...input,
          recaptchaToken: captchaToken,
        });
        upsert(job);
        watch(job.id);
        return job;
      } catch (e) {
        setError(e instanceof ApiError ? e : new ApiError(String(e), undefined, 0, {}));
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [options.recaptchaSiteKey, options.turnstileSiteKey, upsert, watch],
  );

  const cancel = useCallback(
    async (jobId: string) => {
      try {
        const { job } = await postJson<{ job: PublicJob | null }>(`/api/jobs/${jobId}/cancel`, {});
        if (job) upsert(job);
      } catch (e) {
        // The upstream got the job between two polls: it keeps going and delivers, and the next poll shows it running.
        if (e instanceof ApiError && e.code === 'job_started') return;
        setError(e instanceof ApiError ? e : new ApiError(String(e), undefined, 0, {}));
      }
    },
    [upsert],
  );

  return { jobs, generate, cancel, submitting, error, clearError: () => setError(null) };
}
