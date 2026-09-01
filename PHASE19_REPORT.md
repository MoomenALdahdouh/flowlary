# Phase 19 Report

**Date:** 2026-08-25  
**Repository:** `/Users/moomen/Projects/flowlary`  
**Method:** AUDIT → IMPLEMENT → TEST → BUILD → VERIFY → FIX → REVERIFY  

Code is the source of truth. Production infrastructure was checked independently of client configuration. This phase does **not** claim production readiness.

---

## 1. Repository audit

**Status:** VERIFIED

Workspaces: `extension`, `backend`, `website`, `packages/shared`.

Canonical configuration in active source:

| Surface | Canonical URL |
|---------|----------------|
| Website | `https://flowlary.com` |
| API | `https://api.flowlary.com` |
| Development API | `http://127.0.0.1:8787` |

Active production configuration does **not** contain `flowlary-api.zaixos.com` or `lingo-api.zaixos.com`. Those strings exist only in tests, prerender forbidden lists, and historical docs.

The system already had Phase 16 AI Gateway, Phase 17 account/JWT/entitlement, and Phase 18 website/popup UX. Phase 19 connected those pieces, fixed server entitlement after trial expiry, added a billing boundary without fake payments, and added a website account page against the same API.

---

## 2. Architecture verified

**Status:** VERIFIED (code) · NOT VERIFIED (live production path)

```
Chrome Extension
      ↓ install HMAC or account JWT
https://api.flowlary.com        (configured; DNS not deployed)
      ↓ authenticateRequest()
      ↓ server entitlement (account store is authoritative)
      ↓ rate limit
      ↓ AI Gateway
      ↓ GROQ_API_KEY (server only)
      ↓ Groq
      ↓ validated response
      ↓ extension UI
```

Website account path (same backend, no second account system):

```
https://flowlary.com/account
      ↓ CORS (flowlary.com / www.flowlary.com)
https://api.flowlary.com
      ↓ register / login / refresh / logout
      ↓ GET /api/account + /api/account/entitlement
```

Billing (not connected):

```
Future provider webhook → Flowlary backend → account subscription → server entitlement → extension
```

Never: provider → extension → Pro.

Client header `X-Flowlary-Entitlement` is advisory only.

---

## 3. API verification

**Local:** VERIFIED  
**Production `https://api.flowlary.com`:** BLOCKED_EXTERNAL — DNS

Local `GET /health` (running process):

```json
{"ok":true,"service":"flowlary-ai-gateway","env":"development","groqConfigured":false}
```

Implemented routes (code + local HTTP tests):

| Method | Path | Role |
|--------|------|------|
| GET | `/health` | Liveness + `groqConfigured` |
| POST | `/api/auth/register` | Account or legacy install |
| POST | `/api/auth/login` | Account login |
| POST | `/api/auth/refresh` | Token rotation |
| POST | `/api/auth/logout` | Session invalidation |
| GET | `/api/account` | Account + usage summary |
| GET | `/api/account/entitlement` | Server entitlement |
| POST | `/api/ai/correction` | Managed correction |
| POST | `/api/ai/translation` | Managed translation |
| POST | `/api/ai/layout-classification` | Layout classifier |
| POST | `/api/translate` | Legacy alias |
| POST | `/api/analyze-word` | Legacy alias |

No new unnecessary routes were added. No billing webhook route (would accept unverified payloads).

---

## 4. DNS status

**Status:** BLOCKED_EXTERNAL — DNS

Checked 2026-08-25:

```
dig +short api.flowlary.com A      → empty
dig +short api.flowlary.com AAAA   → empty
dig +short api.flowlary.com CNAME  → empty
dig +short flowlary.com A          → empty
```

DNS was not modified. No infrastructure credentials/tools were available.

---

## 5. TLS status

**Status:** BLOCKED_EXTERNAL — DNS

`curl -I https://api.flowlary.com` → `Could not resolve host`  
`curl https://api.flowlary.com/health` → `Could not resolve host`

TLS cannot be verified until DNS exists.

---

## 6. Groq verification

**Local Groq:** NOT VERIFIED  
**Production Groq:** BLOCKED_EXTERNAL — DNS + credentials

- `backend/.env` is **absent**.
- Local health: `groqConfigured: false`.
- `node scripts/verify-live-api.mjs` → `NOT VERIFIED credentials — GROQ_API_KEY missing in backend/.env`
- Production script with `FLOWLARY_API_BASE=https://api.flowlary.com` was not runnable against a live host because DNS does not resolve.

Models in code (`packages/shared/src/ai/models.ts`) — **not silently changed**:

| Contract | Model |
|----------|--------|
| Correction | `llama-3.1-8b-instant` |
| Translation | `openai/gpt-oss-120b` |
| Layout | `allam-2-7b` |

Gateway tests mock Groq. They do **not** prove live Groq availability.

---

## 7. Account verification

**Local:** VERIFIED  
**Production:** BLOCKED_EXTERNAL — DNS

Covered by `tests/integration/phase17-account.test.ts`:

- register
- duplicate register → 409
- invalid login → 401
- valid login / access token / refresh / logout
- invalid access token → 401
- GET `/api/account` requires auth
- GET `/api/account/entitlement`

Passwords are hashed (scrypt). Tokens are not logged. Auth failure messages are generic.

Website `/account` uses the same API (`https://api.flowlary.com`, overridable only via `VITE_FLOWLARY_API_URL` in development). SSR tests pass. Live website login is **NOT VERIFIED** (DNS).

---

## 8. Entitlement verification

**Local:** VERIFIED  
**Production:** BLOCKED_EXTERNAL — DNS

**Bug fixed:** expired `plan: 'trial'` previously returned `allowed: false`, `reason: 'trial_expired'`, `remainingMs: 0` and never used `usageBalanceMs`. It now persists `plan: 'free'` and applies the stored free budget.

Client `X-Flowlary-Entitlement: pro` with exhausted free balance → **403 `AI_ENTITLEMENT_DENIED`**. Client claims cannot elevate plan.

Until billing exists, Pro is only possible via server-side `setAccountPlan()` — not from the website, popup, or client header. No fake Pro activation was added.

---

## 9. AI E2E verification

**Local contracts (mocked Groq):** VERIFIED  
**Local live Groq:** NOT VERIFIED  
**Production live Groq:** BLOCKED_EXTERNAL  
**Chrome field E2E:** NOT VERIFIED

Safety → entitlement → auth → gateway ordering is implemented in the extension/background path. Characterization tests cover protected fields.

Correction stale-response protection remains in the existing correction pipeline (not removed).

Layout remains local-first; AI classification is a fallback.

---

## 10. BYOK verification

**Code:** VERIFIED  
**Chrome manual:** NOT VERIFIED

BYOK is still optional, correction-only, stored locally, and not sent to Flowlary servers. Release host permissions include `https://api.groq.com/*` for BYOK only. Managed `GROQ_API_KEY` is server-only and absent from extension/website release output.

Popup BYOK / managed switch is wired to real `correction.aiProvider` / `hasGroqKey` state.

---

## 11. Popup verification

**Status:** VERIFIED (unit/integration) · NOT VERIFIED (Chrome load)

Popup plan, usage, signed-in/out, BYOK, pause, and setup states come from `ExtensionStatus`, not hardcoded Free/Pro/usage.

Connection state now includes `apiHealth` from `GET /health` (15s cache, 2s timeout).

Error copy:

| Failure | UI |
|---------|-----|
| API / provider | Flowlary AI is temporarily unavailable. |
| Rate limit / exhausted | You've reached your current usage limit. |
| Auth | Please sign in again. |
| Billing | Billing isn't available yet. |

---

## 12. Website verification

**SSR/tests/build:** VERIFIED  
**https://flowlary.com live:** BLOCKED_EXTERNAL — DNS  
**Browser visual pass:** NOT VERIFIED (no browser automation in this environment)

- Marketing routes prerendered (14 routes + 404), including `/account` (`noindex, nofollow`).
- Pricing remains honest: Free `$0`, Pro upgrade disabled, “Billing isn't available yet.”
- `/account` register/login/logout against the same backend.
- Website source does not hardcode `localhost` / `127.0.0.1`.
- Production website JS contains React Router’s internal `http://localhost` origin fallback string. That is **not** a Flowlary API host.

---

## 13. Billing boundary

**Provider checkout:** NOT IMPLEMENTED (intentional)  
**Fake payments:** not added  
**Interfaces:** IMPLEMENTED

`backend/src/billing/index.ts`:

- `BillingProvider`
- `CheckoutService`
- `SubscriptionService`
- `EntitlementSync`

All currently `UnconfiguredBillingProvider`: `configured: false`, checkout unavailable, `applySubscription` is a no-op and does not grant Pro.

Paddle: **BLOCKED_EXTERNAL** — account/credentials unavailable. No fake Paddle checkout. No webhook route.

---

## 14. Security audit

**Release extension `extension/dist`:** VERIFIED — no `GROQ_API_KEY`, JWT secrets, `localhost`, `127.0.0.1`, or legacy ZAIXOS API hosts.

Release manifest host permissions:

```
https://api.groq.com/*
https://api.flowlary.com/*
```

**Website `website/dist`:** VERIFIED — no server secrets, no legacy API hosts, no `127.0.0.1`. One `localhost` string from React Router internals (see §12).

Server env (backend only; never in website/extension/dist):

- `GROQ_API_KEY`
- `FLOWLARY_JWT_SECRET`
- `FLOWLARY_EXTENSION_AUTH_SECRET`
- `FLOWLARY_CORS_ORIGINS`
- `FLOWLARY_ENV`, `PORT`, `FLOWLARY_DATA_PATH`, `FLOWLARY_AI_TIMEOUT_MS`, `FLOWLARY_MAX_BODY_BYTES`, `FLOWLARY_AUTH_DISABLED`

CORS: no production wildcard. Allowed defaults: `https://flowlary.com`, `https://www.flowlary.com`. Development also allows local website origins. Extension requests use host permissions, not CORS.

---

## 15. Performance observations

**Status:** VERIFIED (inspection only; no premature optimization)

- Popup `GET_STATUS` now probes `/health` (≤2s, cached 15s). If DNS is down, the popup honestly shows AI unavailable instead of a false “connected”.
- No new polling loops or retry storms.
- JSON store writes are synchronous, exclusive-locked, and atomic (temp + rename). **Limitation:** single-process. Horizontal multi-instance writes can still lose updates. Not a database migration.

---

## 16. Tests

**Status:** VERIFIED

```
npm test          → 557 passed (shared 5 + backend 38 + extension 514)
npm run test:web  → 35 passed
```

Coverage was not reduced. Added/extended: trial→free, duplicate register, invalid token, client `pro` header cannot elevate exhausted free, 429 `AI_RATE_LIMITED`, CORS preflight, billing boundary, store persist, popup API-offline/BYOK, popup error copy, website `/account`.

Safety characterization tests (password/OTP/payment fields) passed.

---

## 17. Build

**Status:** VERIFIED

```
npm run build → PASS
```

---

## 18. Release build

**Status:** VERIFIED

```
npm run build:release → PASS
npm run build:web     → PASS (14 prerendered routes + 404)
```

---

## 19. Chrome E2E

**Status:** NOT VERIFIED

No Chrome unpacked-load against Gmail/Docs/Twitter/etc. was performed. No browser automation tools were available. Do not treat popup unit tests as a substitute for that pass.

To perform it locally after DNS/Groq exist:

1. `npm run build:release`
2. Chrome → Load unpacked → `extension/dist`
3. Test ordinary `input`, `textarea`, `contenteditable` on non-Flowlary sites
4. Correction / translation / layout / popup / account / BYOK / pause / exclusions

Do not enter real secrets during that pass.

---

## 20. Files changed (Phase 19)

Implementation (this phase):

- `backend/src/services/accountService.ts` — trial expiry → free + remaining budget
- `backend/src/db/store.ts` — exclusive lock + atomic persist
- `backend/src/config/env.ts` — `corsOrigins` on `AppConfig`
- `backend/src/middleware/cors.ts` — production vs development origins, OPTIONS 204/403
- `backend/src/middleware/entitlement.ts` — comment: client claim is not billing truth
- `backend/src/routes/http.ts` — CORS from config
- `backend/src/billing/index.ts` — billing interfaces, unconfigured provider
- `backend/.env.example`
- `extension/src/config/apiHealth.ts`
- `extension/src/background/index.ts` — `apiHealth` on status
- `extension/src/messaging/types.ts`
- `extension/src/popup/status.ts`, `api.ts`, `App.tsx`, `i18n/messages.ts`
- `extension/src/features/correction/applyCorrection.ts` — production error copy
- Website: `/account`, `website/src/account/client.ts`, nav, SEO noindex, prerender, i18n
- Tests listed in §16
- `docs/production/FLOWLARY_PRODUCTION_DOMAIN.md` — account routes

---

## 21. Remaining blockers

| ID | Classification | Detail |
|----|----------------|--------|
| DNS for `api.flowlary.com` | BLOCKED_EXTERNAL | No A/AAAA/CNAME |
| DNS for `flowlary.com` | BLOCKED_EXTERNAL | No A record |
| TLS | BLOCKED_EXTERNAL | Hosts do not resolve |
| Production server credentials / deploy | BLOCKED_EXTERNAL | No deploy credentials in this environment |
| `GROQ_API_KEY` | BLOCKED_EXTERNAL | `backend/.env` absent; local `groqConfigured: false` |
| Paddle / billing provider | BLOCKED_EXTERNAL | No account/credentials; interfaces only |
| Chrome Web Store listing | BLOCKED_EXTERNAL | `CHROME_WEB_STORE_URL` is still `null` |
| Chrome manual E2E | NOT VERIFIED | No unpacked Chrome session in this environment |
| Live Groq correction/translation/layout | NOT VERIFIED | No key + no production API |
| JSON store multi-instance | production limitation | Single-process file store; not horizontally scalable |

No internally fixable blockers were left unfixed after the reverify loop.

---

## 22. Exact production deployment steps

Do not treat this as “already deployed.”

1. **DNS**
   - `flowlary.com` → website host (A/AAAA or CNAME)
   - `www.flowlary.com` → website
   - `api.flowlary.com` → API host (A/AAAA or CNAME)
2. **TLS** on both website and API (valid certificates, HTTPS only).
3. **API process** (Node 20+) with **server-only** env:
   - `FLOWLARY_ENV=production`
   - `PORT=…`
   - `GROQ_API_KEY` (managed Groq)
   - `FLOWLARY_JWT_SECRET`
   - `FLOWLARY_EXTENSION_AUTH_SECRET`
   - `FLOWLARY_CORS_ORIGINS=https://flowlary.com,https://www.flowlary.com`
   - `FLOWLARY_DATA_PATH` (persistent disk; single instance)
   - `FLOWLARY_AUTH_DISABLED` **unset** (must not be `1` in production)
4. Confirm `GET https://api.flowlary.com/health` returns `{ "ok": true, "service": "flowlary-ai-gateway", "env": "production", "groqConfigured": true }`.
5. Deploy website `website/dist` to `https://flowlary.com` (do not put the API inside the marketing site).
6. Load `extension/dist` from `npm run build:release` (or Chrome Web Store when a listing exists).
7. Run:

```bash
FLOWLARY_API_BASE=https://api.flowlary.com node scripts/verify-live-api.mjs
```

8. Repeat Chrome E2E on real text fields.
9. Do **not** enable billing until a real provider webhook verifies server-side and `EntitlementSync` is wired to `setAccountPlan`.

---

## Acceptance checklist

| Criterion | Status |
|-----------|--------|
| Repository audited | VERIFIED |
| Website functional (build/SSR) | VERIFIED |
| Website live at flowlary.com | BLOCKED_EXTERNAL |
| API functional locally | VERIFIED |
| Account auth functional locally | VERIFIED |
| JWT lifecycle verified | VERIFIED |
| Server entitlement verified | VERIFIED |
| AI correction verified locally (live Groq) | NOT VERIFIED |
| AI translation verified locally (live Groq) | NOT VERIFIED |
| AI layout verified locally (live Groq) | NOT VERIFIED |
| BYOK (code) | VERIFIED |
| Safety gate (tests) | VERIFIED |
| Rate limiting | VERIFIED |
| CORS | VERIFIED |
| Popup connected to real state | VERIFIED |
| Account UI connected to real auth | VERIFIED (local/code); live BLOCKED_EXTERNAL |
| Pricing honest and billing-ready | VERIFIED |
| No fake payment | VERIFIED |
| Production API configuration correct | VERIFIED (code) |
| api.flowlary.com canonical | VERIFIED (code) |
| Legacy ZAIXOS API hosts absent from active config | VERIFIED |
| No server secrets in release | VERIFIED |
| No localhost in extension release | VERIFIED |
| Tests pass | VERIFIED |
| Build passes | VERIFIED |
| Release build passes | VERIFIED |
| Chrome E2E | NOT VERIFIED |
| Live API verified | BLOCKED_EXTERNAL |
| Remaining blockers classified | VERIFIED |

**Phase 19 local work is complete.** Production is **not** ready until DNS, TLS, server deploy, and `GROQ_API_KEY` are actually in place and re-verified.
