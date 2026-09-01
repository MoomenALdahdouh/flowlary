# Three-Provider Production Readiness Audit

**Date:** 2026-08-31  
**Scope:** Production advisor architecture implementation, deterministic tests, and safety defaults. No large live evaluation was run.

## Verdict

The three-provider advisor architecture is implemented and deterministic-test ready. Groq remains the only enabled provider by default. Gemini, OpenRouter, and provider fallback remain disabled. The local deterministic engine remains authoritative whenever the advisor is unavailable.

The code is ready to deploy under those safe defaults. Enabling the complete fallback chain in production is not yet approved: Gemini and OpenRouter still require production credentials/configuration, privacy and cost review, and small staging connectivity evidence. Connectivity would not establish model quality.

## Implemented

- One provider-neutral `AIAdvisorProvider` contract.
- Groq, Gemini, and configurable-model OpenRouter adapters.
- One common strict ID-only result validator.
- Sequential configuration-driven manager with failure-only fallback.
- Hard maximum of three attempts; no retries, parallel voting, confirmation calls, or quality routing.
- Normalized operational/contract error model.
- Retry-After, bounded cooldown, recovery probes, failure counters, and bounded in-process concurrency.
- Global advisor-cycle RPM, gateway per-user RPM, provider RPM, total deadline, provider token budgets, and configurable fallback limits.
- Abort/stale propagation that stops the chain.
- Explicit local-authoritative metadata after complete provider failure.
- Provider-attempt telemetry without prompt text or secrets.
- Opt-in, paced Groq/Gemini/OpenRouter connectivity probes.
- Translation remains outside this provider manager.
- Existing Decision Engine, Policy, Write Gate, and apply mode were not changed.
- `/health` exposes advisor configuration and provider health snapshots.
- Production `/ready` validates fallback provider credentials when fallback is enabled.

## Deterministic verification

Executed results:

- backend suite: **33 files passed, 2 skipped; 270 tests passed, 3 opt-in live tests skipped**;
- focused extension safety suite: **3 files passed; 35 tests passed**;
- backend TypeScript check: advisor changes are clean, but the command remains failed by pre-existing unrelated testimonial, route, feedback, and support typing errors.

The focused provider suite covers:

- provider contract and response injection rejection;
- Groq, Gemini, and OpenRouter success/error normalization;
- 400, 401, 403, 404, 408/timeout, 429, quota/billing exhaustion, and 5xx;
- malformed JSON, empty output, unknown/duplicate IDs, and replacement/write fields;
- Retry-After and cooldown recovery;
- stale cancellation with no fallback;
- first-valid-result authority;
- configured order, sequential execution, and maximum attempts;
- Groq success with no fallback;
- Groq failure to Gemini;
- Groq and Gemini failure to OpenRouter;
- all-provider failure with local decision authoritative;
- global and provider-specific RPM;
- total deadline;
- safe default flags and configurable token budgets/models.

The extension already tests asynchronous advisor behavior and retains local output on unavailable/invalid advisor results. No direct-write path was added.

## Live evidence

- **Groq:** Historical repository evidence confirms API/model connectivity, but the latest large attempts were dominated by 429 and `json_validate_failed`; they did not establish quality. Production token budget remains 180.
- **Gemini:** No live probe was run in this task. Adapter behavior is deterministic-test verified. No quality claim.
- **OpenRouter:** No live probe was run in this task, and no model was selected. Adapter behavior is deterministic-test verified. No connectivity or quality claim.

The supplied OpenRouter credential was not copied into tracked files or used. It should be rotated because it was disclosed in chat.

## Disabled and intentionally unchanged

- `GEMINI_ADVISOR_ENABLED=false`
- `OPENROUTER_ADVISOR_ENABLED=false`
- `ADVISOR_FALLBACK_ENABLED=false`
- advisor apply remains shadow/off in the extension
- no model voting or intelligent routing
- no direct LLM writing
- no translation routing through advisor providers
- no automatic live or 200+ request evaluation
- no silent Groq token-budget increase

## Remaining blockers

These block enabling the full fallback chain, not continued product development:

1. Rotate the exposed OpenRouter key and configure it only in a secret manager/local untracked environment.
2. Select `OPENROUTER_ADVISOR_MODEL`; the implementation intentionally has no default.
3. Run each small opt-in staging probe with production-intended credentials.
4. Complete provider privacy/data-processing and cost review.
5. If deployed across multiple backend replicas, use a shared limiter/health store when truly global cross-process budgets are required.
6. Conduct a separate quality evaluation before allowing either new provider to influence apply behavior.
7. Repair the unrelated existing backend TypeScript errors in `db/store.ts`, `routes/http.ts`, `feedbackService.ts`, and `supportService.ts` before claiming a fully green repository build.

## Production readiness

- **Safe-default deployment:** Ready, subject to the repository's unrelated pre-existing build/typecheck issues.
- **Three-provider fallback enabled in production:** Not yet approved.
- **Move to the next product phase:** Yes. The architecture no longer requires more isolated provider experimentation; provider enablement can remain an operational rollout task.
