# Flowlary — AI Production Checklist

**Last updated:** 2026-08-28  
**Purpose:** Explicit launch operations for managed AI (Groq) before consumer certification  
**Scope:** Server-side AI only — extension never holds `GROQ_API_KEY`

---

## Architecture summary

| Layer | Responsibility |
|-------|----------------|
| **Extension / website** | User consent, auth bearer token, UI error recovery (`AiErrorRecovery`) |
| **API gateway** | `backend/src/gateway/index.ts` — entitlement, credits, timeouts, provider routing |
| **Groq client** | `backend/src/providers/groqClient.ts` — `GROQ_API_KEY` server-only |
| **Models** | `packages/shared/src/ai/models.ts` — correction, translation, layout classification |
| **Usage / credits** | `backend/src/services/usage.ts`, `accountService.ts` — debit on success only |
| **Error mapping** | `backend/src/gateway/errors.ts` — `AI_TIMEOUT`, `AI_UNAVAILABLE`, `AI_USAGE_EXHAUSTED` distinct |

### AI endpoints (production host: `https://api.flowlary.com`)

| Endpoint | Feature | Provider |
|----------|---------|----------|
| `POST /api/ai/correction` | Writing correction | Groq (managed) |
| `POST /api/ai/translation` | Translation | Google Translate and/or Groq (router) |
| `POST /api/ai/layout-classification` | Layout fallback classifier | Groq |
| `POST /api/ai/explanation-localize` | Localized explanations | Groq |
| `POST /api/ai/learning-coach` | Dashboard coach | Groq |
| `POST /api/ai/learning-report-narrate` | Report narrative | Groq |

### Client surfaces (no direct Groq)

| Surface | AI usage |
|---------|----------|
| Popup correction / translation | → `api.flowlary.com` |
| Compose workbench | → correction API |
| Daily Brief | **Local** computation (`resolveDailyBrief.ts`); no Groq per brief |
| Learning Coach | → `/api/ai/learning-coach` |
| Learning Report narrate | → `/api/ai/learning-report-narrate` |
| Speed Box / Fix Layout | Layout local-first; classifier API is fallback |

---

## Required environment (production API host only)

Set in deployment environment (never in extension/website bundles):

| Variable | Required | Notes |
|----------|----------|-------|
| `GROQ_API_KEY` | **Yes** | Managed Groq key (`gsk_…`) |
| `FLOWLARY_ENV` | **Yes** | `production` |
| `FLOWLARY_JWT_SECRET` | **Yes** | Auth signing |
| `FLOWLARY_EXTENSION_AUTH_SECRET` | **Yes** | Install token |
| `FLOWLARY_WEB_ORIGIN` | **Yes** | `https://flowlary.com` (emails, CORS) |
| `FLOWLARY_CORS_ORIGINS` | **Yes** | `https://flowlary.com,https://www.flowlary.com` |
| `FLOWLARY_AI_TIMEOUT_MS` | Recommended | Default 30000 |
| `GOOGLE_TRANSLATE_*` | Optional | Translation routing when enabled |

Template: `backend/.env.example`

---

**Overall AI production status:** Local staging Groq path **VERIFIED**. Production host: `AI_PRODUCTION = BLOCKED_EXTERNAL` until `api.flowlary.com` is live.

---

## Pre-ops blocker investigation (2026-08-28)

### Layout classification HTTP 503

**Classification: READY** (real engineering defect — fixed)

| Stage | Finding |
|-------|---------|
| Client | Extension calls `/api/ai/layout-classification` as fallback when local heuristics are ambiguous |
| Gateway | `layoutClassification()` → `assertEntitlement` → `reserveManagedUsage` → `runLayoutClassifierProvider` |
| Provider | `callGroqChat` with model `allam-2-7b` |
| **Root cause** | `include_reasoning: false` was sent for **all** models. Groq returns HTTP 400 for `allam-2-7b`: ``include_reasoning` is not supported with this model``. Mapped to `groq_http_400` → `AI_UNAVAILABLE` (503). |
| **Fix** | `groqModelSupportsIncludeReasoning()` — only set `include_reasoning: false` for `gpt-oss` models |
| Launch path | Layout AI is **optional fallback**; local remap always works without API. Endpoint is **launch-relevant** for ambiguous tokens but **NOT_LAUNCH_CRITICAL** for core Fix Layout |

**Tests:** `tests/unit/backend/groqClient.test.ts`, `tests/integration/phase16-ai-gateway.test.ts`

### Entitlement denial HTTP 200

**Classification: READY** (verify fixture issue — not a security bug)

| Stage | Finding |
|-------|---------|
| Expected behavior | Install-only bearer token → `auth.allowed = false` → HTTP **403** `{ code: "AI_ENTITLEMENT_DENIED" }` |
| Observed in verify | HTTP 200 because script hit **stale server on port 8787** running `FLOWLARY_ENV=development` (`authDisabled: true` unconditionally in dev) |
| Production | `FLOWLARY_ENV=production` → auth enforced; install tokens cannot access managed AI |
| **Fix** | `verify-live-api.mjs` uses port **8791** (fresh server) + `FLOWLARY_ENV=staging` + `FLOWLARY_AUTH_DISABLED=0` |
| Security | **No gate weakened.** `canAccessTranslation` returns `false` when `!accountId`; `assertEntitlement` blocks layout/correction |

**Tests:** `phase16-ai-gateway.test.ts` (`denies anonymous entitlement`, `denies layout classification for install-only auth`)

---

## Launch checks (10 required)

| # | Check | Engineering status | Production verification |
|---|-------|-------------------|-------------------------|
| 1 | Production API has valid AI provider config | **ENGINEERING_READY** — `groqApiKey` read from `GROQ_API_KEY` in `env.ts` | **BLOCKED_EXTERNAL** — `api.flowlary.com` DNS unresolved 2026-08-28 |
| 2 | Real AI correction succeeds | **VERIFIED (local staging)** | **BLOCKED_EXTERNAL** on production host |
| 3 | AI response returned correctly | **VERIFIED (local staging)** | **BLOCKED_EXTERNAL** |
| 3b | Layout classification succeeds | **VERIFIED (local staging)** | **BLOCKED_EXTERNAL** |
| 4 | AI credits decrement correctly | **TESTS PASSING** — `phase28-monetization-e2e.test.ts` | **MANUAL_QA_REQUIRED** on production account |
| 5 | AI timeout handled | **ENGINEERING_READY** — `mapProviderFailure` → `AI_TIMEOUT` (504) | **MANUAL_QA_REQUIRED** |
| 6 | AI provider failure handled | **ENGINEERING_READY** — `AI_UNAVAILABLE` / `AI_PROVIDER_ERROR`; `AiErrorRecovery` retry UI | **MANUAL_QA_REQUIRED** |
| 7 | Retry works | **ENGINEERING_READY** — Groq 503 retry in `groqClient.ts`; UI retry in `AiErrorRecovery.tsx` | **MANUAL_QA_REQUIRED** |
| 8 | Credit exhaustion ≠ provider failure | **TESTS PASSING** — `AI_USAGE_EXHAUSTED` distinct from `AI_TEMPORARILY_UNAVAILABLE` in `usageUx.ts` | **MANUAL_QA_REQUIRED** |
| 9 | No API key in browser/extension | **VERIFIED** — `phase23-security.test.ts`; release dist scan clean | Re-run after each release build |
| 10 | No unnecessary writing logged | **ENGINEERING_READY** — usage records omit full text (`usage.ts`); password-reset tests confirm no token logging | Audit production logs after deploy |

**Overall AI production status:** `AI_PRODUCTION = BLOCKED_EXTERNAL` (production host not reachable; local Groq verification only)

---

## Verification commands

### A. Local staging (before production DNS)

```bash
# Requires GROQ_API_KEY in backend/.env (never commit)
node scripts/verify-live-api.mjs
```

**Last local run (2026-08-28, after fixes):**

| Check | Result |
|-------|--------|
| server health | VERIFIED |
| install auth | VERIFIED |
| account auth | VERIFIED |
| entitlement | VERIFIED (trial) |
| correction | VERIFIED |
| translation | VERIFIED |
| layout classification | **VERIFIED** (`kind=LAYOUT_MISMATCH`) |
| entitlement denial | **VERIFIED** (HTTP 403 install+anonymous) |

**Note:** Script uses port `8791` by default to avoid stale dev servers on `8787`. Override with `FLOWLARY_VERIFY_PORT`.

### B. Production (after DNS/TLS live)

```bash
curl -sS https://api.flowlary.com/health
# Expect: {"ok":true,...,"groqConfigured":true}

FLOWLARY_API_BASE=https://api.flowlary.com node scripts/verify-live-api.mjs
```

### C. Manual browser smoke (required for launch)

1. Sign in → enable Flowlary AI consent.
2. Correct real text on a web page → apply → credits decrease.
3. Disconnect network → correction shows retry/unavailable (not exhaustion).
4. Exhaust credits → `AI_USAGE_EXHAUSTED` copy; Fix Layout / Speed Box still work.

---

## Timeout & retry behavior (code reference)

| Mechanism | Location |
|-----------|----------|
| Request timeout | `config.requestTimeoutMs` → AbortSignal in gateway |
| Groq 503 retry | `groqClient.ts` — one 600ms retry |
| Groq JSON validate retry | `groqClient.ts` — fallback to text mode |
| Provider → API error code | `gateway/errors.ts` `mapProviderFailure` |
| Failed AI does not debit credits | `gateway/index.ts` — `releaseManagedUsageReservation` on catch |
| UI retry | `extension/src/ui/AiErrorRecovery.tsx` |

---

## Credit exhaustion vs provider failure

| State | User-facing | Trigger |
|-------|-------------|---------|
| `AI_USAGE_EXHAUSTED` | Credits depleted; local tools remain | Server entitlement `remainingMs` / credits = 0 |
| `AI_TEMPORARILY_UNAVAILABLE` | Provider/network issue; retry offered | `AI_UNAVAILABLE`, `AI_TIMEOUT`, `AI_PROVIDER_ERROR` |
| `AI_SETUP_REQUIRED` | Consent / sign-in | Client gates |

Tests: `tests/unit/shared/usageUx.test.ts`, `tests/integration/phase28-monetization-e2e.test.ts`

---

## Pre-launch security scan (repeat each release)

```bash
npm run build:release -w @flowlary/extension
npx vitest run tests/integration/phase23-security.test.ts -c extension/vitest.config.ts
```

Patterns blocked in release `extension/dist`: `gsk_`, `GROQ_API_KEY`, `api.groq.com`, `localhost`, `127.0.0.1`

---

## Owner actions to unblock AI production

1. Deploy API to `api.flowlary.com` with `GROQ_API_KEY` set in server environment.
2. Confirm `GET /health` returns `groqConfigured: true`.
3. Run `FLOWLARY_API_BASE=https://api.flowlary.com node scripts/verify-live-api.mjs`.
4. Execute manual AI smoke test (§B manual browser smoke).
5. Investigate layout-classification 503 on local verify if layout fallback is launch-critical — **RESOLVED** (see Pre-ops blocker investigation).

**Do not paste `GROQ_API_KEY` into chat, docs, or client bundles.**
