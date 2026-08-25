# Flowlary Production Readiness Audit

**Date:** 2026-08-25  
**Repository:** `/Users/moomen/Projects/flowlary`  
**Branch:** `main` (1 commit ahead of origin — Phase 16 AI gateway)  
**Baseline tests:** **470 / 470** passing (shared: 5, extension: 465, backend gateway: included in root test script)

---

## Executive summary

Flowlary is a **solid local/unpacked Chrome extension** with unified architecture (one content script, InputEngine, FieldSession, three feature modules). Phase 16 added a **local AI gateway** and managed-correction path.

It is **NOT production-ready** for paid users or Chrome Web Store release.

**Honest classification:** **C — Beta / local-ready, production blockers remain**

---

## Important: stated vs actual product surface

Some external briefs reference **Control Center, Writing Lab, Translation workspace, Type workspace, Insights, Account, Arabic UI, onboarding, 510 tests**, and `docs/uiux/FLOWLARY_UIUX_FINAL_AUDIT.md`.

**Actual repository state (verified by inspection):**

| Claimed surface | Actual state |
|-----------------|--------------|
| Control Center / Writing Lab / Insights / Account pages | **Not present** — popup has `home`, `settings`, `history` only |
| Arabic UI / RTL | **Not present** — English-only popup strings |
| Onboarding | **Not present** |
| UI/UX final audit doc | **Not found** in repo |
| 510 extension tests | **470** total tests in CI script |
| Payment / checkout | **Not implemented** |
| License activation | **`ACTIVATE_LICENSE` → `not_implemented`** |
| Server-verified entitlement | **Client-only** |

This audit uses **actual code** as source of truth.

---

## Already completed (verified)

### Architecture (Phases 1–14)

- [x] ONE MV3 extension, ONE content script, ONE InputEngine
- [x] FieldSession mutex, generation stale protection, WriteOrigin
- [x] Safety gate (password, OTP, tokens, code editors, domains)
- [x] Correction, translation, layout feature modules (separate contracts)
- [x] CorrectionCard UI, debounce, merge, English gate
- [x] Manual + live translation (live default OFF)
- [x] Layout local-first + AI classifier fallback
- [x] Speed Box, 13 layouts, personal exceptions
- [x] Unified history (50 entries, privacy-gated)
- [x] Tiered cache with operation isolation
- [x] Storage migration (Phase 10)
- [x] Security hardening (Phase 13)
- [x] Release packaging (Phase 15 ZIP + prod manifest)

### Phase 16 — AI Gateway (local)

- [x] `@flowlary/backend` Node HTTP gateway on `:8787`
- [x] Separate providers: correction, translation, layout classification
- [x] Centralized models (`llama-3.1-8b-instant`, `openai/gpt-oss-120b`, `allam-2-7b`)
- [x] Managed Groq on server; BYOK correction opt-in
- [x] Install-token auth boundary
- [x] Rate limits, timeouts, normalized errors, usage metadata (in-memory)
- [x] Unified `FLOWLARY_API_BASE`; release manifest HTTPS-only (no localhost)
- [x] Legacy route aliases preserved

### Automated quality

- [x] `npm test` — 470 passing
- [x] `npm run build` / `build:release` — passing
- [x] No API keys in release `dist/` (Phase 14/15 checks)

---

## Remaining blockers (priority order)

### P0 — Must fix before production

| Blocker | Status | Notes |
|---------|--------|-------|
| Production API deployed + verified | ⚠️ NOT VERIFIED | `flowlary-api.zaixos.com` not tested live from this session |
| Live Groq through gateway | ⚠️ Pending local verify | Requires `GROQ_API_KEY` in `backend/.env` only |
| Server-verified entitlement | ❌ Missing | Client storage only; engines largely ungated |
| License activation | ❌ `not_implemented` | `ACTIVATE_LICENSE` stub |
| Payment / checkout | ❌ Missing | No Paddle/Stripe/ZAIXOS integration in repo |
| Account authentication | ❌ Missing | Install token only; no user accounts |
| Privacy policy URL | ❌ Missing | Store blocker (Phase 15) |
| Support URL / email | ❌ Missing | Store blocker |
| Chrome manual E2E | ⚠️ NOT VERIFIED | No automation in CI |

### P1 — Product completeness

| Item | Status |
|------|--------|
| Onboarding first-run | ❌ Not implemented |
| Arabic UI + RTL | ❌ Not implemented |
| Control Center / multi-surface UX | ❌ Not implemented (popup-only) |
| Account page (plan, usage, billing) | ❌ Minimal entitlement in status only |
| History export/import/filter/search | ❌ Basic list + delete/clear only |
| Insights from real data | ❌ Not present |
| CORS policy for production API | ⚠️ Not configured (extension uses fetch from SW) |

### P2 — Release polish

| Item | Status |
|------|--------|
| Store screenshots / promo tile | ❌ Missing |
| Terms of service | ❌ Missing |
| Herd/local dev documentation | ⚠️ Partial (`npm run dev:api`) |
| Persistent usage DB | ❌ In-memory only |
| Account JWT replacing install token | ❌ Future phase |

---

## Phase-by-phase assessment

### Phase A — Production AI architecture

| Requirement | Status |
|-------------|--------|
| Separate AI contracts | ✅ VERIFIED |
| Centralized gateway | ✅ Implemented (local) |
| No server secrets in extension | ✅ VERIFIED |
| BYOK documented + opt-in | ✅ VERIFIED |
| Managed correction default | ✅ VERIFIED |
| HTTPS production domains | ✅ Configured in release build |
| Auth, rate limits, errors | ✅ Gateway implemented |
| Production deployment | ⚠️ NOT VERIFIED |

**Correction provider decision (documented):** Default **managed** via Flowlary API; **BYOK** remains explicit opt-in for users who prefer their own Groq key. BYOK bypasses server for correction only.

### Phase B — Entitlement system

| Requirement | Status |
|-------------|--------|
| Central `canUseFeature()` service | ❌ **In progress this session** |
| Engines gated consistently | ❌ Scattered / mostly open |
| Fail closed for premium | ❌ Not enforced |
| UI + engine same source | ⚠️ Partial (`GET_STATUS` only) |

Existing: `extension/src/storage/entitlement.ts` — trial/free/pro client model, usage balance, license cache (unverified).

### Phase C — Account / license

| Requirement | Status |
|-------------|--------|
| License activation | ❌ `not_implemented` |
| Plan / trial / usage UI | ⚠️ Partial in popup settings |
| Refresh entitlement | ❌ No server sync |
| No secrets in GET_STATUS | ✅ VERIFIED |

### Phase D — Payment / checkout

| Requirement | Status |
|-------------|--------|
| Payment provider integration | ❌ Not in repo |
| Checkout flow | ❌ Not in repo |
| Backend payment truth | ❌ Not in repo |

**Do not fake payments.**

### Phases E–G — Onboarding, i18n, UX completion

| Area | Status |
|------|--------|
| Onboarding | ❌ |
| English + Arabic UI | English only |
| RTL | ❌ |
| Unified product UX beyond popup | ❌ |
| API failure / billing unavailable UX | ⚠️ Partial |

### Phases H–K — Feature experiences

| Feature | Automated tests | Manual E2E |
|---------|-----------------|------------|
| Correction | ✅ Phase 7–8 tests | ⚠️ NOT VERIFIED |
| Translation | ✅ Phase 5–6 tests | ⚠️ NOT VERIFIED |
| Layout / Speed Box | ✅ Phase 4 tests | ⚠️ NOT VERIFIED |
| History | ✅ Phase 11 tests | ⚠️ Partial UI |
| Insights | N/A | ❌ Not built |

### Phase L — Security

| Check | Status |
|-------|--------|
| Safety gate | ✅ VERIFIED (tests) |
| Message validation | ✅ VERIFIED |
| CSP / prod manifest | ✅ VERIFIED |
| Client entitlement tampering | ⚠️ Known gap — no server verify |
| Secret non-exposure in builds | ✅ VERIFIED |
| `all_frames: true` | ✅ Documented (EWA iframe support) |

### Phase M — Production manifest

| Check | Status |
|-------|--------|
| `manifest.prod.json` no localhost | ✅ VERIFIED |
| Release build | ✅ VERIFIED |
| Icons, CSP, commands | ✅ VERIFIED |

### Phases N–Q — Dev workflow, API verify, E2E, performance

| Check | Status |
|-------|--------|
| Local API via `npm run dev:api` | ✅ Documented |
| Herd compatibility | ⚠️ Node backend — use `:8787`, not PHP/Laravel |
| Live API tests | ⚠️ Scheduled this session |
| Chrome E2E | ⚠️ NOT VERIFIED |
| Performance benchmarks | ⚠️ Not measured |

---

## Architecture risks

1. **Client-only entitlement** — users can tamper with `flowlary.entitlement` until server verification exists.
2. **Install-token auth** — interim; not a user account system.
3. **In-memory usage** — lost on server restart; not billing-grade.
4. **No production deploy pipeline** — gateway code exists but hosting unverified.
5. **UI scope mismatch** — risk of building duplicate surfaces if Control Center is planned separately.

## API risks

1. Production host may not yet serve Phase 16 routes.
2. `gpt-oss-120b` / `allam-2-7b` availability depends on Groq account/model access.
3. No circuit breaker beyond timeout + error normalization.

## Payment risks

No payment system — cannot sell Pro until Phase D completes with real provider credentials.

## Security note — exposed credential

A Groq API key was shared in chat during this session. **Rotate that key immediately** in the Groq console. Never commit keys; use `backend/.env` only (gitignored).

---

## Recommended implementation order

1. **Central EntitlementService** + fail-closed AI gating (this session)
2. **Live local API verification** (correction, translation, layout)
3. **License activation boundary** (honest unavailable until backend ready)
4. **Account UI** in popup (plan, trial, remaining — no fake data)
5. **Onboarding** (minimal first-run)
6. **i18n scaffold** (en + ar catalogs; translate UI incrementally)
7. **Payment provider** (when ZAIXOS/Paddle credentials available)
8. **Production deploy** + Chrome manual QA
9. **Store assets** + legal URLs

---

## Verdict

**NOT PRODUCTION READY**

Safe for **local unpacked testing** and continued development. Not ready for paid access, real users at scale, or Chrome Web Store submission.
