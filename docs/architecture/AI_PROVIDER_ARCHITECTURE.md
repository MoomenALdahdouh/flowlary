# Flowlary AI Advisor Provider Architecture

> **Advisor ranking only.** Writing Review is a **separate** contract and manager. Current combined picture: [AI_ARCHITECTURE.md](./AI_ARCHITECTURE.md) and [../backend/PROVIDERS.md](../backend/PROVIDERS.md).

## Scope and safety boundary

This architecture applies only to the asynchronous hypothesis-ranking advisor. It does not replace local analysis, Hypothesis Generation V2, the Decision Engine, Policy, or Write Gate. Translation remains a separate subsystem.

Providers receive an `AdvisorPacket` containing local hypothesis IDs and limited context. They may only return an ordered subset of those IDs plus `ambiguityClass` and `reasonCode`. They cannot return replacement text, DOM operations, executable content, or write instructions. A common validator rejects extra fields, unknown/duplicate IDs, malformed JSON, empty rankings, and mutation-like instructions. Write Gate remains the only field mutation authority. Advisor apply remains controlled by the existing extension shadow/apply mode and is not enabled by this implementation.

## Provider-neutral contract

`AIAdvisorProvider` exposes:

- immutable `id`, configured `model`, capabilities, and enabled state;
- `rankHypotheses(packet, options)` with one absolute deadline and abort signal;
- `health()` and `availability()` snapshots;
- normalized result usage, finish reason, request ID, and error classification.

The adapters are:

- `GroqAdvisorProvider` using `openai/gpt-oss-20b` by default;
- `GeminiAdvisorProvider` using `gemini-3.5-flash-lite` by default;
- `OpenRouterAdvisorProvider` with no default model. `OPENROUTER_ADVISOR_MODEL` is mandatory when enabled.

Provider-specific URLs, authentication, request schemas, response parsing, status/body interpretation, and token metadata remain inside each adapter.

## Provider manager and failure-only fallback

`AdvisorProviderManager` evaluates configured providers sequentially. Default order is `groq,gemini,openrouter`; `AI_ADVISOR_PROVIDER_ORDER` controls it deterministically.

For each provider, the manager:

1. checks enabled state, required capabilities, provider RPM, health, cooldown, and concurrency admission;
2. makes one attempt using the remaining total deadline;
3. records normalized health and attempt metadata;
4. returns immediately on the first contract-valid response;
5. advances only after an operational or contract failure.

A valid response never triggers confirmation, voting, quality comparison, or parallel calls. Low confidence, `preserve`, or disagreement with local scores are valid outcomes and do not trigger fallback. The hard limit is three providers per cycle; configured attempt and fallback limits may reduce it.

## Normalized errors

Adapters emit only:

`RATE_LIMITED`, `QUOTA_EXHAUSTED`, `AUTH_FAILED`, `INVALID_REQUEST`, `CONTRACT_FAILURE`, `TIMEOUT`, `NETWORK_ERROR`, `PROVIDER_UNAVAILABLE`, `SERVER_ERROR`, `STALE_REQUEST`, or `UNKNOWN`.

Groq `json_validate_failed` is a `CONTRACT_FAILURE`; it is not retried as free-form text. Finish reason and reasoning-token usage are retained when supplied. Billing/quota exhaustion is operational, not a model-quality result.

## Health, cooldown, and budgets

Process-local health records track state, consecutive failures, last success/failure, failure reason, latency percentiles, and cooldown. Retry-After is honored. Repeated rate limits use bounded exponential cooldown. Auth failures remain unavailable for the configuration epoch. Quota failures receive a longer cooldown. Recovery allows one probe, while healthy providers have a bounded in-process concurrency limit.

Protection includes:

- gateway per-user advisor RPM;
- process-local global advisor-cycle RPM;
- provider-specific process-local RPM;
- at most three attempts and two fallbacks;
- provider-specific token budgets;
- a strict total advisor deadline;
- client and server abort propagation.

Ops visibility:

- `GET /health` includes advisor configuration and process-local provider health snapshots;
- production `GET /ready` validates fallback provider credentials when fallback is enabled, without live AI probes.

For horizontally scaled deployment, global limits and health are per process. A shared external limiter/health store is required if limits must be globally coordinated across replicas.

## Deadlines, staleness, and local fallback

The extension runs the advisor asynchronously and cancels the prior request for the same cycle. Abort becomes `STALE_REQUEST`; the manager immediately stops and does not consume the remaining provider chain. Late results are discarded by the existing generation checks.

If no provider returns a valid result, manager metadata sets `localDecisionAuthoritative: true`. The API reports advisor unavailability, and the existing extension catches it and continues with the already-computed local Decision Engine result. Typing and local writing behavior do not depend on provider success.

## Telemetry

Provider-attempt telemetry stores provider, model, timestamp, latency, token usage, reasoning tokens, finish reason, normalized error, fallback position, and success/failure. Operation telemetry remains separately metered so fallback attempts do not inflate account usage.

No advisor telemetry stores packet text, passwords, JWTs, credentials, card data, or API keys. Estimated cost remains unset when a reliable configured model price is unavailable; token totals allow later calculation.

## Configuration

Safe defaults keep Groq current behavior while disabling new providers and fallback:

- `GROQ_ADVISOR_ENABLED=true`
- `GROQ_ADVISOR_MODEL=openai/gpt-oss-20b`
- `GROQ_ADVISOR_MAX_TOKENS=180`
- `GEMINI_ADVISOR_ENABLED=false`
- `GEMINI_ADVISOR_MODEL=gemini-3.5-flash-lite`
- `OPENROUTER_ADVISOR_ENABLED=false`
- `OPENROUTER_ADVISOR_MODEL=` (required; no hardcoded default)
- `ADVISOR_FALLBACK_ENABLED=false`
- `AI_ADVISOR_PROVIDER_ORDER=groq,gemini,openrouter`
- `ADVISOR_TOTAL_DEADLINE_MS=1500`
- `ADVISOR_MAX_PROVIDER_ATTEMPTS=3`
- `ADVISOR_MAX_FALLBACKS=2`
- `ADVISOR_USER_RPM`, `ADVISOR_GLOBAL_RPM`, and provider-specific `*_ADVISOR_RPM`

The legacy provider-order and timeout names remain accepted for compatibility.

## Live probes

Small paced connectivity probes are excluded unless explicitly enabled with:

- `FLOWLARY_GROQ_LIVE=true`
- `FLOWLARY_GEMINI_LIVE=true`
- `FLOWLARY_OPENROUTER_LIVE=true`

They make at most a few sequential requests, stop after sustained 429s, never enable apply, and do not modify user text. Connectivity is not evidence of ranking quality.
