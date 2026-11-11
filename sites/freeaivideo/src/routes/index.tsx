import { ApiError } from '@shipwords/core/react/account';
import { pageHead } from '@shipwords/core/seo';
import { creditsFor, sanitizeParameters } from '@shipwords/jobs/models';
import { type PublicJob, UPLOAD_ACCEPT, uploadReference, useGeneration } from '@shipwords/jobs/react';
import { createFileRoute, getRouteApi } from '@tanstack/react-router';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { authClient } from '~/lib/auth';
import { track } from '~/lib/track';
import { notifyTrialsChanged, signupTrialDescription, useTrials } from '~/lib/trials';
import { notifyCreditsChanged } from '~/lib/use-credit-balance';
import { m } from '~/paraglide/messages.js';
import { getLocale } from '~/paraglide/runtime.js';
import { useSharedCreditBalance } from '~/site/credit-balance';
import { CreditSummary, creditShortfall } from '~/site/credit-summary';
import { getFaqs } from '~/site/faq';
import { Plans, PricingLink } from '~/site/pricing';
import { getPromptPreset } from '~/site/prompt-presets';
import { openSignIn } from '~/site/sign-in';
import type { GenerationMode } from '~/trial-types';
import { DEFAULT_TRIAL_MODEL_ID, restoredModelId, VIDEO_OPTIONS } from '~/video-options';
import site from '../../site.config';
import models from '../../site.models';

// Tool page template: the tool above the fold, site-specific content sections and pricing below. Start a new site here and rewrite titles, copy and sections for the target keyword.
// Copy lives in messages/home. Locale is per request, so constants hold message functions that are called at render time.

export const Route = createFileRoute('/')({
  head: () =>
    pageHead(site, {
      title: m.home_meta_title({ name: site.name }),
      description: m.home_meta_description(),
      path: '/',
      image: `${site.url}/og.jpg`,
      jsonLd: [
        {
          '@type': 'WebApplication',
          name: site.name,
          url: site.url,
          applicationCategory: 'MultimediaApplication',
          operatingSystem: 'Web',
        },
        {
          '@type': 'FAQPage',
          mainEntity: getFaqs().map((faq) => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: { '@type': 'Answer', text: faq.answer },
          })),
        },
      ],
    }),
  component: ToolPage,
});

const root = getRouteApi('__root__');
const defaultTrialModel = (() => {
  const model = models.find((item) => item.id === DEFAULT_TRIAL_MODEL_ID && item.guest);
  if (!model) throw new Error('Default trial model must be trial eligible');
  return model;
})();
const STEPS = [
  { id: 'prompt', title: m.home_how_prompt_title, body: m.home_how_prompt },
  { id: 'options', title: m.home_how_options_title, body: m.home_how_options },
  { id: 'download', title: m.home_how_download_title, body: m.home_how_download },
];
const IDEAS = [
  { id: 'world', name: m.home_idea_world, prompt: m.home_idea_world_prompt },
  { id: 'neon', name: m.home_idea_neon, prompt: m.home_idea_neon_prompt },
  { id: 'wild', name: m.home_idea_wild, prompt: m.home_idea_wild_prompt },
];

// Generator state is kept in sessionStorage so input survives sign-in, leaving for checkout, or a reload.
const STATE_KEY = 'tool:state';
type ToolState = {
  modelId: string;
  prompt: string;
  aspectRatio: string;
  references: string[];
  mode?: GenerationMode;
  resolution?: string;
  duration?: number;
};

function saveState(state: ToolState) {
  try {
    sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {}
}

function loadState(): ToolState | null {
  try {
    return JSON.parse(sessionStorage.getItem(STATE_KEY) ?? 'null') as ToolState | null;
  } catch {
    return null;
  }
}

const isActive = (job: PublicJob) => job.status === 'queued' || job.status === 'submitted';

// Real clips rendered by this site (prod jobs, 2026-11-01): the videos stand as proof,
// the captions are the exact prompts they got. No staged or third-party footage.
const CASES = [
  {
    src: `${site.url}/files/jobs/job_33c7460f8eae44bf9824b1ecabe02d4b/0.mp4`,
    poster: '/case-koi.jpg',
    title: m.home_case_koi_title,
    prompt: 'Golden koi fish swimming through clouds above a mountain temple at sunrise',
  },
  {
    src: `${site.url}/files/jobs/job_96c8d405ee0647fe9f3115f278584d71/0.mp4`,
    poster: '/case-lighthouse.jpg',
    title: m.home_case_lighthouse_title,
    prompt: 'A lighthouse beam sweeping over bioluminescent waves at midnight, gulls startled into flight',
  },
  {
    src: `${site.url}/files/jobs/job_a1bbafbdd2f647cc9921c62503bf63bc/0.mp4`,
    poster: '/case-fox.jpg',
    title: m.home_case_fox_title,
    prompt: 'A red fox trotting across fresh snow under the northern lights, breath fogging',
  },
];

// Actual image-to-video inputs and downloads; see design/sample-generation-2026-11-11 for provenance.
const IMAGE_CASES = [
  {
    src: '/examples/product-video.mp4',
    poster: '/examples/product-poster.jpg',
    input: '/examples/product-input.jpg',
    inputAlt: m.home_image_case_product_alt,
    title: m.home_image_case_product_title,
    settings: m.home_image_case_product_settings,
    limit: m.home_image_case_product_limit,
    prompt:
      'A slow, subtle camera push toward the amber bottle as soft warm light shifts gently across the glass. The bottle, dropper and stone stay still and keep their shape. Photorealistic product shot, no text, no logos.',
  },
  {
    src: '/examples/music-video.mp4',
    poster: '/examples/music-poster.jpg',
    input: '/examples/music-input.jpg',
    inputAlt: m.home_image_case_music_alt,
    title: m.home_image_case_music_title,
    settings: m.home_image_case_music_settings,
    limit: m.home_image_case_music_limit,
    prompt:
      'Animate this rainy city cover art: raindrops move down the window, distant cyan and violet reflections gently shimmer on the wet street, and the camera slowly pushes forward. Preserve the composition and moody nighttime palette. No text, logos, people, or cuts.',
  },
];

function ToolPage() {
  const config = root.useLoaderData();
  const session = authClient(config.googleClientId).useSession();
  const balance = useSharedCreditBalance();
  const trials = useTrials(session.data?.user.id, session.isPending);
  const [mode, setMode] = useState<GenerationMode>('daily-trial');
  const { jobs, generate, cancel, submitting, error, clearError } = useGeneration({
    recaptchaSiteKey: mode === 'paid' ? null : config.recaptchaSiteKey,
    turnstileSiteKey: mode === 'paid' ? null : config.turnstileSiteKey,
  });
  const [modelId, setModelId] = useState<string>(defaultTrialModel.id);
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState(String(defaultTrialModel.defaults.aspect_ratio ?? '16:9'));
  const [resolution, setResolution] = useState(VIDEO_OPTIONS[defaultTrialModel.id]!.default.resolution);
  const [duration, setDuration] = useState(VIDEO_OPTIONS[defaultTrialModel.id]!.default.duration);
  const [references, setReferences] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [resumed, setResumed] = useState(false);
  // Ask for confirmation when a job is already running: users who think nothing happened click again and get charged twice.
  const [confirmAnother, setConfirmAnother] = useState(false);
  const [restored, setRestored] = useState(false);
  const requestedTrial = useRef<GenerationMode | null>(null);
  const requestedPrompt = useRef<string | null>(null);
  const freeMode = mode !== 'paid';
  const availableModels = freeMode ? models.filter((item) => item.guest) : models;
  const model = availableModels.find((item) => item.id === modelId) ?? (freeMode ? defaultTrialModel : availableModels[0]!);
  const videoOptions = VIDEO_OPTIONS[model.id]!;
  const selectedAspectRatio = videoOptions.aspectRatios.includes(aspectRatio)
    ? aspectRatio
    : videoOptions.aspectRatios[0]!;
  const imageAspectRatio = references.length > 0 ? videoOptions.imageAspectRatio : undefined;
  const selectedResolution = freeMode
    ? videoOptions.trial.resolution
    : videoOptions.options.some((item) => item.resolution === resolution)
      ? resolution
      : videoOptions.default.resolution;
  const durations =
    videoOptions.options.find((item) => item.resolution === selectedResolution)?.durations ?? [];
  const selectedDuration = freeMode
    ? videoOptions.trial.duration
    : durations.includes(duration)
      ? duration
      : durations.includes(videoOptions.default.duration)
        ? videoOptions.default.duration
        : durations[0]!;
  const cost = freeMode
    ? 0
    : creditsFor(
        model,
        sanitizeParameters(model, {
          aspect_ratio: selectedAspectRatio,
          resolution: selectedResolution,
          duration: selectedDuration,
        }),
      );
  const rendering = jobs.some(isActive);
  const shortfall = freeMode ? 0 : creditShortfall(balance.status, balance.available, cost);
  const unavailable =
    mode === 'daily-trial'
      ? !trials.data?.daily.available
      : mode === 'signup-trial' && session.data?.user
        ? trials.data?.signup.status !== 'available' || !trials.data.verificationAvailable
        : false;

  // The button is disabled when a trial cannot be used, so a click event would
  // miss these visitors. Record the displayed unavailable state once per reason.
  const unavailableSeen = useRef(new Set<string>());
  useEffect(() => {
    if (!freeMode || trials.loading) return;
    const reason = trials.failed
      ? 'status_error'
      : unavailable && mode === 'daily-trial'
        ? (trials.data?.daily.reason ?? 'unknown')
        : unavailable && mode === 'signup-trial'
          ? !trials.data?.verificationAvailable
            ? 'verification_unavailable'
            : (trials.data?.signup.status ?? 'unknown')
          : null;
    if (!reason) return;
    const key = `${mode}:${reason}`;
    if (unavailableSeen.current.has(key)) return;
    unavailableSeen.current.add(key);
    track('trial_unavailable_view', { mode, reason });
  }, [freeMode, mode, trials.loading, trials.failed, trials.data, unavailable]);

  useEffect(() => {
    const saved = loadState();
    const url = new URL(window.location.href);
    // An explicit registration trial takes priority over a saved paid mode. Keep
    // the request across repeated development effects after the URL is cleaned.
    const signupRequested = url.searchParams.get('trial') === 'signup' || requestedTrial.current === 'signup-trial';
    if (saved) {
      setModelId(restoredModelId(saved.modelId, saved.mode, models, signupRequested));
      setPrompt(saved.prompt);
      setAspectRatio(saved.aspectRatio);
      setReferences(saved.references);
      if (typeof saved.resolution === 'string') setResolution(saved.resolution);
      if (typeof saved.duration === 'number') setDuration(saved.duration);
      if (saved.mode === 'daily-trial' || saved.mode === 'signup-trial' || saved.mode === 'paid')
        setMode(saved.mode);
    }
    setRestored(true);
    // Checkout return (RESUME_PATH in pricing.tsx): show a notice, then drop resume from the URL so a reload does not repeat it.
    // An explicit guide CTA replaces only the prompt. Keep the reference photo,
    // model and generation mode from the saved draft; checkout resume takes priority.
    const preset = url.searchParams.get('preset');
    const presetPrompt = preset ? getPromptPreset(preset) : undefined;
    if (presetPrompt) {
      if (!url.searchParams.has('resume')) requestedPrompt.current = presetPrompt;
      url.searchParams.delete('preset');
      window.history.replaceState(window.history.state, '', url);
    }
    // Keep the explicit selection when development effects repeat after URL cleanup.
    if (requestedPrompt.current !== null) setPrompt(requestedPrompt.current);
    if (url.searchParams.get('trial') === 'signup') {
      requestedTrial.current = 'signup-trial';
      url.searchParams.delete('trial');
      window.history.replaceState(window.history.state, '', url);
    }
    if (requestedTrial.current) setMode(requestedTrial.current);
    if (url.searchParams.has('resume')) {
      setResumed(Boolean(saved?.prompt));
      url.searchParams.delete('resume');
      window.history.replaceState(window.history.state, '', url);
    }
  }, []);

  useEffect(() => {
    // Wait for the restored state to render before saving. Saving initial defaults during
    // mount can overwrite a draft before a repeated development effect reads it again.
    if (restored)
      saveState({ modelId: model.id, prompt, aspectRatio, references, mode, resolution, duration });
  }, [restored, model.id, prompt, aspectRatio, references, mode, resolution, duration]);

  useEffect(() => {
    if (!rendering) setConfirmAnother(false);
  }, [rendering]);

  useEffect(() => {
    if (!error) return;
    track('generate_failed');
    const trialReason: Record<string, string> = {
      trial_verification_failed: 'verification_failed',
      trial_unavailable: 'unknown',
      trial_quota_exhausted: 'quota',
      signup_trial_unavailable: 'unknown',
      signup_trial_used: 'used',
      signup_trial_expired: 'expired',
      signup_trial_limit: 'daily_limit',
    };
    const reason = trialReason[error.code ?? ''];
    if (reason) track('trial_blocked', { mode, reason });
  }, [error, mode]);

  // Result events: only track jobs seen going from running to done/failed on this page; ones already finished on load are not re-tracked.
  const statuses = useRef(
    new Map<string, { status: PublicJob['status']; settlement: PublicJob['settlement'] }>(),
  );
  useEffect(() => {
    for (const job of jobs) {
      const before = statuses.current.get(job.id);
      statuses.current.set(job.id, { status: job.status, settlement: job.settlement });
      if (
        before &&
        job.costCredits > 0 &&
        (((before.status === 'queued' || before.status === 'submitted') && !isActive(job)) ||
          (before.settlement !== 'refunded' && job.settlement === 'refunded'))
      )
        notifyCreditsChanged();
      if (before?.status !== 'queued' && before?.status !== 'submitted') continue;
      const seconds = job.finishedAt ? Math.round((job.finishedAt - job.createdAt) / 1000) : 0;
      if (job.status === 'succeeded') track('result_ready', { seconds });
      else if (job.status === 'failed' || job.status === 'canceled')
        track('result_failed', { status: job.status });
    }
  }, [jobs]);

  async function onUpload(files: FileList | null) {
    setUploadError(null);
    for (const file of Array.from(files ?? []).slice(0, model.maxReferences - references.length)) {
      try {
        const path = await uploadReference(file);
        setReferences((list) => [...list, path]);
      } catch (e) {
        setUploadError(uploadErrorText(e));
      }
    }
  }

  async function start() {
    const input = {
      modelId: model.id,
      mode,
      prompt,
      references: references.slice(0, model.maxReferences),
      parameters: {
        aspect_ratio: imageAspectRatio ?? selectedAspectRatio,
        resolution: selectedResolution,
        duration: selectedDuration,
      },
    };
    const job = await generate(input);
    notifyTrialsChanged();
    if (mode === 'paid') notifyCreditsChanged();
    if (job) track('generate_started', { model: model.id, mode, another: rendering });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    // blocked records which step this click got stuck on; none means generation started directly.
    const click = (blocked: string) => track('generate_click', { model: model.id, blocked });
    if (mode !== 'daily-trial' && !session.data?.user) {
      click('login_required');
      openSignIn(undefined, 'generation_mode');
      return;
    }
    if (freeMode && (trials.loading || unavailable)) {
      click('trial_unavailable');
      return;
    }
    if (rendering && !confirmAnother) {
      click('confirm_another');
      setConfirmAnother(true);
      return;
    }
    setConfirmAnother(false);
    click('none');
    await start();
  }

  function applyPrompt(value: string) {
    setPrompt(value);
    document.getElementById('prompt')?.focus();
    document.getElementById('tool')?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }

  function chooseMode(nextMode: GenerationMode) {
    if (nextMode !== 'paid' && !model.guest) {
      const next = defaultTrialModel;
      setModelId(next.id);
      setResolution(VIDEO_OPTIONS[next.id]!.default.resolution);
      setDuration(VIDEO_OPTIONS[next.id]!.default.duration);
      setReferences((items) => items.slice(0, next.maxReferences));
    }
    setMode(nextMode);
    setConfirmAnother(false);
    clearError();
  }

  return (
    <>
      <ReturnNotice jobs={jobs} />
      <section className="tool" id="tool">
        <div className="tool-heading">
          <h1>{m.home_title()}</h1>
          <p className="lead">{m.home_lead()}</p>
        </div>

        <div className="workspace">
          <form onSubmit={onSubmit} className="tool-form" aria-busy={!restored || submitting}>
            <div className="composer-heading">
              <label htmlFor="prompt">{m.home_composer_label()}</label>
              <span>{m.home_composer_format()}</span>
            </div>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={m.home_tool_placeholder()}
              rows={4}
              maxLength={4000}
              required
              aria-describedby="free-note"
            />
            <div className="prompt-ideas">
              <span>{m.home_ideas_label()}</span>
              {IDEAS.map((idea) => (
                <button type="button" key={idea.id} onClick={() => applyPrompt(idea.prompt())}>
                  {idea.name()}
                </button>
              ))}
            </div>
            <div className="tool-controls">
              <label>
                {m.home_tool_model()}
                <select
                  value={model.id}
                  onChange={(e) => {
                    const next = availableModels.find((item) => item.id === e.target.value)!;
                    setModelId(next.id);
                    setResolution(VIDEO_OPTIONS[next.id]!.default.resolution);
                    setDuration(VIDEO_OPTIONS[next.id]!.default.duration);
                    setReferences((items) => items.slice(0, next.maxReferences));
                  }}
                >
                  {availableModels.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {m.home_tool_aspect_ratio()}
                <select
                  value={imageAspectRatio ?? selectedAspectRatio}
                  disabled={Boolean(imageAspectRatio)}
                  onChange={(e) => setAspectRatio(e.target.value)}
                >
                  {imageAspectRatio && <option value={imageAspectRatio}>{m.home_tool_auto_aspect()}</option>}
                  {videoOptions.aspectRatios.map((ratio) => (
                    <option key={ratio}>{ratio}</option>
                  ))}
                </select>
              </label>
            </div>
            {freeMode && <p className="model-choice-note">{m.home_models_paid_hint()}</p>}
            <div className="tool-controls">
              <label>
                {m.home_tool_resolution()}
                <select
                  value={selectedResolution}
                  disabled={freeMode}
                  onChange={(event) => setResolution(event.target.value)}
                >
                  {(freeMode ? [{ resolution: selectedResolution }] : videoOptions.options).map((item) => (
                    <option key={item.resolution} value={item.resolution}>
                      {item.resolution}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {m.home_tool_duration()}
                <select
                  value={selectedDuration}
                  disabled={freeMode}
                  onChange={(event) => setDuration(Number(event.target.value))}
                >
                  {(freeMode ? [selectedDuration] : durations).map((seconds) => (
                    <option key={seconds} value={seconds}>
                      {m.home_tool_seconds({ seconds })}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="generation-mode">
              {m.home_tool_mode()}
              <select
                value={mode}
                disabled={submitting}
                onChange={(event) => chooseMode(event.target.value as GenerationMode)}
              >
                <option value="daily-trial">{m.home_tool_mode_daily()}</option>
                <option value="signup-trial">{m.home_tool_mode_signup()}</option>
                <option value="paid">{m.home_tool_mode_paid()}</option>
              </select>
            </label>
            {model.maxReferences > 0 && (
              <label className="upload-control">
                <span className="upload-icon" aria-hidden="true">
                  +
                </span>
                <span>
                  {videoOptions.requiresReference ? m.home_reference_required() : m.home_tool_references()}
                </span>
                <span className="upload-hint">
                  {references.length > 0 ? m.home_tool_image_added() : m.home_tool_add_photo()}
                </span>
                <input
                  type="file"
                  accept={UPLOAD_ACCEPT}
                  multiple
                  disabled={references.length >= model.maxReferences}
                  onChange={(e) => void onUpload(e.target.files)}
                />
              </label>
            )}
            {videoOptions.requiresReference && (
              <p className="muted small">{m.home_tool_reference_required()}</p>
            )}
            {references.length > 0 && (
              <div className="references">
                {references.map((path) => (
                  <button
                    type="button"
                    key={path}
                    onClick={() => setReferences((list) => list.filter((p) => p !== path))}
                    title={m.home_tool_remove()}
                    aria-label={m.home_tool_remove()}
                  >
                    <img src={path} alt={m.home_tool_reference_alt()} width={64} height={64} />
                    <span aria-hidden="true">×</span>
                  </button>
                ))}
              </div>
            )}
            {freeMode && config.turnstileSiteKey && <div id="turnstile-slot" />}
            <p className="small">
              <strong>{m.common_no_watermark()}</strong>
            </p>
            {mode === 'paid' && (
              <CreditSummary
                status={balance.status}
                available={balance.available}
                cost={cost}
                onRefresh={balance.refresh}
                onSignIn={() => openSignIn(undefined, 'balance')}
              />
            )}
            <button
              type="submit"
              className="primary generate-button"
              disabled={
                submitting ||
                !prompt.trim() ||
                !restored ||
                session.isPending ||
                (videoOptions.requiresReference && references.length === 0) ||
                (freeMode && (trials.loading || unavailable))
              }
            >
              <span>
                {submitting
                  ? m.home_tool_starting()
                  : freeMode && trials.loading
                    ? m.common_trial_loading()
                    : confirmAnother
                      ? freeMode
                        ? m.home_tool_submit_another_free()
                        : m.home_tool_submit_another({ cost })
                      : mode === 'paid'
                        ? m.home_tool_submit({ cost })
                        : mode === 'signup-trial'
                          ? m.home_tool_submit_signup()
                          : m.home_tool_submit_free()}
              </span>
              <span aria-hidden="true">{submitting ? '◌' : '→'}</span>
            </button>
            <p className="muted small" id="free-note">
              {mode === 'paid'
                ? m.home_tool_credit_note({ cost })
                : mode === 'signup-trial'
                  ? m.home_tool_signup_note()
                  : m.home_tool_free_note({ count: site.guest.dailyPerDevice })}
              {mode === 'paid' && (
                <>
                  {' '}
                  <PricingLink source="generator_cost" requiredCredits={cost}>
                    {m.home_view_credit_packs()}
                  </PricingLink>
                </>
              )}
            </p>
            {freeMode && trials.failed && <p className="notice">{m.home_tool_free_status_error()}</p>}
            {mode === 'daily-trial' && !trials.loading && trials.data && !trials.data.daily.available && (
              <p className="notice">
                {trials.data.daily.reason === 'verification_unavailable'
                  ? m.home_tool_verification_unavailable()
                  : m.home_tool_daily_unavailable()}
              </p>
            )}
            {mode === 'daily-trial' && !trials.loading && trials.data?.daily.reason === 'quota' && (
              <div className="trial-next-steps">
                {session.data?.user &&
                  trials.data.verificationAvailable &&
                  trials.data.signup.status === 'available' && (
                    <button type="button" className="link-button" onClick={() => chooseMode('signup-trial')}>
                      {m.home_use_signup_trial()}
                    </button>
                  )}
                {!session.data?.user && trials.data.verificationAvailable && (
                  <button type="button" className="link-button" onClick={() => chooseMode('signup-trial')}>
                    {m.home_check_signup_trial()}
                  </button>
                )}
                <button type="button" className="link-button" onClick={() => chooseMode('paid')}>
                  {m.home_use_credits()}
                </button>
                <p>{m.home_use_credits_note()}</p>
              </div>
            )}
            {mode === 'signup-trial' && !trials.loading && (
              <p className="notice">
                {signupTrialDescription(trials.data?.signup.status)}
                {trials.data?.signup.status === 'available' && trials.data.signup.expiresAt && (
                  <>
                    {' '}
                    {m.common_trial_expiry({
                      date: new Date(trials.data.signup.expiresAt).toLocaleDateString(
                        getLocale() === 'zh' ? 'zh-CN' : 'en-US',
                      ),
                    })}
                  </>
                )}
                {!session.data?.user && (
                  <>
                    {' '}
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => openSignIn(undefined, 'signup_trial')}
                    >
                      {m.home_tool_sign_in()}
                    </button>
                  </>
                )}
              </p>
            )}
            {mode === 'signup-trial' &&
              !trials.loading &&
              trials.data &&
              ['used', 'expired', 'ineligible', 'daily_limit'].includes(trials.data.signup.status) && (
                <div className="trial-next-steps">
                  {trials.data.daily.available && (
                    <button type="button" className="link-button" onClick={() => chooseMode('daily-trial')}>
                      {m.home_use_daily_trial()}
                    </button>
                  )}
                  <button type="button" className="link-button" onClick={() => chooseMode('paid')}>
                    {m.home_use_credits()}
                  </button>
                  <p>{m.home_use_credits_note()}</p>
                </div>
              )}
            {mode === 'signup-trial' && trials.data && !trials.data.verificationAvailable && (
              <p className="notice">{m.home_tool_verification_unavailable()}</p>
            )}
            {freeMode && (trials.failed || unavailable) && !trials.loading && (
              <button type="button" className="link-button" onClick={() => void trials.refresh()}>
                {m.common_trial_refresh()}
              </button>
            )}
            {resumed && !error && jobs.length === 0 && <p className="notice">{m.home_tool_resumed()}</p>}
            {confirmAnother && (
              <p className="notice">
                {freeMode ? m.home_tool_confirm_another_free() : m.home_tool_confirm_another({ cost })}
              </p>
            )}
            {uploadError && (
              <p className="error" role="alert">
                {uploadError}
              </p>
            )}
            {error && !(error.code === 'insufficient_credits' && shortfall > 0) && (
              <GenerationError code={error.code} cost={cost} />
            )}
          </form>
          <figure className="inspiration">
            <img
              src="/images/planet-walk.webp"
              srcSet="/images/planet-walk-small.webp 720w, /images/planet-walk.webp 1440w"
              sizes="(max-width: 760px) 100vw, 50vw"
              width={1440}
              height={960}
              alt={m.home_inspiration_alt()}
              fetchPriority="high"
            />
            <figcaption>
              <span className="inspiration-label">{m.home_inspiration_label()}</span>
              <div className="inspiration-bottom">
                <p>
                  {m.home_inspiration_title_first()}
                  <br />
                  {m.home_inspiration_title_second()}
                </p>
                <button type="button" onClick={() => applyPrompt(m.home_idea_world_prompt())}>
                  {m.home_inspiration_apply()} <span aria-hidden="true">→</span>
                </button>
              </div>
            </figcaption>
          </figure>
        </div>
        <div className="results" id="results">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              email={session.data?.user.email}
              onCancel={() => void cancel(job.id)}
            />
          ))}
        </div>
      </section>

      <section className="content examples-section" id="cases">
        <div className="section-heading">
          <div>
            <h2>{m.home_cases_heading()}</h2>
            <p className="lead">{m.home_cases_body()}</p>
          </div>
          <a className="text-link" href="#tool">
            {m.home_cases_create()} <span aria-hidden="true">↑</span>
          </a>
        </div>
        <h3 className="image-cases-heading">{m.home_image_case_title()}</h3>
        <div className="image-cases">
          {IMAGE_CASES.map((item) => (
            <figure className="case image-case" key={item.src}>
              <div className="image-case-media">
                <div>
                  <span>{m.home_image_case_input()}</span>
                  <img src={item.input} alt={item.inputAlt()} loading="lazy" width={540} height={960} />
                </div>
                <div>
                  <span>{m.home_image_case_output()}</span>
                  <video
                    src={item.src}
                    poster={item.poster}
                    controls
                    muted
                    loop
                    playsInline
                    preload="none"
                    aria-label={item.title()}
                  />
                </div>
              </div>
              <figcaption>
                <div className="case-heading">
                  <h3>{item.title()}</h3>
                  <button
                    type="button"
                    onClick={() => applyPrompt(item.prompt)}
                    aria-label={m.home_case_use_prompt({ title: item.title() })}
                    title={m.home_case_use_prompt_title()}
                  >
                    ↑
                  </button>
                </div>
                <p>{item.settings()}</p>
                <p>“{item.prompt}”</p>
                <p>{item.limit()}</p>
                <p>{m.home_image_case_prompt_note()}</p>
              </figcaption>
            </figure>
          ))}
        </div>
        <div className="cases">
          {CASES.map((item) => (
            <figure className="case" key={item.src}>
              <video
                src={item.src}
                poster={item.poster}
                controls
                muted
                loop
                playsInline
                preload="none"
                aria-label={item.title()}
              />
              <figcaption>
                <div className="case-heading">
                  <h3>{item.title()}</h3>
                  <button
                    type="button"
                    onClick={() => applyPrompt(item.prompt)}
                    aria-label={m.home_case_use_prompt({ title: item.title() })}
                    title={m.home_case_use_prompt_title()}
                  >
                    ↑
                  </button>
                </div>
                <p>“{item.prompt}”</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="content how-section">
        <h2>{m.home_how_heading()}</h2>
        <ol className="steps">
          {STEPS.map((step, i) => (
            <li key={step.id}>
              <span className="step-number" aria-hidden="true">
                0{i + 1}
              </span>
              <h3>{step.title()}</h3>
              <p>{step.body()}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="content limits-section" id="limits">
        <div>
          <h2>{m.home_limits_heading()}</h2>
          <a className="text-link" href="/no-watermark">
            {m.home_limits_watermark_link()} <span aria-hidden="true">→</span>
          </a>
        </div>
        <div>
          <p>{m.home_limits_body()}</p>
          <p>
            {m.home_limits_more_before()}{' '}
            <a className="link-accent" href="/seedance-2-5-free">
              {m.home_limits_link_seedance()}
            </a>{' '}
            {m.home_limits_more_after()}
          </p>
        </div>
      </section>

      <section className="content pricing-section" id="pricing">
        <div className="section-intro">
          <h2>{m.home_pricing_heading()}</h2>
          <p className="lead">
            {m.home_pricing_start()}
            <br />
            {m.home_pricing_more()}
          </p>
          <p className="muted">
            {m.home_pricing_packs()}
            <br />
            {m.home_pricing_no_subscription()}
          </p>
        </div>
        <div className="pricing-content">
          <Plans selectedCost={mode === 'paid' ? cost : null} />
        </div>
      </section>

      <section className="content faq-section" id="faq">
        <div className="section-intro">
          <h2>{m.home_faq_heading()}</h2>
        </div>
        <div className="faq-list">
          {getFaqs().map((faq, i) => (
            <details key={faq.question} open={i === 0}>
              <summary>
                {faq.question}
                <span aria-hidden="true">+</span>
              </summary>
              <div className="faq-answer">
                <p>{faq.answer}</p>
                {faq.link && (
                  <a href={faq.link.href}>
                    {faq.link.label} <span aria-hidden="true">→</span>
                  </a>
                )}
              </div>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}

const RECENT_MS = 24 * 3600_000;

/** Return-visit notice above the fold: when a job is running or finished within a day, one click jumps to results below the generator. */
function ReturnNotice({ jobs }: { jobs: PublicJob[] }) {
  const rendering = jobs.some(isActive);
  const latest = jobs[0];
  const ready =
    latest?.status === 'succeeded' &&
    latest.finishedAt !== null &&
    Date.now() - latest.finishedAt < RECENT_MS;
  if (!rendering && !ready) return null;
  return (
    <a
      className="notice return-notice"
      href="#results"
      data-rybbit-event="return_notice_click"
      data-rybbit-prop-state={rendering ? 'generating' : 'ready'}
    >
      {rendering ? m.home_return_generating() : m.home_return_ready()}
    </a>
  );
}

function uploadErrorText(error: unknown): string {
  const code = error instanceof ApiError ? error.code : undefined;
  switch (code) {
    case 'unsupported_type':
      return m.home_error_upload_format();
    case 'upload_limit':
      return m.home_error_upload_limit();
    case 'too_large':
      return m.home_error_upload_large();
    case 'invalid_image':
      return m.home_error_upload_invalid();
    case 'image_too_small':
      return m.home_error_upload_small();
    default:
      return m.home_tool_upload_failed();
  }
}

function generationErrorText(code: string | undefined): string {
  switch (code) {
    case 'invalid_prompt':
      return m.home_error_prompt();
    case 'invalid_references':
      return m.home_error_references();
    case 'unknown_model':
      return m.home_error_model();
    case 'dispatch_failed':
      return m.home_error_dispatch();
    case 'job_not_found':
      return m.home_error_job_missing();
    case 'trial_quota_exhausted':
      return m.home_tool_daily_unavailable();
    case 'trial_verification_failed':
      return m.home_error_trial_verification();
    case 'trial_unavailable':
      return m.home_tool_verification_unavailable();
    case 'signup_trial_used':
      return m.home_error_signup_used();
    case 'signup_trial_expired':
      return m.home_error_signup_expired();
    case 'signup_trial_unavailable':
      return m.home_error_signup_unavailable();
    case 'signup_trial_limit':
      return m.home_error_signup_limit();
    case 'invalid_generation_mode':
      return m.home_error_mode();
    default:
      return m.home_error_generation();
  }
}

function GenerationError({ code, cost }: { code: string | undefined; cost: number }) {
  if (code === 'login_required') {
    return (
      <p className="notice">
        {m.home_tool_login_required()}{' '}
        <button type="button" className="link-button" onClick={() => openSignIn(undefined, 'login_required')}>
          {m.home_tool_sign_in()}
        </button>
      </p>
    );
  }
  if (code === 'insufficient_credits') {
    return (
      <p className="notice">
        {m.home_tool_need_credits()}{' '}
        <PricingLink source="insufficient_credits" requiredCredits={cost}>
          {m.home_tool_get_credits()}
        </PricingLink>
      </p>
    );
  }
  return (
    <p className="error" role="alert">
      {generationErrorText(code)}
    </p>
  );
}

export function JobCard({ job, email, onCancel }: { job: PublicJob; email?: string; onCancel: () => void }) {
  const active = isActive(job);
  return (
    <article className="job">
      {job.outputs.map((output) =>
        output.mediaType.startsWith('video/') ? (
          // biome-ignore lint/a11y/useMediaCaption: generated videos have no caption track.
          <video key={output.url} src={output.url} controls playsInline />
        ) : (
          <img key={output.url} src={output.url} alt={job.prompt} loading="lazy" />
        ),
      )}
      {job.outputs.map((output) => (
        <a key={output.url} className="button" href={output.url} download data-rybbit-event="result_download">
          {m.home_job_download()}
        </a>
      ))}
      {active && (
        <div className="job-pending">
          <p>{m.home_job_generating()}</p>
          {/* Only signed-in users get the completion email (the notify step in packages/jobs). */}
          {email && <p className="muted">{m.home_job_email()}</p>}
        </div>
      )}
      {job.status === 'failed' && (
        <p className="error">
          {job.costCredits === 0
            ? m.home_job_failed_free()
            : job.settlement === 'refunded'
              ? m.home_job_failed()
              : job.settlement === 'charged'
                ? m.home_job_failed_charged({ jobId: job.id })
                : m.home_job_failed_pending({ jobId: job.id })}
        </p>
      )}
      {job.status === 'canceled' && (
        <p className="muted">
          {job.costCredits === 0
            ? m.home_job_canceled_free()
            : job.settlement === 'refunded'
              ? m.home_job_canceled_refunded()
              : job.settlement === 'charged'
                ? m.home_job_canceled_charged({ jobId: job.id })
                : m.home_job_canceled_pending({ jobId: job.id })}
        </p>
      )}
      <p className="job-prompt">{job.prompt}</p>
      {/* Only before the upstream has it: a running render bills anyway, so the engine refuses to cancel and refund it. */}
      {job.status === 'queued' && (
        <button type="button" onClick={onCancel}>
          {m.home_job_cancel()}
        </button>
      )}
    </article>
  );
}
