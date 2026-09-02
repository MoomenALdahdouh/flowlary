# Flowlary Phase 5A — Dashboard / CORS report

**Date:** 2026-09-02  
**Git HEAD (repo):** `21cee1a` (`v1.1.0`)  
**Production overlay:** in-place update of `/var/www/flowlary/releases/21cee1a5ddec9cf0eb8b3b15983933a383ff49f2` (API `cors.ts` + `website/dist`). Working tree is **not** a new tagged release.

## 14. DASHBOARD / CORS ROOT CAUSE

Authenticated `/account/` Overview issued `GET /api/learning/{events,profile,practice-sessions}` with `Authorization` **and** `X-Flowlary-Client`. Browser CORS preflight therefore required `X-Flowlary-Client` on `Access-Control-Allow-Headers`. Production CORS (v1.1.0) allowed only `Authorization, Content-Type, X-Flowlary-Install-Id, X-Flowlary-Entitlement` and methods `GET, POST, OPTIONS`.

The preflight completed as HTTP 204 with an **incomplete** allow-list. The browser blocked the request. `useWebLearningBundle` never finished, and Overview treated missing bundle as perpetual loading (`if (loading || !bundle) skeleton`).

GET learning endpoints do **not** need `X-Flowlary-Client`. POST ingest / PUT sync do (website event validation and writes). `X-Flowlary-Surface` is an alternate website marker on ingest.

This is independent of the extension translation pipeline.

## 15. WEBSITE FILES CHANGED

- `website/src/account/learningEventsClient.ts` — GET: `Authorization` only; POST ingest: `X-Flowlary-Client` + `X-Flowlary-Surface`
- `website/src/account/learningSyncClient.ts` — GET: bearer only; PUT: client+surface; 401 vs network distinguished
- `website/src/dashboard/services/learningData.ts` — local fallback; no PUT overwrite when remote GET failed; auth fails closed
- `website/src/dashboard/useWebLearningBundle.ts` — always ends loading; `error` for auth/degraded
- `website/src/dashboard/DashboardApp.tsx` — Account/Settings ignore learning load; Overview error/retry; no infinite skeleton
- Tests: `learningEventsClient.test.ts`, `learningSyncClient.test.ts`, `learningData.test.ts`, `DashboardApp.test.tsx`

Built artifact: `website/dist/assets/index-Cv1lLMDZ.js` (served `200` on `https://flowlary.com/assets/index-Cv1lLMDZ.js`).

## 16. API FILES CHANGED

- `backend/src/middleware/cors.ts` — methods `GET, POST, PUT, DELETE, OPTIONS`; headers add `X-Flowlary-Client`, `X-Flowlary-Surface`; origins still explicit (`https://flowlary.com`, `https://www.flowlary.com`); **no wildcard**; **no** `Access-Control-Allow-Credentials` (Bearer, not cookies)
- `tests/unit/backend/cors.test.ts`

No nginx, ZAIXOS, provider, or entitlement changes.

## 17. CORS POLICY BEFORE / AFTER

| | Before (live v1.1.0) | After |
|---|---|---|
| Origins | `https://flowlary.com`, `https://www.flowlary.com` | unchanged |
| Methods | `GET, POST, OPTIONS` | `GET, POST, PUT, DELETE, OPTIONS` |
| Headers | Authorization, Content-Type, X-Flowlary-Install-Id, X-Flowlary-Entitlement | same **plus** `X-Flowlary-Client`, `X-Flowlary-Surface` |
| Disallowed origin | OPTIONS 403, no ACAO | unchanged |
| Wildcard | none | none |

## 18. DASHBOARD FALLBACK BEHAVIOR

- Remote GETs succeed → render remote bundle.
- Network failure → local empty/local store, `degraded`; Overview shows retry **and** workspace (does not look like a successful empty remote).
- 401 on learning GETs → **no** empty-success bundle; learning sections show error/retry. Account/Settings still render.
- Failed remote GET does **not** PUT local data over unknown remote.

## 19. DASHBOARD TEST RESULTS

- Backend CORS unit: **8 passed**
- Website `vitest`: **155 passed** (24 files), including header, 401, fallback, Account/Settings vs skeleton, Overview error/retry

## 20. PRODUCTION DASHBOARD BROWSER RESULT

Headed Chromium against `https://flowlary.com/account/?mode=register` then `/account/`:

| Check | Result |
|---|---|
| Register | PASS (`POST /api/auth/register` 200) |
| Dashboard shell | PASS (`.wd-shell`) |
| Overview | PASS (“Your Flowlary workspace”) |
| Infinite skeleton | PASS (cleared) |
| Console CORS/preflight | **0** matches |
| GET `/api/learning/events` | 200 |
| GET `/api/learning/profile` | 200 |
| GET `/api/learning/practice-sessions` | 200 |
| PUT profile + practice-sessions | 200 |
| Account panel | PASS |
| Settings | PASS |

Residual: minified React **#418** hydration warning on prerendered `/account/` (not CORS; not treated as this fix).

Deliberate learning-outage UI was covered by unit tests, not by disabling production API.

## 21. PRODUCTION API CORS RESULT

Post-restart `OPTIONS` to `https://api.flowlary.com`:

- Origin `https://flowlary.com` / `https://www.flowlary.com` → **204**, ACAO echoes origin, methods include PUT/DELETE, headers include Client/Surface
- `Origin: https://evil.example` → **403**
- `/health` **200**
- `169.58.11.99:9087` not reachable from the public internet (timeout)
- API still `127.0.0.1:9087`; ZAIXOS `127.0.0.1:8100` still listening

## 22. TRANSLATION + DASHBOARD RELEASE CONSISTENCY

Dashboard/CORS is deployed and verified.

**Translation live path is not proven** in this pass (no content-script policy instrumentation, no `TRANSLATE_TEXT` / `POST /api/ai/translation` / Write Gate / DOM). Dashboard loading is not used to hydrate FieldSession or translation policy.

## 23. DEPLOYED RELEASE/TAG

- Tag still **v1.1.0** / SHA `21cee1a5ddec9cf0eb8b3b15983933a383ff49f2`
- Overlay: `backend/src/middleware/cors.ts` + `website/dist/` in that release directory
- `flowlary-api` restarted via SIGTERM; Supervisor autorestart (new node pid)
- **No** new git tag; local repo still has uncommitted source matching the overlay

## 24. ROLLBACK CONSIDERATIONS

1. Restore `cors.ts` from git `21cee1a` into the release backend and SIGTERM `flowlary-api`.
2. Restore previous `website/dist` from backup if kept; otherwise rebuild `v1.1.0` website.
3. Do not revert ZAIXOS or nginx.
4. After CORS rollback, Overview GETs without `X-Flowlary-Client` would still work; PUT ingest would fail preflight again.

---

## FINAL VERDICT

**Dashboard / CORS:** PASS against production (`flowlary.com` + `api.flowlary.com`).

**Translation production E2E:** NOT PROVEN.

**Combined “PASS — PRODUCTION READY”:** **NO** — dashboard class B is met; translation class A is not; safety isolation (9087 bind, ZAIXOS 8100, no wildcard CORS) remains intact.
