# Stale job sweep (server-side fallback)

Status: implemented in `@shipwords/jobs`, wiring per site; fold into docs/architecture.md when confirmed.

## Problem

`healStale` only ends a stuck job when its owner reads it. If the client never comes back, a queued job stays queued forever. Worse, a lost Workflow instance (dispatch's `create` call failing without being recorded — observed once in production, 2026-11-05, freeaivideo) is invisible to reads: the job is `queued` and no instance exists.

## Change

- New export `sweepStaleJobs(db, models)` in `@shipwords/jobs/sweep`: ends `queued`/`submitted` jobs past their per-model `timeoutMinutes + 15` minutes via `markFailed` (`error_code = 'stale'`), so refunds and guest quota settle through the existing idempotent path. Capped at 100 jobs per run.
- `dispatch` no longer lets a failed settlement marking turn the 503 into a 500; the sweep is the fallback for that window.
- Sites opt in by calling it from a `scheduled` handler with an hourly cron trigger. Until a site adds the trigger, behavior is unchanged (heal-on-read only).

## Rules kept

- Job states only move forward (`markFailed` conditional update; a job that succeeds mid-sweep stays succeeded).
- Refunds stay settle-from-final-state, idempotent; repeated sweeps return quota once.
