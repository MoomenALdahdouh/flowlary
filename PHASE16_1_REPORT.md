# Phase 16.1 Report — Production Domain + Runtime Verification

**Date:** 2026-08-25  
**Branch:** `main`  
**Status:** Code migration **COMPLETE** — production deployment **NOT VERIFIED**

## Executive summary

Active Flowlary production API configuration migrated from interim ZAIXOS hosts (`flowlary-api.zaixos.com`, `lingo-api.zaixos.com`) to the canonical product domain **`https://api.flowlary.com`**. Repository tests and release builds pass. DNS for `api.flowlary.com` does not resolve; live Groq verification blocked by missing local credentials.

---

## 1. Files inspected

| Area | Paths |
|------|-------|
| Extension config | `extension/src/config/endpoints.ts`, `auth.ts`, manifests |
| Extension AI runtime | `extension/src/background/correct.ts`, `translate.ts`, `classify.ts` |
| Backend | `backend/src/routes/http.ts`, `backend/src/middleware/cors.ts`, `backend/src/config/env.ts` |
| Tests | `tests/integration/phase16-1-domain.test.ts`, `phase15-release-manifest.test.ts`, `tests/unit/backend/cors.test.ts` |
| Docs (active) | `docs/production/*`, `docs/privacy/*`, `docs/security/*`, `docs/release/*`, `RELEASE_NOTES.md` |
| Build output | `extension/dist/` (release build) |
| Scripts | `scripts/verify-live-api.mjs` |

Historical phase reports (`PHASE15_REPORT.md`, `PHASE16_REPORT.md`, etc.) intentionally retain legacy domain references.

---

## 2. Active ZAIXOS API references found (pre-migration)

| Location | Classification | Action |
|----------|----------------|--------|
| `extension/src/config/endpoints.ts` | A — Active API | Migrated |
| `extension/manifest.prod.json` | A — Active API | Migrated |
| `extension/manifest.json` (prod host) | A — Active API | Migrated |
| `docs/privacy/PRIVACY.md` | B — Active docs | Migrated |
| `docs/privacy/DATA_FLOW.md` | B — Active docs | Migrated |
| `docs/security/SECURITY_ARCHITECTURE.md` | B — Active docs | Migrated |
| `docs/release/CHROME_WEB_STORE_PRIVACY.md` | B — Active docs | Migrated |
| `RELEASE_NOTES.md` | B — Active docs | Migrated |
| `docs/production/AI_*`, `LIVE_API_VERIFICATION.md` | B — Active docs | Migrated (prior session) |

---

## 3. References migrated

All **active** production API endpoints now use:

```
https://api.flowlary.com
```

Preserved API paths (unchanged contracts):

- `GET /health`
- `POST /api/auth/register`
- `POST /api/ai/correction`
- `POST /api/ai/translation`
- `POST /api/ai/layout-classification`

---

## 4. Intentional ZAIXOS references remaining

| Location | Classification | Reason |
|----------|----------------|--------|
| `docs/production/FLOWLARY_PRODUCTION_DOMAIN.md` | C — Company | Documents ZAIXOS as parent company + legacy deprecation |
| `PHASE15_REPORT.md`, `PHASE16_REPORT.md`, `PHASE1_REPORT.md`, `PHASE13_REPORT.md` | D — Historical | Phase snapshots — not rewritten |
| `docs/production/PHASE16_AI_GATEWAY_PLAN.md` (Architecture before) | D — Historical | Pre-implementation baseline table |
| `tests/integration/phase16-1-domain.test.ts` | F — Test fixture | Asserts absence of zaixos in prod manifest |

**Requirement met:** Zero **active** Flowlary production API references to ZAIXOS hosts.

---

## 5. Canonical API URL

| Environment | URL |
|-------------|-----|
| Production | `https://api.flowlary.com` |
| Development | `http://127.0.0.1:8787` |

Single source: `FLOWLARY_API_BASE` in `extension/src/config/endpoints.ts`  
Override: `VITE_FLOWLARY_API_URL` (dev/local only)

---

## 6. Environment variables

| Variable | Scope | Purpose |
|----------|-------|---------|
| `VITE_FLOWLARY_API_URL` | Extension (dev) | Override API base |
| `GROQ_API_KEY` | Backend server only | Managed AI (all three contracts) |
| `FLOWLARY_CORS_ORIGINS` | Backend server | Web CORS allowlist (default: flowlary.com + www) |

---

## 7. CORS status

**Implemented** in `backend/src/middleware/cors.ts`:

- Default origins: `https://flowlary.com`, `https://www.flowlary.com`
- No wildcard `*`
- Chrome extension uses manifest `host_permissions` (not browser CORS)
- OPTIONS preflight returns 204 for allowed origins, 403 otherwise
- Unit tests: `tests/unit/backend/cors.test.ts` (2 tests)

---

## 8. Groq architecture

```
Extension → api.flowlary.com → AI Gateway → Groq (GROQ_API_KEY)
Extension → api.groq.com (BYOK correction only, opt-in)
```

Three separate AI contracts preserved (correction, translation, layout classification).

---

## 9. Server-side Groq keys

**One** managed key: `GROQ_API_KEY` in `backend/src/config/env.ts`  
No separate hidden server keys found.

---

## 10. BYOK behavior

- Opt-in via `aiProvider: 'byok'` for correction only
- User Groq key stored locally (`flowlary.correction`)
- Calls `https://api.groq.com` directly from service worker
- Never sent to Flowlary API

---

## 11. Live Groq verification

**LIVE GROQ VERIFICATION = BLOCKED BY MISSING CREDENTIAL**

- `backend/.env` not present (no `GROQ_API_KEY`)
- Did not fabricate success
- Use `node scripts/verify-live-api.mjs` after adding key locally (never commit)

---

## 12. DNS verification

**DNS REQUIRED**

```
dig +short api.flowlary.com A   → (empty)
curl https://api.flowlary.com/health → connection failed
```

Legacy host `flowlary-api.zaixos.com` also unreachable at time of check.

---

## 13. Production API verification

**NOT VERIFIED** — blocked by DNS/deployment. Code references `api.flowlary.com` but no live endpoint responds.

---

## 14. npm test result

**481 / 481 PASS**

Includes new tests:

- `phase16-1-domain.test.ts` (2)
- `tests/unit/backend/cors.test.ts` (2)

---

## 15. Build result

`npm run build` — **PASS**

---

## 16. Release build result

`npm run build:release` — **PASS**

Release manifest host permissions:

- `https://api.flowlary.com/*`
- `https://api.groq.com/*` (BYOK only)

---

## 17. Dist security audit (release)

Searched `extension/dist/` for:

| Pattern | Result |
|---------|--------|
| `flowlary-api.zaixos.com` | **None** |
| `api.zaixos.com` / `lingo-api` | **None** |
| `GROQ_API_KEY` | **None** |
| `localhost` / `127.0.0.1` | **None** |
| `api.flowlary.com` | Present in manifest + bundled SW (expected) |

---

## 18. Git diff summary

**Modified (16 files):** manifests, endpoints, CORS wiring, active docs, release tests  
**Added:** `backend/src/middleware/cors.ts`, `docs/production/FLOWLARY_PRODUCTION_DOMAIN.md`, `tests/integration/phase16-1-domain.test.ts`, `tests/unit/backend/cors.test.ts`

**Not committed** (awaiting explicit request). Untracked duplicate `flowlary/` folder excluded.

---

## Final architecture

```
                 ZAIXOS
              Parent Company
                    │
                    ▼
                FLOWLARY
                 Product
                    │
          ┌─────────┴─────────┐
          ▼                   ▼
     flowlary.com      api.flowlary.com
                              │
                              ▼
                         AI Gateway
                              │
                              ▼
                             Groq
                    ┌─────────┼─────────┐
                    ▼         ▼         ▼
                Correct   Translate   Layout
```

**ONE MANAGED GROQ KEY · THREE AI CONTRACTS · ONE FLOWLARY API · ZERO MANAGED SERVER KEYS IN EXTENSION**

---

## Next steps (ops)

1. Create DNS A/AAAA for `api.flowlary.com`
2. Deploy `@flowlary/backend` with TLS + `GROQ_API_KEY`
3. Verify `GET /health` and run `scripts/verify-live-api.mjs`
4. Point `flowlary.com` website when ready

See [FLOWLARY_PRODUCTION_DOMAIN.md](./docs/production/FLOWLARY_PRODUCTION_DOMAIN.md).
