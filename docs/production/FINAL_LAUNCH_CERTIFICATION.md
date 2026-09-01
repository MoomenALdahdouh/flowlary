# Flowlary Final Launch Certification

**Certification date:** 2026-08-28  
**Ops execution pass:** 2026-08-28 (Phase 0 baseline re-verified)  
**Release artifact:** `release/flowlary-v1.1.0.zip` (SHA-256: `432e9912189a38478d181d7c86934597de7d19bf6e9b7231bd4ded334a1362cc`)  
**Certification lead:** Final Launch Readiness Engineer (automated + repository audit)

---

## Engineering

**ENGINEERING_READY = YES**

In-repository engineering work is complete. No regressions detected in this certification pass.

---

## Automated tests

| Suite | Result | Evidence |
|-------|--------|----------|
| Shared | **126 / 126 PASS** | `npm run test -w @flowlary/shared` (2026-08-28) |
| Backend | **101 / 101 PASS** | Includes `groqClient.test.ts`, layout + entitlement gateway tests |
| Extension | **1093 PASS, 2 SKIPPED** | Re-verified 2026-08-28 (`npx vitest run`) |
| Website | **120 / 120 PASS** | `npm run test -w @flowlary/website` (2026-08-28) |

---

## Release artifact

| Item | Status | Evidence |
|------|--------|----------|
| Extension build | **PASS** | `npm run build:release -w @flowlary/extension` (2026-08-28) |
| Website build | **PASS** | `npm run build -w @flowlary/website` (2026-08-28) |
| Release ZIP | **PASS** | `release/flowlary-v1.1.0.zip`; package validation OK |
| Manifest version | **1.1.0** | `extension/dist/manifest.json` |
| host_permissions | **`https://api.flowlary.com/*` only** | `phase23-security.test.ts` PASS |
| No localhost in bundle | **PASS** | `extension/dist` scan clean (2026-08-28) |
| No debug ingest | **PASS** | No `127.0.0.1:7790` in release dist |
| Icons | **Present** | 16/32/48/128 PNG in ZIP |
| CWS listing copy | **READY (draft)** | `docs/release/CHROME_WEB_STORE_DESCRIPTION.md` |
| Privacy copy | **READY (draft)** | `docs/release/CHROME_WEB_STORE_PRIVACY.md` |

---

## AI production

| Check | Status | Evidence |
|-------|--------|----------|
| Groq config (repo) | **ENGINEERING_READY** | `GROQ_API_KEY` via `backend/src/config/env.ts`; server-only |
| Groq config (production) | **BLOCKED_EXTERNAL** | `curl https://api.flowlary.com/health` → DNS unresolved (2026-08-28) |
| Groq config (local dev) | **configured** | `backend/.env` has `GROQ_API_KEY` set (value not disclosed) |
| Real correction | **VERIFIED (local staging)** | `node scripts/verify-live-api.mjs` — all checks VERIFIED (2026-08-28) |
| Real translation | **VERIFIED (local staging)** | Same script |
| Layout classification | **VERIFIED (local staging)** | Fixed `include_reasoning` bug; verify reports `kind=LAYOUT_MISMATCH` |
| Entitlement denial | **VERIFIED (local staging)** | Install-only token → HTTP 403 `AI_ENTITLEMENT_DENIED` with `FLOWLARY_ENV=staging` |
| Credits | **TESTS PASSING** | `phase28-monetization-e2e.test.ts` |
| Failure recovery | **ENGINEERING_READY** | `AiErrorRecovery.tsx`, `mapProviderFailure` |
| Exhaustion vs failure | **TESTS PASSING** | `AI_USAGE_EXHAUSTED` ≠ `AI_TEMPORARILY_UNAVAILABLE` |
| No key in extension | **VERIFIED** | `phase23-security.test.ts` |

**AI production overall:** **BLOCKED_EXTERNAL** for live `api.flowlary.com` only — local staging Groq path **VERIFIED**

### Pre-ops blocker investigation (2026-08-28)

| Signal | Classification | Root cause | Resolution |
|--------|----------------|------------|------------|
| Layout HTTP 503 | **READY** (engineering defect, fixed) | `groqClient.ts` sent `include_reasoning: false` to `allam-2-7b`, which Groq rejects with HTTP 400 → mapped to `AI_UNAVAILABLE` 503 | Only set `include_reasoning` for `gpt-oss` models (`groqModelSupportsIncludeReasoning`) |
| Entitlement denial HTTP 200 | **READY** (not a security bug) | `verify-live-api.mjs` used port 8787 (stale dev server with `FLOWLARY_ENV=development`, which disables auth) | Script now uses dedicated port `8791` + `FLOWLARY_ENV=staging`; denial returns 403 as designed |

Regression tests: `tests/unit/backend/groqClient.test.ts`, `tests/integration/phase16-ai-gateway.test.ts` (layout + install-only denial)

Detail: `docs/production/AI_PRODUCTION_CHECKLIST.md`

---

## Chrome Web Store

| Item | Status |
|------|--------|
| Package | **READY** — `release/flowlary-v1.1.0.zip` built and validated |
| Submission | **EXTERNAL_OPS_REQUIRED** — upload to Chrome Web Store Developer Dashboard |
| Approval | **BLOCKED_EXTERNAL** — pending Google review |
| Live URL | **BLOCKED_EXTERNAL** — `CHROME_WEB_STORE_URL = null` in `website/src/config.ts` |
| Installation | **BLOCKED_EXTERNAL** — cannot install from CWS until approved |
| Get Flowlary CTA | **FALLBACK** — routes to `/support#get-flowlary` until URL set |

**CWS_STATUS:** PACKAGE_READY · SUBMISSION_PENDING · APPROVAL_PENDING  
**CWS_URL:** not set (awaiting real listing URL)  
**VERIFICATION_STATUS:** not started

### Pre-submission checklist (owner)

1. Upload `release/flowlary-v1.1.0.zip` to CWS.
2. Use listing copy from `docs/release/CHROME_WEB_STORE_DESCRIPTION.md`.
3. Attach privacy policy from `docs/release/CHROME_WEB_STORE_PRIVACY.md`.
4. After approval, provide listing URL → set `CHROME_WEB_STORE_URL` in `website/src/config.ts`.
5. Verify Get Flowlary opens store (not support fallback).
6. Install from CWS (not unpacked) for final smoke test.

---

## DNS/TLS

| Check | Status | Evidence |
|-------|--------|----------|
| Website `https://flowlary.com` | **BLOCKED_EXTERNAL** | `curl -sSI https://flowlary.com` → Could not resolve host (2026-08-28) |
| API `https://api.flowlary.com/health` | **BLOCKED_EXTERNAL** | `curl -sS https://api.flowlary.com/health` → Could not resolve host |
| TLS certificate | **BLOCKED_EXTERNAL** | Cannot verify without DNS |
| CORS | **BLOCKED_EXTERNAL** | Requires live API |
| `FLOWLARY_WEB_ORIGIN` | **configured (local)** | `backend/.env` — value not disclosed; must be `https://flowlary.com` in production |
| Email / reset URLs | **BLOCKED_EXTERNAL** | Depend on live `FLOWLARY_WEB_ORIGIN` + DNS |

### Owner verification (run when DNS is live)

```bash
curl -sS https://api.flowlary.com/health
# Expect: {"ok":true,"service":"flowlary-ai-gateway","groqConfigured":true,...}

curl -sSI https://flowlary.com
# Expect: HTTP/2 200, valid TLS
```

---

## Paddle

| Item | Status | Evidence |
|------|--------|----------|
| Sandbox | **BLOCKED_EXTERNAL** | `PADDLE_API_KEY`, `PADDLE_CLIENT_TOKEN`, `PADDLE_WEBHOOK_SECRET` missing from `backend/.env` |
| Sandbox price IDs | **configured (local)** | `PADDLE_PRICE_ID_PRO`, `PADDLE_PRICE_ID_PRO_YEARLY` present |
| `npm run test:wl13b` | **BLOCKED_EXTERNAL** | API not running; Paddle secrets missing (2026-08-28) |
| Production | **BLOCKED_EXTERNAL** | No production credentials |
| Webhook | **ENGINEERING_READY** | `billing/webhook.ts` + signature tests |
| Checkout | **ENGINEERING_READY** | `website/src/account/billing.ts` |
| Entitlement | **TESTS PASSING** | `phase20-billing.test.ts` |
| Extension sync (force) | **ENGINEERING_READY** | Checkout poll → `syncStoredSessionToExtension({ force: true })` |

**Checkout force-sync path (code-verified, no TTL wait):**

```
Paddle webhook → entitlement in store
→ website ?checkout=complete poll
→ syncStoredSessionToExtension({ force: true })
→ ACCOUNT_IMPORT_SESSION
→ syncServerEntitlement()
```

---

## Manual QA

| Item | Status |
|------|--------|
| 40-step journey matrix | **MANUAL_QA_REQUIRED** — not executed in this session |
| First-win ≤60s | **MANUAL_QA_REQUIRED** — not measured |
| Real browser E2E | **MANUAL_QA_REQUIRED** |
| CWS installation | **BLOCKED_EXTERNAL** |

### 40-step matrix status (authoritative: `JOURNEY_QA_MATRIX.md`)

| Step | Topic | Status |
|------|-------|--------|
| 1 | Homepage clarity | MANUAL_QA_REQUIRED |
| 2 | Writing Lab | MANUAL_QA_REQUIRED |
| 3 | Playground | MANUAL_QA_REQUIRED |
| 4 | Get Flowlary CTA | BLOCKED_EXTERNAL (no CWS URL) |
| 5 | CWS installation | BLOCKED_EXTERNAL |
| 6–11 | First win, shortcuts, Speed Box | MANUAL_QA_REQUIRED |
| 12–13 | Register, email verify | MANUAL_QA_REQUIRED / wl13b when configured |
| 14–38 | Onboarding, AI, learning, billing UX | MANUAL_QA_REQUIRED |
| 32–34 | Paddle checkout, Pro, portal | BLOCKED_EXTERNAL (Paddle sandbox/production) |
| 39 | Account isolation | TESTS PASSING (automated); MANUAL_QA_REQUIRED for browser sign-off |
| 40 | Reinstall + Pro restore | MANUAL_QA_REQUIRED |

---

## Security

| Check | Status | Evidence |
|-------|--------|----------|
| Authentication | **TESTS PASSING** | Install-only → 403 on protected AI when auth enabled (`phase16-ai-gateway.test.ts`) |
| Password reset | **TESTS PASSING** | `password-reset.test.ts` — expiry, single-use, rate limit, session revoke |
| Webhook signature | **TESTS PASSING** | `phase20-billing.test.ts` |
| Secrets in extension | **VERIFIED** | Release dist scan PASS |
| Secrets in website | **TESTS PASSING** | `website/src/__tests__/security.test.ts` |
| Debug scan | **VERIFIED** | `phase23-security.test.ts` |
| Account isolation | **TESTS PASSING** | `phase32a-account-isolation.test.ts` |
| HTTPS (production) | **BLOCKED_EXTERNAL** | DNS not live |
| CORS (production) | **BLOCKED_EXTERNAL** | API not live |
| Test route in prod | **ENGINEERING_READY** | `POST /__test/reset` gated on `config.env === 'test'` only |

---

---

## Soft launch certification gates (2026-08-28)

| Gate | Status |
|------|--------|
| Production DNS works | **BLOCKED_EXTERNAL** — `curl` Could not resolve host (2026-08-28) |
| Production TLS valid | **BLOCKED_EXTERNAL** |
| Production API deployed | **BLOCKED_EXTERNAL** |
| `/health` verified | **BLOCKED_EXTERNAL** |
| Production Groq verified | **BLOCKED_EXTERNAL** — local staging only (`verify-live-api.mjs` all VERIFIED) |
| Correction verified (prod) | **BLOCKED_EXTERNAL** |
| Translation verified (prod) | **BLOCKED_EXTERNAL** |
| Layout verified (prod) | **BLOCKED_EXTERNAL** |
| Entitlement denial verified (prod) | **BLOCKED_EXTERNAL** |
| Production security scan clean | **VERIFIED** — `phase23-security.test.ts` 2026-08-28 |
| Paddle sandbox verified | **BLOCKED_EXTERNAL** — secrets missing; `test:wl13b` not run |
| Paddle production verified | **BLOCKED_EXTERNAL** |
| CWS listing approved | **BLOCKED_EXTERNAL** |
| CWS URL configured | **BLOCKED_EXTERNAL** — `CHROME_WEB_STORE_URL = null` |
| CWS installation verified | **BLOCKED_EXTERNAL** |
| 40-step QA completed | **MANUAL_QA_REQUIRED** — not started |
| First-win ≤60s measured | **MANUAL_QA_REQUIRED** — not measured |
| AI failure/retry behavior verified | **MANUAL_QA_REQUIRED** |
| Credit exhaustion verified (browser) | **MANUAL_QA_REQUIRED** |
| Account isolation verified (browser) | **MANUAL_QA_REQUIRED** (automated tests pass) |
| Reinstall + Pro restoration verified | **MANUAL_QA_REQUIRED** |

**Gates satisfied:** 2 / 21 (engineering + local security/AI staging only)

---

## 40-step journey QA matrix

**Status:** NOT STARTED — requires live DNS, CWS, Paddle, and browser execution per [JOURNEY_QA_MATRIX.md](./JOURNEY_QA_MATRIX.md).

| Blocked until external ops | Steps |
|----------------------------|-------|
| CWS | 4, 5 |
| Paddle | 32, 33, 34 |
| Manual browser | 1–3, 6–31, 35–40 |

---

## Remaining blockers

1. **Production DNS/TLS** — `flowlary.com` and `api.flowlary.com` not resolving (verified 2026-08-28).
2. **Chrome Web Store** — extension not submitted/approved; `CHROME_WEB_STORE_URL` unset.
3. **Paddle sandbox** — API credentials and webhook not configured locally; `test:wl13b` cannot run.
4. **Paddle production** — not configured or verified.
5. **AI production** — production API unreachable; local Groq verify only.
6. **Manual 40-step QA** — not executed.
7. **First-win ≤60s** — not measured on Gmail/Notion.
8. **CWS install smoke** — blocked until store listing live.

---

## Accepted risks

1. Password reset token in URL (HTTPS + 1h TTL + single use + session revocation).
2. First-win is install-scoped, not account-scoped.
3. Usage UX v1 localized for **English + Arabic** only.
4. Popup-only passive entitlement reopen may use TTL (checkout uses force sync).
5. Manual 40-step QA not automated in CI.
6. Root `typecheck` has pre-existing extension test-import noise.

---

## FINAL VERDICT

# NOT READY

**ENGINEERING:** READY (unchanged — Phase 0 re-verified 2026-08-28)  
**SOFT LAUNCH:** Not eligible — 0 of 21 external/manual gates satisfied  
**CONSUMER LAUNCH:** Not eligible

Flowlary cannot advance to **READY FOR SOFT LAUNCH** until production DNS/TLS, deployed API with production Groq verification, and at minimum CWS + manual core journey QA are complete.

---

## Owner actions (next ops phase)

1. **DNS** — Point `flowlary.com` and `api.flowlary.com` to production hosts (see [PRODUCTION_DEPLOYMENT.md](./PRODUCTION_DEPLOYMENT.md)).
2. **Deploy API** — Set production env vars (`FLOWLARY_ENV=production`, `GROQ_API_KEY`, JWT/auth secrets, `FLOWLARY_WEB_ORIGIN`, CORS).
3. **Verify** — `curl -sS https://api.flowlary.com/health` then `FLOWLARY_API_BASE=https://api.flowlary.com node scripts/verify-live-api.mjs`.
4. **Deploy website** — `npm run build -w @flowlary/website` to `flowlary.com`.
5. **Paddle sandbox** — Provide `PADDLE_API_KEY`, `PADDLE_CLIENT_TOKEN`, `PADDLE_WEBHOOK_SECRET`; configure webhook; run `npm run test:wl13b`.
6. **CWS** — Upload `release/flowlary-v1.1.0.zip`; after approval provide listing URL for `CHROME_WEB_STORE_URL`.
7. **Manual QA** — Execute 40-step matrix + first-win timing on Gmail/Notion from CWS install.

---

## Related documents

- `docs/production/PRODUCTION_DEPLOYMENT.md`

- `docs/production/OPS_LAUNCH_CHECKLIST.md`
- `docs/production/JOURNEY_QA_MATRIX.md`
- `docs/production/RELEASE_READINESS.md`
- `docs/production/AI_PRODUCTION_CHECKLIST.md`
- `docs/audit/POST_IMPLEMENTATION_FORENSIC_AUDIT.md`
