# Phase 17 Report — Production Deployment + Live AI Verification + Account Entitlement

**Date:** 2026-08-25  
**Repository:** `/Users/moomen/Projects/flowlary`  
**Branch:** `main` (ahead of origin, uncommitted)

---

## Executive summary

Phase 17 implements a **server-verified account and entitlement architecture** with persistent usage accounting, replaces install-only auth as the long-term identity path (while preserving install tokens for legacy/anonymous clients), and hardens the AI Gateway so **client entitlement headers cannot elevate billing**.

**Production deployment and live Groq verification remain BLOCKED_EXTERNAL** — `api.flowlary.com` does not resolve and `GROQ_API_KEY` is not available in this environment.

---

## Baseline (pre–Phase 17 work in session)

| Check | Result |
|-------|--------|
| `npm test` | 489 passing (pre-account work) |
| Nested duplicate `flowlary/flowlary/` | Removed (prior session) |
| Production API config | `https://api.flowlary.com` |

## Final verification (this session)

| Check | Result |
|-------|--------|
| `npm test` | **499 passed** (67 files) |
| `npm run build` | **PASS** |
| `npm run build:release` | **PASS** |
| Release dist audit | **PASS** — no `GROQ_API_KEY`, `localhost`, `127.0.0.1`, legacy ZAIXOS hosts |
| `api.flowlary.com` in release dist | **Present** (`manifest.json`, service worker bundle) |
| `api.groq.com` in release dist | Allowed (BYOK opt-in only) |
| DNS `api.flowlary.com` | **BLOCKED_EXTERNAL** — no A/AAAA/CNAME records |
| TLS / `GET /health` production | **BLOCKED_EXTERNAL** — host unreachable |
| Live Groq (local script) | **NOT VERIFIED** — `GROQ_API_KEY` missing |
| Chrome manual E2E | **NOT VERIFIED** — not run in this session |

---

## What was implemented

### Backend — account system

- **`backend/src/db/store.ts`** — JSON persistence for accounts, sessions, install links, usage
- **`backend/src/services/crypto.ts`** — scrypt passwords, JWT access tokens, refresh token hashing
- **`backend/src/services/accountService.ts`** — register/login/refresh/logout, server entitlement, usage recording
- **`backend/src/middleware/auth.ts`** — account JWT **or** legacy install HMAC; server-derived `rateLimitTier` and `allowed`
- **`backend/src/routes/http.ts`** — auth + account endpoints; AI routes unchanged
- **`backend/src/services/usage.ts`** — delegates to persistent store
- **`backend/src/config/env.ts`** — `jwtSecret`, `dataPath`; store init moved to server startup

### Extension — account integration

- **`extension/src/config/accountAuth.ts`** — register/login/refresh/logout, `ensureApiAuth`, `syncServerEntitlement`
- **`extension/src/config/auth.ts`** — fixed install token validation; `buildAuthenticatedHeaders`
- **Background handlers** — correction/translation/layout use authenticated headers
- **Popup** — minimal Account section (sign in/out, plan, “Billing unavailable”)
- **Messaging** — `ACCOUNT_*` messages + `ExtensionStatus.account`

### Shared types

- **`packages/shared/src/account/types.ts`** — plan types, trial duration, free balance constants
- **Storage keys** — `authAccessToken`, `authRefreshToken`, `authSessionId`, etc.

### Tests

- **`tests/integration/phase17-account.test.ts`** — 10 tests: register, login, entitlement, pro header bypass, install legacy, refresh/logout, usage, rate limit
- Updated phase 16 gateway tests for new `AuthContext` shape

### Tooling & docs

- **`scripts/verify-live-api.mjs`** — account auth + entitlement denial checks
- **`docs/production/PHASE17_ACCOUNT_ENTITLEMENT.md`**
- **`.gitignore`** — `backend/data/` (persisted store)

---

## Architecture

```
Chrome Extension
        ↓
api.flowlary.com (production) / 127.0.0.1:8787 (dev)
        ↓
Flowlary API / AI Gateway
        ↓
Server-side authentication (JWT or install token)
        ↓
Server-side entitlement (account store)
        ↓
Rate limits
        ↓
Groq (GROQ_API_KEY — server only)
        ↓
┌──────────────┬──────────────┬──────────────┐
│ Correction   │ Translation  │ Layout       │
│ Provider     │ Provider     │ Classifier   │
└──────────────┴──────────────┴──────────────┘
```

**BYOK** remains extension-local, correction-only, opt-in — never sent to Flowlary API.

---

## Auth & entitlement behavior

| Auth kind | Identity | Entitlement source |
|-----------|----------|-------------------|
| Account JWT | `accountId` | Server account record |
| Install token | `installId` | Server policy (free tier if client claim valid; anonymous denied) |
| Dev (`authDisabled`) | dev-install | Free tier (local only) |

Client `X-Flowlary-Entitlement: pro` **does not** unlock pro limits without server-side `plan: pro`.

New accounts: **7-day trial** → **free** with usage balance. **Pro** requires server-side assignment (no payment UI).

---

## Security audit (release bundle)

Searched `extension/dist` after `npm run build:release`:

| Pattern | Result |
|---------|--------|
| `GROQ_API_KEY` | Not found |
| `localhost` / `127.0.0.1` | Not found |
| `flowlary-api.zaixos.com` | Not found |
| `lingo-api.zaixos.com` | Not found |
| `api.flowlary.com` | Present (expected) |

---

## Live verification status

| Item | Status |
|------|--------|
| DNS | **BLOCKED_EXTERNAL** |
| TLS | **BLOCKED_EXTERNAL** |
| Production `/health` | **BLOCKED_EXTERNAL** |
| Groq correction | **NOT VERIFIED** (no key) |
| Groq translation | **NOT VERIFIED** (no key) |
| Groq layout | **NOT VERIFIED** (no key) |
| Account register (production) | **BLOCKED_EXTERNAL** |
| Entitlement denial (production) | **BLOCKED_EXTERNAL** |

Local verification script output:

```
NOT VERIFIED   credentials — GROQ_API_KEY missing in backend/.env
```

---

## Local development

| Component | How to run |
|-----------|------------|
| Website | Laravel Herd → `http://flowlary.test/` |
| Node API | `npm run dev:api` → `http://127.0.0.1:8787` |
| Extension dev | `npm run build` + load unpacked from `extension/dist` |
| Live AI verify | `cp backend/.env.example backend/.env`, add `GROQ_API_KEY`, `node scripts/verify-live-api.mjs` |

---

## Known limitations

1. **No payment/billing** — popup shows honest “Billing unavailable”
2. **Pro plan** — server-only assignment; no self-service activation
3. **JSON file store** — suitable for initial production; may migrate to DB in future phase
4. **`ACTIVATE_LICENSE`** — remains not implemented
5. **Chrome E2E** — manual testing not performed this session

---

## Remaining blockers (external)

1. Configure DNS for `api.flowlary.com` → production gateway host
2. Deploy Node backend with `GROQ_API_KEY`, `FLOWLARY_JWT_SECRET`, `FLOWLARY_EXTENSION_AUTH_SECRET`
3. Configure TLS (HTTPS)
4. Configure CORS for extension origin + `flowlary.com`
5. Provide `GROQ_API_KEY` for live verification

---

## Exact next phase

**Phase 18 (recommended):**

1. Deploy backend to production infrastructure
2. Configure DNS + TLS for `api.flowlary.com`
3. Run `FLOWLARY_API_BASE=https://api.flowlary.com node scripts/verify-live-api.mjs`
4. Chrome Web Store release with account-enabled extension
5. Payment integration (Paddle) wired to server entitlement
6. Optional: migrate JSON store to managed database

---

## Success criteria checklist

| Criterion | Status |
|-----------|--------|
| Canonical repo `/Users/moomen/Projects/flowlary` | ✅ |
| No nested duplicate project | ✅ |
| Production API uses `api.flowlary.com` | ✅ (config) |
| No active ZAIXOS API hosts | ✅ |
| Backend deploy verified | ❌ BLOCKED_EXTERNAL |
| DNS verified | ❌ BLOCKED_EXTERNAL |
| TLS verified | ❌ BLOCKED_EXTERNAL |
| GROQ_API_KEY server-only | ✅ |
| Managed AI through Flowlary API (code) | ✅ |
| BYOK local opt-in | ✅ |
| Account authentication | ✅ |
| Server entitlement authoritative | ✅ |
| Client cannot self-elevate to Pro | ✅ |
| Usage persisted (JSON store) | ✅ |
| Rate limiting server-side | ✅ |
| Safety fail-closed preserved | ✅ |
| No managed secret in extension | ✅ |
| Release bundle security | ✅ |
| npm test / build / build:release | ✅ |
| Live API tested | ❌ BLOCKED_EXTERNAL |
| Chrome manual E2E | ❌ NOT VERIFIED |
| Documentation updated | ✅ |
| PHASE17_REPORT.md | ✅ |
| No unresolved CODE defects | ✅ |

---

## Git status (end of phase)

Run at end of session:

```bash
git status -sb
git diff --stat
git branch
git remote -v
```

No commit or push performed (per user policy).
