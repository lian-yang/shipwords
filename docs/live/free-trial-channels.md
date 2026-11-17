# Free upstream channels for guest trials

Status: research (2026-11-17); step 1 implemented same day — Zhipu adapter + a guest-eligible
`cogvideox-flash-v2` model, see [zhipu-adapter.md](zhipu-adapter.md). Not deployed; needs the
`ZHIPU_API_KEY` Worker secret first. freeaivideo guest trials otherwise all render on
Yir (billable); the site's trial caps are `$0.12–0.50` per video (`src/video-pricing.server.ts`).
This file surveys free channels found on 2026-11-17; delete or fold into `docs/architecture.md`
when a decision ships.

## What any replacement must satisfy

- Callable from a Worker: plain HTTPS REST, no long-lived socket.
- Fits `UpstreamAdapter` (`submit` → `poll` → `cost`/`cancel`, `packages/jobs/src/upstream.ts`);
  Yir is currently the only real adapter, so a second one is additive, not a rewrite.
- Guest trials render 4–5 s at 480p-class with `aspect_ratio` as the only user parameter.
- Text-to-video at minimum; image-to-video if the trial keeps reference input.
- Commercial use allowed: this is a paid product's funnel, not a hobby.

## Tier 1 — sustainable free (verified primary sources)

**Zhipu CogVideoX-Flash** (`cogvideox-flash`, docs.bigmodel.cn) — the only truly free,
commercial-facing video API found.

- Marked 免费 on the pricing page (Batch API unsupported); community measurements put the
  limit at **concurrency ≈ 3 in-flight tasks** with no published daily count; higher tiers
  come with account spend.
- Same async REST shape as Yir: `POST /api/paas/v4/videos/generations`, then
  `GET /paas/v4/async-result/{id}`. Text-to-video and image-to-video (URL or base64,
  ≤5 MB) on the same endpoint.
- Sizes include `720x480` / `1024x1024` (the trial's 480p/1:1 territory) up to 4K;
  fps 30/60. `duration` (5/10) is documented on `cogvideox-3`, not on flash — flash is
  fixed-length (5 s), which matches the trial default.
- Open questions before going live: watermark on API output, commercial-use clause in the
  Zhipu developer terms, and whether quality is acceptable for a meme-video funnel
  (community consensus: below Seedance/Veo tier, fine for short meme clips).

**Excluded after verification:**

- ModelScope API-Inference (free 2000 calls/day, 500/model) — explicitly **non-commercial**.
- Gemini API free tier — Veo is effectively absent from the free tier (Tier 1 starts at
  ~10 videos/day).
- Cloudflare Workers AI — no video-generation model in the catalog (checked 2026-11).
- "Free unlimited Veo/Sora API" claims circulating on Reddit (geminigen.ai etc.) —
  consumer web tools, no API, treat as noise.

## Tier 2 — recurring or one-shot credits (buffer, not a solution)

| Channel | What's free | Catch |
| --- | --- | --- |
| Volcano Engine Seedance 2.0-fast beta | 20 calls/month per verified account, resets monthly, QPS ≤ 2, 1–10 s | Must apply for the beta tier; tiny volume, explicitly not for production |
| Aliyun Bailian new-user quota | Video generation quota, 90 days from activation | One-time; failure calls don't consume quota |
| Novita.ai | $100 sandbox credits, 90 days | One-time |
| fal.ai signup credits | Small sign-up credit, no card needed | One-time; **fal Startup Program: $1k–5k credits for Europe/Asia startups** — the legit lever here |
| Google for Startups | $2k (bootstrapped) up to $250k/yr (AI-first), covers Vertex incl. Veo | Application, funding-stage criteria |
| Vidu / Kling / MiniMax open platforms | New-user credits reported, amounts unverified | Verify at signup; one-time |

Red line: never farm these by rotating new accounts — every provider binds quotas to
verified identity and this is ToS-violation + ban territory for the whole funnel. Use the
startup-credit programs instead; they are designed for exactly this.

## Tier 3 — structural: self-hosted open weights

Marginal cost per trial render drops to cents of GPU time; a second `UpstreamAdapter`
points at a small HTTP queue in front of the GPU box.

- **LTX-2.x** — open weights, Lightricks license **free for commercial use under $10M ARR**
  (fits this repo's sites today), incl. LTX-2.5 with LoRA support. Fast variants are the
  closest to real-time of the open field.
- **Wan 2.1/2.2** — Apache 2.0, weights on HF/ModelScope.
- **HunyuanVideo 1.5** — 8.3 B, ~14 GB VRAM, runs on RTX 3090/4070Ti/4090-class cards,
  T2V + I2V + 1080p upscale.
- GPU rental 2026-11: Vast 4090 $0.13–0.48/hr (interruptible from ~$0.08), RunPod
  Community $0.34/hr, Salad ~$0.16/hr. At 2–6 min per 5 s 480p render that is roughly
  **$0.01–0.05 per trial**, 3–10× under the current Yir trial caps — but it adds an
  always-on box, a queue, and model ops that packages/jobs currently doesn't own.

## Recommendation

1. Now: add a CogVideoX-Flash upstream adapter; move the cheapest guest trial (the
   `$0.12` caps) onto it, keep Yir as fallback for rate-limit errors. Small, reversible,
   `packages/jobs`-only change (serial, needs a `docs/live/` interface note first).
2. Same week: apply to fal Startup Program + Google for Startups with the paid-site
   revenue numbers; credits are free money for the remaining Yir traffic.
3. If trial volume grows: pilot one LTX-2 (or HunyuanVideo 1.5) box on Vast/RunPod behind
   a second adapter and route only the lowest-priced guest model there.

## Sources

- CogVideoX-Flash (free model page): https://docs.bigmodel.cn/cn/guide/models/free/cogvideox-flash
- BigModel pricing (CogVideoX-Flash 免费, Vidu resale): https://docs.bigmodel.cn/cn/guide/start/pricing
- BigModel video async API + rate limits: https://docs.bigmodel.cn/api-reference/模型-api/视频生成异步.md , https://docs.bigmodel.cn/cn/api/rate-limit.md
- Concurrency measurements (CogVideoX-Flash ≈ 3): https://aisharenet.com/zhipuqingyanflash
- Volcano Seedance 2.0-fast free quota (20/month): https://www.volcengine.com/article/2686745
- Bailian new-user quota (90 days): https://help.aliyun.com/zh/model-studio/new-free-quota
- Veo free tier impractical: https://discuss.ai.google.dev/t/tier-1-quota-ai-studio/173039
- ModelScope limits (non-commercial): https://www.modelscope.cn/docs/model-service/API-Inference/limits
- LTX-2 license (<$10M ARR free): https://ltx.io/model/license
- HunyuanVideo 1.5: https://github.com/Tencent-Hunyuan/HunyuanVideo-1.5/blob/main/README_CN.md
- fal Startup Program: https://fal.ai/startup-program ; Google for Startups: https://cloud.google.com/startup
- GPU pricing: https://www.runpod.io/gpu-models/rtx-4090 , https://vast.ai/article/how-much-does-it-cost-to-rent-a-gpu-in-the-cloud-live-pricing-guide
