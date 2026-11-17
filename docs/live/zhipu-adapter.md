# Zhipu upstream adapter

Status: in progress (2026-11-17). Motivation and channel survey: [free-trial-channels.md](free-trial-channels.md). Delete or fold into `docs/architecture.md` once a Zhipu-backed model has run in production.

`ModelDefinition.upstream` widens from `'yir'` to `'yir' | 'zhipu'`. `JobsEnv` gains an optional `ZHIPU_API_KEY` (Worker secret). `createAdapters` always constructs the adapter, so a missing key fails a job inside a step (refund path) exactly like a missing Yir key; mock mode serves both adapters from `MockAdapter`. Sites opt in per model via the server-side model table (`upstream: 'zhipu'`); nothing changes for Yir models.

## Upstream semantics (BigModel open platform, cogvideox-flash)

- Async task API: `POST /api/paas/v4/videos/generations` returns `{id, request_id, task_status}`; `GET /api/paas/v4/async-result/{id}` returns `task_status` of `PROCESSING | SUCCESS | FAIL` with `video_result[].url`. Bearer auth with `ZHIPU_API_KEY`.
- Video only (the adapter throws on image/music inputs). At most one reference image (`image_url`, public HTTPS); aspect ratio maps to a fixed `size` enum — cogvideox-flash has no true 16:9 below 1080p, so the site model exposes 1080p/5s only. Output length is fixed at ~5 s by the model; the adapter drops `duration`/`resolution` parameters and sends `aspect_ratio` only as the size mapping.
- Idempotency: the job's idempotency key is sent as `request_id`. BigModel does not document replay semantics for it, so a step retry after an ambiguous failure may create a second free task — acceptable because the upstream bills nothing; `cost()` always returns `$0, settled`.
- No cancel endpoint: `cancel()` is a no-op; an abandoned task keeps rendering on Zhipu's free quota. No long-poll parameter: `poll()` returns immediately; the runner's poll cadence governs.
- Rate limits are concurrency-based (≈3 in-flight tasks on free accounts): HTTP 429/5xx and network errors map to retryable `UpstreamError`s, 400/401/403/404/422 to rejected-and-final, matching the runner's submit/poll error paths.
- `freeUpstream = true`: cogvideox-flash never bills, so `reconcileFailure` settles a submit that exhausted its retries without a task ID at zero instead of freezing the job in `billing_pending`. Probed live 2026-11-17: an evening-peak 1305 overload outlasted all five step retries and froze a trial job exactly this way, which motivated the flag.
- `watermark_enabled` is left at its default (on): Zhipu only allows disabling watermarks after signing a disclaimer in their console. Trial output is watermarked until that decision is made deliberately.

## Live probe (2026-11-17 ~18:00 CST, real key)

- Auth works; submits consistently returned `1305` "该模型当前访问量过大" with **HTTP 429** for 6+ minutes during the evening peak — confirms the 429→retryable mapping and warns that the free model is heavily oversubscribed at peak. The runner's 5-step exponential retries (~5 min window) may still exhaust; if that shows up in production, the options are a site-level fallback to a Yir trial model on exhausted zhipu submits, or accepting occasional "busy" on the free model (the six Yir guest trials stay available either way).
- Poll of a nonexistent task returns **HTTP 400** with `error.code = '1233'` "任务不存在" — maps to rejected-and-final, which matches a vanished task; a just-submitted id has not been seen to 400 transiently.
- End-to-end generation (submit→SUCCESS→video_url) not yet observed because of the overload; verify off-peak before relying on the free channel in production.
