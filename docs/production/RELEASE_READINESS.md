# Flowlary — Release Readiness Certification

**Certification date:** 2026-08-28  
**Scope:** In-repository engineering gaps for consumer-launch certification (no new product features)  
**Verdict:** **ENGINEERING READY** for code/test/build artifacts · **NOT READY FOR CONSUMER LAUNCH** until external ops complete

---

## Status summary

| Category | Verdict | Notes |
|----------|---------|-------|
| **ENGINEERING READY** | **YES** | All in-repo test suites green; release build + package validated |
| **TESTS PASSING** | **YES** | See §Test matrix below |
| **TESTS ENVIRONMENTAL** | **RESOLVED** | Extension integration auto-starts test API; no longer requires manual `dev:api` |
| **EXTERNAL OPS BLOCKED** | **YES** | CWS listing, production Paddle, production DNS/TLS |
| **KNOWN ACCEPTED RISKS** | **DOCUMENTED** | Password reset URL token; v1 locales en+ar only for usage UX; manual 40-step QA |

**Do not claim consumer launch readiness** until Chrome Web Store install, Paddle production checkout, live DNS/TLS, and manual browser QA are verified.

---

## Test matrix (final run)

| Suite | Command | Result |
|-------|---------|--------|
| Shared | `npm run test -w @flowlary/shared` | **126 / 126 pass** |
| Backend | `npm run test -w @flowlary/backend` | **96 / 96 pass** |
| Extension (unit + integration) | `npm run test -w @flowlary/extension` | **1088 pass, 2 skipped** (wl13b live staging; requires `WL13B_LIVE_API=1`) |
| Website | `npm run test -w @flowlary/website` | **120 / 120 pass** |
| Extension release build | `npm run build:release -w @flowlary/extension` | **PASS** |
| Website build | `npm run build -w @flowlary/website` | **PASS** |
| Release package | `npm run package:release` | **PASS** — `release/flowlary-v1.1.0.zip`, no localhost in `host_permissions` |

### Engineering fixes applied (gap-closure pass)

1. **Website tests (2 failures → 0)** — Added `/account/forgot-password` and `/account/reset-password` routes; Arabic i18n catalog keys; reset page heading.
2. **Extension integration (75 failures → 0)** — Auto-start in-memory API (`tests/helpers/testApiServer.ts`, `extension/vitest.globalSetup.ts`); undici fetch routing for `writing-api.test`; `POST /__test/reset` for isolated datastore; sequential workers for stability.
3. **Extension unit (2 failures → 0)** — Removed stray debug agent-log fetch; fixed `learning.test.ts` account activation side effect.
4. **Release security scan** — Removed debug `127.0.0.1:7790` ingest from `ComposeWorkbench.tsx` and `backend/gateway/index.ts`; dev-only host checks gated with `import.meta.env.DEV`.
5. **Usage UX localization (v1)** — Launch locales explicitly **English + Arabic** (`USAGE_UX_LAUNCH_LOCALES`); other UI locales fall back to English for usage card copy.
6. **Password reset hardening** — Session revocation, rate limits, single-use token tests.
7. **First-win / commands** — Lifecycle unit tests; `runCommandOnActiveTab` handler-ack gating; phase22a chrome mock fix.
8. **Integration test drift** — Updated obsolete assertions (dashboard brand, report title, manifest content_scripts count).

---

## Dimension scores

| Dimension | Verdict | Rationale |
|-----------|---------|-----------|
| First Win | **PARTIAL** | Code + unit tests READY; ≤60s manual metric not automated |
| Onboarding | **READY** | 2-step wizard, deferred until first win |
| UX consistency | **PARTIAL** | Popup/dashboard parity good; usage UX i18n en+ar only |
| AI reliability | **PARTIAL** | Retry/recovery added; live Groq not verified in production |
| Learning loop | **READY** | Events, progress, practice paths tested |
| Monetization | **PARTIAL** | Code paths ready; Paddle production not verified |
| Localization | **PARTIAL** | **v1 launch locales: English + Arabic** for usage UX; card strings en+ar; other locales partial |
| Security | **PARTIAL** | Password reset hardened; URL-token trade-off retained |
| CWS | **BLOCKED_EXTERNAL** | `CHROME_WEB_STORE_URL = null` |
| Paddle | **BLOCKED_EXTERNAL** | Sandbox code ready; production credentials not in repo |
| Production DNS | **BLOCKED_EXTERNAL** | `api.flowlary.com` / `flowlary.com` not verified live |
| E2E | **PARTIAL** | Automated suites green; 40-step manual matrix not executed |

---

## EXTERNAL OPS BLOCKED

| Item | Owner action |
|------|--------------|
| Chrome Web Store | Publish extension; set `CHROME_WEB_STORE_URL` in `website/src/config.ts` |
| Production DNS/TLS | A/AAAA + certificates for `flowlary.com`, `api.flowlary.com` |
| Paddle production | Products, prices, webhook secret, live checkout |
| Paddle sandbox E2E | `npm run test:wl13b` with local `.env` |
| Manual journey QA | Execute `docs/production/JOURNEY_QA_MATRIX.md` in browser |

See also: `docs/production/OPS_LAUNCH_CHECKLIST.md`

---

## Password reset security audit

| Control | Status | Implementation |
|---------|--------|----------------|
| Token expiration | **OK** | `RESET_TOKEN_TTL_MS = 1 hour` (`passwordResetService.ts`) |
| Single use | **OK** | `clearPasswordReset()` after successful reset; tested |
| HTTPS requirement | **OK** | Reset links use `config.webOrigin` (production: `https://flowlary.com`); token only sent over TLS in production |
| Session revocation | **OK** | `deleteSessionsForAccount()` on successful reset |
| Rate limiting | **OK** | `enforceAuthRouteRateLimit` on forgot/reset routes; per-email cooldown `RESET_COOLDOWN_MS = 60s` |
| No enumeration | **OK** | Forgot-password returns success regardless of email existence |
| Analytics/log leakage | **OK** | No token logged; email masked in outbound mail |
| **URL token trade-off** | **ACCEPTED** | Token in query string (`/account/reset-password?token=…`) enables email deep-link UX. Mitigated by 1h TTL, single use, HTTPS, and session revocation. Alternative (post-only token entry) deferred. |

Tests: `tests/integration/password-reset.test.ts`

---

## Billing → entitlement → extension sync

Code path (no TTL wait on checkout):

1. Paddle webhook → `processVerifiedPaddleEvent` → account entitlement updated in store (`phase20-billing.test.ts`).
2. Website `?checkout=complete` → polls `loadWebAccount()` every 2.5s until `isPro` → `syncStoredSessionToExtension(account, { force: true })` (`Account.tsx`).
3. Extension `websiteBridge.ts` → `ACCOUNT_IMPORT_SESSION` with `force: true`.
4. Background `importWebAccountSession(..., { force: true })` → `syncServerEntitlement()` immediately (`accountAuth.ts`, `background/index.ts`).

Unit coverage: `tests/unit/account-auth-session.test.ts`, `tests/integration/phase20-billing.test.ts`, `tests/integration/phase28-monetization-e2e.test.ts`.

**Not verified in this pass:** live Paddle sandbox checkout (external credentials required).

---

## First-win state machine

States: `NEW` → `SHOWN` → `STARTED` → `COMPLETED` (install-scoped, `storage/ui/firstWin.ts`).

| Scenario | Coverage |
|----------|----------|
| Signed out | Unit: first-win gates popup (`firstWin.test.ts`) |
| Fresh install | Integration: `FirstWinView` before home (`phase9-popup.test.tsx`) |
| Popup reopen | Unit: persistence across reads (`firstWin-lifecycle.test.ts`) |
| Dismissal | Unit: skip path sets completed |
| Reload | Unit: local storage persistence |
| Account switch | Install-scoped by design — documented accepted risk |
| Reinstall | Clears local first-win — manual only |
| Keyboard shortcut | Unit: `runCommandOnActiveTab` requires `handlerExecuted` (`backgroundCommands.test.ts`) |

**Manual only:** ≤60s first-win timing on real Gmail/Notion.

---

## Speed Box & chrome.commands

| Check | Status |
|-------|--------|
| `SPEED_BOX` in manifest (dev + prod) | Verified |
| `chrome.commands.onCommand` → `runCommandOnActiveTab` | Verified (`background/index.ts`) |
| Handler ack before first-win complete | Verified (unit tests) |
| Speed Box toggle disables overlay | Manual (QA matrix #24) |

---

## QA matrix — engineering test coverage

Reference: `docs/production/JOURNEY_QA_MATRIX.md`

| Steps | Auto coverage |
|-------|---------------|
| 12–13 Account register/verify | `npm run test:wl13b` (when configured) |
| 39 Account switch isolation | `phase32a-account-isolation.test.ts`, `wl13b` |
| 33 Entitlement after Pro | `phase20-billing.test.ts`, `phase28-monetization-e2e.test.ts`, `account-auth-session.test.ts` (force sync path) |
| 35 Forgot password | `password-reset.test.ts`, website auth route tests |
| 6–8, 9–11, 14–38 | **Manual** — no Playwright harness |
| 1–5, 4 CWS install | **BLOCKED_EXTERNAL** |

---

## KNOWN ACCEPTED RISKS

1. **Password reset token in URL** — see §Password reset security audit.
2. **Usage UX i18n** — v1 launch locales are **en + ar only**; other locales show English usage copy.
3. **First-win install-scoped** — shared across accounts on same browser profile.
4. **Entitlement TTL on popup-only reopen** — checkout uses force sync; passive reopen may wait for cache TTL unless user triggers account sync.
5. **Root `npm run typecheck`** — pre-existing extension test-import `.ts` noise (not blocking tests).
6. **Manual 40-step QA** — not executed in CI.

---

## Commands

```bash
npm run test -w @flowlary/shared
npm run test -w @flowlary/backend
npm run test -w @flowlary/extension
npm run test -w @flowlary/website
npm run build:release -w @flowlary/extension
npm run build -w @flowlary/website
npm run package:release
npm run test:wl13b          # requires Paddle sandbox + Mailpit .env
```

---

## Final certification

| | |
|---|---|
| **ENGINEERING READY** | Yes — repository code, tests, and release artifacts |
| **CONSUMER LAUNCH READY** | **No** — CWS, Paddle production, DNS/TLS, manual browser QA outstanding |
