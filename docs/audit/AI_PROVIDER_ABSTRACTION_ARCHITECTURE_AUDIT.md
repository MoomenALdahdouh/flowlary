# Flowlary AI Provider Abstraction & Failover Architecture Audit

**Date:** 2026-08-31  
**Scope:** Hypothesis-advisor provider reliability and failover. This audit does not redesign correction, translation, hypothesis generation, policy, or Write Gate.  
**Evidence:** Current source, existing frozen evaluations, GPT-OSS contract probes, and prior provider audits in this repository.

## Executive verdict

Flowlary's safety architecture is sound but its server-side hypothesis advisor is not provider-independent. The extension already treats the LLM as an optional, ID-only advisor and fails closed to local behavior. The backend, however, directly couples the advisor to Groq, collapses materially different failures into string errors, discards quota and reasoning metadata, and can delay a writing cycle for the generic 30-second AI timeout.

The correct migration is a narrow advisor-provider abstraction:

```text
Local analysis and hypotheses
  -> deterministic consult gate
  -> advisor provider manager
       -> healthy primary adapter
       -> one failure-only fallback adapter
  -> normalized rank result
  -> existing policy
  -> existing Write Gate
```

This is not a general model router. It must never call providers in parallel, compare answers, vote, or allow an LLM to choose another LLM.

Implementation may safely begin with provider-neutral contracts, validation, health state, and a Groq adapter. Gemini must remain disabled by default until it independently passes the frozen Flowlary evaluation. The production advisor budget remains 180 until the measured budget change is explicitly approved after contract testing. Apply remains off.

## Required production statements

```text
PRODUCTION APPLY:
OFF

LLM DIRECT WRITE:
FORBIDDEN

PARALLEL VOTING:
FORBIDDEN

MODEL ROUTING:
NOT USED

TRANSLATION:
SEPARATE

LOCAL-FIRST:
YES

PRIMARY:
Groq, only when healthy and after evaluation

FALLBACK:
Gemini, failure-only, only after it independently passes evaluation

LOCAL FALLBACK:
Always available
```

Compiling the abstraction does not make the system production-ready.

## 1. Current architecture

### 1.1 Current runtime path

```text
User input
  -> extension local analysis
  -> local hypothesis generation
  -> deterministic shouldConsultAdvisor
  -> extension background RANK_HYPOTHESES message
  -> POST /api/ai/hypothesis-advisor
  -> AiGateway.hypothesisAdvisor
  -> runHypothesisAdvisorProvider
  -> callGroqChat(openai/gpt-oss-20b)
  -> backend vote parsing
  -> extension vote validation
  -> existing decideWriting policy
  -> existing Write Gate
```

Key files:

- `extension/src/core/engine/advisor.ts`: consult gate, packet minimization, sensitive-content exclusion, ID validation.
- `extension/src/core/writeGate/pipeline.ts`: local hypotheses, advisor await, stale-generation check, baseline/advised comparison, apply-mode selection, and final Write Gate call.
- `extension/src/background/rankHypotheses.ts`: provider-neutral HTTP client from the extension.
- `backend/src/gateway/index.ts`: entitlement, account rate limit, timeout, usage reservation, logging, and advisor endpoint orchestration.
- `backend/src/providers/hypothesisAdvisorProvider.ts`: Groq-coupled prompt construction and response parsing.
- `backend/src/providers/groqClient.ts`: Groq HTTP transport and current retry/error behavior.
- `packages/shared/src/ai/hypothesisAdvisor.ts`: ID-only prompt and packet limits.

### 1.2 Existing safety properties

The current architecture already enforces important invariants:

- The provider receives locally generated hypothesis IDs and metadata, not permission to write.
- Replacement strings are not included in the advisor packet.
- The shared prompt permits only `rankedHypothesisIds`, `ambiguityClass`, and `reasonCode`.
- Backend and extension validators reject `replacement`, `text`, and `write`.
- Protected fields and sensitive token classes suppress consultation.
- Snippets are bounded to 160 characters and hypotheses to 24.
- Policy still evaluates the selected local hypothesis.
- Write Gate is the only automatic mutation authority.
- Production registration sets advisor apply mode to `shadow`.
- A generation check after the provider returns discards stale results before a write.
- Provider failure becomes advisor unavailable; the local engine remains available.

These controls must be preserved, not reimplemented inside provider adapters.

### 1.3 Current coupling

There is no advisor provider contract or provider manager. `runHypothesisAdvisorProvider` imports `callGroqChat` directly and hardcodes `AI_MODELS.HYPOTHESIS_ADVISOR`. The gateway sees exceptions rather than a normalized provider result.

The current extension API is already provider-neutral and should stay that way. Provider identity belongs in server telemetry, not in local decision logic.

## 2. Current Groq problems and root causes

### 2.1 Reliability and quota

Live evidence shows the API key and model are valid. The failed full evaluation was not a provider outage and did not establish poor model ranking quality. It was dominated by:

- Groq 429 responses under free-tier RPM/TPM constraints.
- Structured-output failures caused by an insufficient generation/reasoning budget.

The current client maps every 429 to `rate_limited` and discards:

- `Retry-After`.
- request and token reset headers.
- remaining request and token headers.
- provider request ID.
- response error details that distinguish rate limits from account quota or billing conditions.

It does not retry 429, which avoids one class of storm, but it also does not establish cooldown. Every new request can immediately hit the same unavailable provider.

### 2.2 GPT-OSS budget failure

Production currently sends:

```text
temperature = 0
max_tokens = 180
response_format = json_object
include_reasoning = false
```

Measured contract results:

- 180 tokens: 0/8 valid.
- 512 tokens: 6/8 valid.
- 1024 tokens: 8/8 valid.

`include_reasoning = false` does not mean reasoning consumes no completion budget. Existing probes observed reasoning-token usage and `finish_reason = length` behavior. Therefore 180 is a generation/reasoning budget failure for this contract, not simply malformed model output.

The current `json_validate_failed` recovery retries as unstructured text with the same 180-token budget. That does not change the limiting condition and is not a meaningful recovery strategy.

The failure should be normalized as `BUDGET_ERROR` when evidence includes `json_validate_failed` at the configured structured-output budget, an empty completion with `finish_reason = length`, or equivalent provider metadata. It must not be silently folded into generic invalid response.

The production budget must become configuration, but its default remains 180 during the abstraction migration. A later evidence-gated change may select 512, 1024, or another measured value. Current evidence proves 180 is inadequate; it does not yet prove the minimum production-safe value across at least 200 valid frozen samples.

### 2.3 Error collapse

Current string errors cannot reliably distinguish:

- invalid JSON from valid JSON with invalid schema;
- unknown IDs from an empty ranking;
- abort from provider timeout;
- model/configuration errors from temporary availability;
- account quota/budget from rate limiting;
- a length/budget failure from arbitrary invalid response.

This prevents deterministic fallback policy, accurate health state, and actionable telemetry.

### 2.4 Latency defect

The OS keyboard is not synchronously frozen, but `runFieldCycle` awaits the advisor before it computes and executes the local baseline. The generic server timeout is 30 seconds. A shadow-only advisor can therefore delay a local writing cycle even though its result is not authorized to affect production behavior.

The advisor needs a dedicated short deadline. Target:

- desired primary p50 <= 400 ms;
- preferred primary p95 <= 800 ms;
- hard advisor event boundary near 1500 ms;
- stale or late results discarded;
- local behavior never waits beyond the advisor event budget.

Changing the pipeline to fully detached consultation is a separate high-risk phase because it affects ordering and apply experiments. The initial backend migration should add a dedicated bounded advisor timeout without changing local decision semantics. A later phase can make shadow telemetry fully fire-and-forget with explicit tests.

### 2.5 Accounting and telemetry defects

The advisor currently reuses the `layout-classification` rate-limit bucket, managed-usage operation, and usage operation. This obscures advisor cost and can couple unrelated workloads.

Current advisor logs omit provider, fallback reason, normalized failure, cooldown, usage details, reasoning tokens, finish reason, and provider request ID.

## 3. Proposed provider-neutral contracts

The contract belongs on the backend because provider selection is a server concern. Shared extension types should remain the small vote contract.

### 3.1 Provider capabilities

```ts
type AdvisorProviderCapability =
  | 'hypothesis_ranking'
  | 'structured_json'
  | 'id_only_output'
  | 'arabic'

type AdvisorProviderCapabilities = ReadonlySet<AdvisorProviderCapability>
```

Streaming and general reasoning flags are not selection requirements for this task and should not drive routing. Additional capabilities can be added when a real provider requires them.

### 3.2 Provider interface

```ts
interface HypothesisAdvisorProvider {
  readonly id: AdvisorProviderId
  readonly model: string
  readonly capabilities: AdvisorProviderCapabilities
  readonly enabled: boolean

  rankHypotheses(
    packet: AdvisorProviderPacket,
    options: AdvisorRequestOptions,
  ): Promise<AdvisorProviderResult>

  health(): ProviderHealthSnapshot
}
```

`AdvisorProviderPacket` is the server-validated subset already received from the extension. It must not contain replacement strings or write instructions.

`AdvisorRequestOptions` should carry:

- request ID;
- abort signal;
- absolute deadline or timeout budget;
- required capabilities;
- configured generation budget;
- response-contract version.

### 3.3 Normalized result

Success:

```ts
type AdvisorProviderSuccess = {
  ok: true
  provider: AdvisorProviderId
  model: string
  rankedHypothesisIds: string[]
  ambiguityClass: string
  reasonCode: string
  latencyMs: number
  usage?: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
    reasoningTokens?: number
  }
  finishReason?: string
  providerRequestId?: string
}
```

Failure:

```ts
type AdvisorProviderFailure = {
  ok: false
  provider: AdvisorProviderId
  model: string
  category: AdvisorProviderErrorCategory
  retryable: boolean
  fallbackEligible: boolean
  cooldownMs?: number
  latencyMs: number
  providerRequestId?: string
  finishReason?: string
  usage?: AdvisorTokenUsage
}
```

The public failure taxonomy is:

```text
RATE_LIMITED
TIMEOUT
AUTH_ERROR
BUDGET_ERROR
INVALID_JSON
INVALID_SCHEMA
UNKNOWN_IDS
EMPTY_RESPONSE
PROVIDER_UNAVAILABLE
SERVER_ERROR
ABORTED
UNKNOWN_ERROR
```

Provider-specific raw bodies and exception strings must not cross the adapter boundary.

### 3.4 Strict output validation

Validation must:

1. parse one JSON object;
2. reject arrays and primitives;
3. reject all fields outside the exact allowlist;
4. specifically reject `replacement`, `text`, `write`, `html`, `mutation`, `commands`, DOM-related operations, and equivalent case-insensitive keys;
5. require a non-empty string ID array;
6. reject duplicate or unknown IDs;
7. require bounded `ambiguityClass` and `reasonCode`;
8. return a normalized failure category rather than throw a generic exception.

The same validator must be used after every adapter response so provider behavior cannot weaken the contract.

## 4. Provider health model

### 4.1 State

Each in-process provider record tracks:

- consecutive failures;
- successful requests;
- rate-limit count;
- invalid-response count;
- timeout count;
- auth failures;
- budget failures;
- bounded recent-latency samples;
- most recent latency;
- p50 and p95 latency;
- last success timestamp;
- last failure timestamp;
- cooldown-until timestamp;
- availability state.

States:

```text
HEALTHY
DEGRADED
RATE_LIMITED
UNAVAILABLE
DISABLED
RECOVERING
```

### 4.2 Deterministic transitions

- Disabled configuration -> `DISABLED`.
- Success in normal state -> `HEALTHY`, reset consecutive failures.
- Success after cooldown -> `RECOVERING`; a configurable second success returns `HEALTHY`.
- 429 -> `RATE_LIMITED`, set header-derived cooldown.
- Auth failure -> `UNAVAILABLE` for the process/config epoch; do not retry the same credentials.
- Timeout or 5xx -> increment failure count; one failure may be `DEGRADED`, threshold opens `UNAVAILABLE` cooldown.
- Invalid output -> `DEGRADED`; repeated invalid output may open a short cooldown.
- Budget error -> `DEGRADED`; never retry the same provider with the identical request and budget.
- Cooldown expiry -> `RECOVERING`; allow one probe request, not a flood.

This is an in-memory process-local circuit and quota view. It is intentionally not a distributed consensus system. Multi-instance production may temporarily duplicate one recovery probe per instance; that is acceptable initially and must be reflected in deployment capacity planning.

### 4.3 Latency percentiles

Keep a bounded ring buffer per provider and compute deterministic nearest-rank p50/p95. Do not add a metrics database to this phase.

## 5. Provider selection and fallback algorithm

For one advisor event:

1. Build the ordered provider list from configuration: primary, then fallback.
2. Limit candidates to two.
3. For each candidate, check enabled, required capabilities, health state, cooldown, known quota/capacity signal, and remaining request deadline.
4. Call the first eligible provider.
5. On success, stop immediately.
6. On failure, record health and telemetry.
7. Attempt the second provider only when the normalized failure is fallback-eligible and enough deadline remains.
8. If no provider succeeds, return unavailable to the existing local path.

Never:

- call providers in parallel;
- call more than two providers;
- retry a budget failure with the same budget;
- fallback because a result disagrees with local scores;
- ask one model to choose another;
- vote or compare answers.

### 5.1 Failure eligibility

Normally eligible for one fallback:

- `RATE_LIMITED`;
- provider `TIMEOUT` when deadline remains;
- `SERVER_ERROR`;
- temporary `PROVIDER_UNAVAILABLE`;
- `BUDGET_ERROR`;
- `INVALID_JSON`;
- `INVALID_SCHEMA`;
- `UNKNOWN_IDS`;
- `EMPTY_RESPONSE`.

Auth/configuration failures disable that provider and may use an independently configured fallback, but must not retry the failed provider.

`ABORTED` caused by caller cancellation is not fallback-eligible because the event is no longer relevant.

### 5.2 Retry policy

Provider-manager fallback is not a retry of the same provider.

Same-provider retry is permitted only when:

- timeout or 5xx has at most one bounded retry;
- the caller's signal remains active;
- sufficient absolute deadline remains;
- the retry does not violate cooldown or known quota;
- the adapter can explain why the second attempt may differ.

429 defaults to cooldown plus fallback. A same-provider retry is allowed only when an explicit, short provider reset fits within the remaining event deadline. No exponential retry loop is allowed.

Invalid JSON is not retried unless the second request changes the output contract in a pre-tested deterministic way. The current Groq JSON-to-text retry should be removed from the advisor path.

## 6. Groq quota and cooldown strategy

Parse, sanitize, and retain where present:

- `Retry-After` as delta seconds or HTTP date;
- Groq request/token remaining headers;
- request/token reset headers;
- provider request ID.

Cooldown priority:

1. valid `Retry-After`;
2. applicable provider reset header;
3. bounded conservative configured default.

Do not invent provider request/token limits. Missing headers mean capacity is unknown, not available.

Quota metadata must influence only availability and observability. It must not dynamically choose a semantically different model.

## 7. Gemini adapter policy

Gemini is a direct second provider behind the same interface. It is not Google Cloud Translation and must use a separate configuration and privacy review.

Initial requirements:

- feature flag default off;
- fallback flag default off;
- direct paid API/project intended for production;
- same packet, exact schema, safety validator, deadlines, health model, and telemetry;
- no production traffic until authentication, schema reliability, privacy, cost, latency, and at least 200 valid frozen ranks pass;
- no claim that `gemini-2.5-flash-lite` is suitable until measured;
- re-verify the live model ID and lifecycle immediately before implementation/evaluation.

The adapter may be compiled and unit-tested while disabled. That does not authorize production fallback.

## 8. Local-first and stale behavior

If all providers are disabled, unhealthy, in cooldown, or fail:

```text
local analysis
  -> local hypotheses
  -> local decision
  -> policy
  -> Write Gate
```

Telemetry must distinguish:

```text
LLM_ADVISED_DECISION
LOCAL_ONLY_DECISION
```

The current generation check after consultation is authoritative and must remain. A caller abort should propagate as `ABORTED`; a returned rank must also be discarded if the field generation changed. A provider manager cannot make stale data current.

## 9. Translation boundary

Google Cloud Translation NMT remains under:

- `backend/src/providers/googleTranslateProvider.ts`;
- `backend/src/providers/translationRouter.ts`;
- `backend/src/providers/translationProvider.ts`.

The hypothesis advisor interface must not accept translation text generation, translation strategies, or Translation credentials. Gemini must not become an implicit translation fallback.

## 10. Privacy and logging

Preserve the current packet minimization and protected-content suppression.

Never log:

- raw snippet or field text;
- full packet;
- prompts or model content;
- authorization headers, API keys, JWTs, or cookies;
- replacement candidates;
- provider raw error bodies that may echo input.

Structured advisor telemetry may include:

- Flowlary request ID;
- provider-safe request ID;
- provider and model;
- normalized result/error;
- latency;
- fallback used and normalized reason;
- cooldown duration/until;
- token counts and reasoning tokens;
- finish reason;
- ranking validity category;
- stale response;
- local fallback;
- capability/health selection reason.

Provider request IDs must be accepted only from documented headers/fields and length-sanitized before logging.

## 11. Cost controls

- Existing per-user rate limits remain the first ingress control, but advisor gets its own operation key.
- Add a process-local global advisor/provider limiter aligned to configured paid capacity, not undocumented free-tier assumptions.
- Enforce provider cooldown.
- At most two provider calls per event.
- At most one fallback attempt.
- No voting or speculative parallel request.
- Same-provider retries count against the two-call ceiling; therefore a primary retry normally suppresses fallback.
- Record input/output/reasoning usage when supplied.
- Treat missing usage as unknown, never zero.

## 12. Observability answers

“Why did this request use Gemini instead of Groq?” must be answerable from one correlated event:

```text
primary=groq
primaryResult=RATE_LIMITED
primaryCooldownMs=...
fallback=gemini
fallbackResult=SUCCESS
```

“Why did Flowlary fall back to local?”:

```text
primaryResult=TIMEOUT
fallbackResult=PROVIDER_UNAVAILABLE
finalResult=LOCAL_ONLY_DECISION
```

Raw text is not needed for either answer.

## 13. Exact migration sequence

### Phase 1 — contracts, validation, health model

Add provider-neutral types, strict result validation, deterministic health state, and manager selection with injected providers. Do not change the production advisor call yet.

Gate:

- typecheck;
- provider contract unit tests;
- validator safety tests;
- health transition and cooldown tests;
- no production route behavior change.

### Phase 2 — Groq advisor adapter hardening

Wrap Groq for the advisor only. Add typed HTTP/error normalization, Retry-After/reset parsing, usage/reasoning/finish metadata, and configured advisor budget defaulting to 180. Remove meaningless advisor JSON-to-text retry. Keep other Groq tasks on the current generic client until separately migrated.

Gate:

- all Groq adapter mocked contract tests;
- no retry-storm test;
- budget error classification tests;
- current extension safety suite;
- production default still 180;
- apply still shadow.

### Phase 3 — Gemini adapter, disabled

Add the adapter and env fields. Both adapter and fallback flags default off. Do not require Gemini for readiness.

Gate:

- mocked adapter contract suite;
- auth/429/5xx/timeout/budget/schema normalization;
- privacy review;
- no live production traffic.

### Phase 4 — provider manager integration

Route the backend advisor through the manager with Groq as the only enabled provider. Add advisor-specific timeout, usage operation, and telemetry. Keep the extension response contract stable.

Gate:

- Groq success calls no fallback;
- all-provider failure yields existing unavailable/local behavior;
- max provider calls <= 2;
- extension tests and backend integration tests.

### Phase 5 — Groq evaluation

Use a paid/capacity-sufficient Groq environment and the frozen dataset/seed/prompt/packet. Run declared budget configurations separately until at least 200 valid ranks are collected.

No production budget change during data collection.

### Phase 6 — Gemini evaluation

Run the same frozen evaluation with at least 200 valid ranks. Measure model quality separately from provider failures.

### Phase 7 — compare evidence

Compare Top-1, Top-2, advised accuracy delta, safety, abstention, JSON/schema reliability, latency, failure rate, stability, cost, and privacy.

### Phase 8 — failure-only fallback in shadow

Only after Gemini passes independently, enable fallback in a staging/shadow environment. Groq remains primary. Observe fallback reason, volume, sequential latency, and local fallback.

### Phases 9–12

Observe; approve a production budget separately; run a limited advisor-apply experiment only after safety and quality gates; perform a final production-readiness audit.

## 14. Rollback plan

Every activation is configuration-controlled:

1. Disable fallback flag: manager uses Groq only.
2. Disable Gemini adapter: Gemini is not selectable.
3. Disable Groq adapter: local-only remains operational.
4. Disable advisor feature/registration if backend behavior is suspect: existing local engine remains authoritative.
5. Restore the previous advisor route implementation only if the abstraction itself fails before deployment; do not restore retry storms or direct writes.

Rollback must not:

- switch apply on;
- change hypothesis generation or policy;
- route translation through an LLM;
- erase failure telemetry needed to diagnose the incident.

Health state is in memory, so process restart clears cooldown. Deployment tooling should avoid rolling restart storms during a provider outage.

## 15. Risks

- A fallback introduced before the primary contract is reliable becomes a de facto primary and doubles avoidable cost.
- A production budget change mixed with provider migration destroys experimental attribution.
- Generic retry logic can exceed the two-call ceiling or produce 429 storms.
- Sequential fallback can exceed the stale boundary unless one absolute deadline is shared.
- Auth failures incorrectly marked retryable can repeatedly send bad credentials.
- Free Gemini use may violate the required privacy posture; production requires a reviewed paid data-processing configuration.
- Multiple backend instances have independent health state and may each send a recovery probe.
- Advisor-specific usage currently shares layout-classification accounting; migration errors could affect entitlement charging.
- Existing route parsing filters packet fields but does not use one shared strict schema.
- Fully detaching shadow consultation changes cycle ordering and requires dedicated extension tests.

## 16. Files that must change

The minimal implementation surface:

- `backend/src/providers/advisorTypes.ts` — provider-neutral contracts and taxonomy.
- `backend/src/providers/advisorValidation.ts` — exact ID-only output validation.
- `backend/src/health/providerHealth.ts` — deterministic health/cooldown state.
- `backend/src/providers/advisorProviderManager.ts` — ordered, failure-only selection.
- `backend/src/providers/groqAdvisorProvider.ts` — Groq adapter for hypothesis ranking.
- `backend/src/providers/geminiAdvisorProvider.ts` — disabled-by-default Gemini adapter.
- `backend/src/providers/hypothesisAdvisorProvider.ts` — become provider-neutral orchestration/compatibility entry.
- `backend/src/config/env.ts` — advisor provider flags, models, budget, and deadline.
- `backend/.env.example` — document safe disabled defaults.
- `backend/src/gateway/index.ts` — manager wiring, advisor-specific accounting and telemetry.
- `backend/src/services/usage.ts` — advisor operation and optional provider metadata.
- `backend/src/gateway/errors.ts` — map normalized terminal outcomes to the stable API errors.
- `tests/unit/backend/advisorValidation.test.ts`.
- `tests/unit/backend/providerHealth.test.ts`.
- `tests/unit/backend/advisorProviderManager.test.ts`.
- `tests/unit/backend/groqAdvisorProvider.test.ts`.
- `tests/unit/backend/geminiAdvisorProvider.test.ts`.
- `tests/integration/ai-provider-fallback.test.ts`.
- `tests/integration/phase16-ai-gateway.test.ts` — preserve endpoint and accounting compatibility.

Conditional changes:

- `packages/shared/src/ai/models.ts` only if provider model identifiers remain shared; backend-only configuration is preferable for server-only provider selection.
- `backend/src/routes/http.ts` only for optional provider-neutral health metadata or stricter advisor request parsing.
- `extension/src/core/writeGate/pipeline.ts` only in the later dedicated async-shadow latency phase.
- `extension/src/core/engine/advisor.ts` only to strengthen post-await stale checks or telemetry; not required for backend abstraction.
- `deploy/README.md` to document production flags and rollback.

## 17. Files that must not change in this migration

- `extension/src/core/engine/hypotheses.ts`.
- `extension/src/core/engine/chunks.ts`.
- `extension/src/core/engine/candidates.ts`.
- `extension/src/core/engine/decide.ts`.
- `extension/src/core/engine/mixedLayoutSafety.ts`.
- `extension/src/core/policy/writingPolicy.ts`.
- `extension/src/core/writeGate/writeGate.ts`.
- `extension/src/core/writeGate/pipelineTranslate.ts`.
- `extension/src/features/translation/**`.
- `backend/src/providers/googleTranslateProvider.ts`.
- `backend/src/providers/translationRouter.ts`.
- `backend/src/providers/translationProvider.ts`.
- frozen holdout generators, seed, packets, and gold labels.
- correction, learning coach, report narration, explanation localization, and legacy layout-classifier behavior.
- website UI and provider-selection UI; users must not choose vendors.

The shared advisor system prompt must remain unchanged during provider reliability evaluations unless a separate prompt experiment is declared and evaluated independently.

## 18. Test gates by phase

### Before Phase 1 integration

- interface accepts injected providers;
- exact capability selection;
- strict allowlist output validation;
- replacement/text/write/html/mutation/command/DOM-key rejection;
- malformed JSON, empty result, invalid schema, duplicate/unknown IDs;
- health state transitions, p50/p95, cooldown expiry, recovery probe.

### Before Groq adapter becomes active

- 200 success with usage/reasoning/finish/request-ID capture;
- 429 with delta-seconds Retry-After;
- 429 with HTTP-date Retry-After;
- malformed or negative Retry-After;
- Groq reset-header parsing;
- auth, timeout, abort, network, 4xx config/model, 5xx;
- `json_validate_failed` and length finish -> budget classification where supported by evidence;
- no automatic JSON-to-text advisor retry;
- no secrets/raw response content in logs.

### Before Gemini is deployable but disabled

- same contract suite as Groq;
- Gemini structured-output request is exact and deterministic;
- paid-project privacy configuration documented;
- disabled/missing-key states do not affect readiness or local behavior.

### Before failure-only fallback shadow

- primary success -> exactly one call;
- Groq 429/timeout/5xx/invalid output -> Gemini once;
- auth disables primary and allows independent fallback once;
- abort/stale -> no fallback;
- fallback disabled/unhealthy/cooldown -> no call;
- both unavailable -> provider-neutral unavailable and local decision;
- Groq recovery -> primary restored;
- no parallel calls;
- maximum two calls;
- one absolute deadline across both providers;
- stale Groq and stale Gemini ranks discarded;
- existing advisor safety and Write Gate suites pass.

### Before any production budget increase

- declared contract budget experiment;
- at least 200 valid Groq ranks;
- JSON/schema/unknown-ID rates;
- reasoning usage distribution;
- finish reasons;
- latency p50/p95;
- cost estimate using measured tokens;
- no prompt, packet, policy, provider, or gold-label changes in the same experiment.

### Before any apply experiment

- both provider reliability and selected-model ranking quality independently pass;
- advised accuracy improves over frozen local baseline;
- layout false positives remain zero or meet an explicitly approved bound;
- mixed-language automatic writes remain zero;
- protected-content and stale-write violations remain zero;
- rollback flag tested;
- Write Gate remains the sole mutation path.

## 19. Evaluation interpretation

Report provider reliability separately from model quality:

- 429: provider capacity failure.
- timeout: provider/transport failure.
- budget exhaustion: request-contract configuration failure.
- missing local hypothesis: local generation failure.
- valid response selecting the wrong existing hypothesis: model ranking failure.

Required per-provider sample size is at least 200 valid rankings using the same frozen seed, packet, prompt, gold labels, and scoring rules. Tiny contract samples prove only that the API contract can work.

## 20. Acceptance status at audit time

Already true:

- local-first path exists;
- LLM cannot directly write;
- Write Gate is authoritative;
- translation is separate;
- apply is shadow;
- no parallel voting;
- no dynamic AI routing;
- stale response is checked before write;
- packet privacy constraints exist.

Not yet true:

- advisor business logic is provider-independent;
- failures use the required normalized taxonomy;
- 429 establishes provider cooldown;
- provider health and recovery are tracked;
- Groq budget failures are correctly classified;
- reasoning/finish/quota metadata reaches telemetry;
- Gemini adapter exists and satisfies the same contract;
- failure-only fallback is tested;
- advisor has a dedicated <=1500 ms boundary;
- advisor usage has a distinct operation;
- either model has at least 200 valid frozen rankings under production-candidate settings.

Therefore:

```text
PRODUCTION READINESS:
NOT READY
```
