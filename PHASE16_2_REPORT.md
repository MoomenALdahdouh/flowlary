# Phase 16.2 Report — AI + Domain + Entitlement Hardening

**Date:** 2026-08-25  
**Branch:** `main`  
**Status:** Repository hardening **COMPLETE** — production deployment & live Groq **NOT VERIFIED**

---

## 1. Repository state

| Item | Value |
|------|-------|
| Path | `/Users/moomen/Projects/flowlary` |
| Branch | `main` (2 commits ahead of origin + uncommitted Phase 16.1/16.2 work) |
| Tests | **489 / 489 PASS** |
| Uncommitted | Phase 16.1 domain migration + Phase 16.2 entitlement hardening |
| Untracked duplicate | `flowlary/` (117MB nested copy — see §18) |

---

## 2. Domain migration

Active production API: **`https://api.flowlary.com`** via `FLOWLARY_API_BASE`.

| Environment | URL |
|-------------|-----|
| Production | `https://api.flowlary.com` |
| Development | `http://127.0.0.1:8787` |

Phase 16.1 migrated manifests, endpoints, active docs. Phase 16.2 verified zero active zaixos API references in tracked source (excluding historical reports and nested duplicate).

---

## 3. Active ZAIXOS API references

**Zero** in tracked active configuration.

| Location | Classification |
|----------|----------------|
| `PHASE15_REPORT.md`, `PHASE16_REPORT.md`, `PHASE1_REPORT.md` | Historical |
| `docs/production/FLOWLARY_PRODUCTION_DOMAIN.md` | Deprecation note |
| `flowlary/` (untracked nested duplicate) | Stale copy — pre-migration zaixos hosts |

---

## 4. Flowlary API references

All managed AI paths use `FLOWLARY_API_BASE`:

- `extension/src/background/correct.ts` → `/api/ai/correction`
- `extension/src/background/translate.ts` → `/api/ai/translation`
- `extension/src/background/classify.ts` → `/api/ai/layout-classification`
- `extension/src/config/auth.ts` → `/api/auth/register`

Deprecated aliases `TRANSLATION_API_BASE` / `LAYOUT_API_BASE` delegate to `FLOWLARY_API_BASE`.

---

## 5. Groq architecture

```
Extension → api.flowlary.com → AI Gateway → GROQ_API_KEY → Groq
Extension → api.groq.com (BYOK correction only, opt-in)
```

| Contract | Model | Path |
|----------|-------|------|
| Correction | `llama-3.1-8b-instant` | Managed via gateway |
| Translation | `openai/gpt-oss-120b` | Managed via gateway |
| Layout | `allam-2-7b` | Managed via gateway |

Legacy routes preserved: `/api/translate`, `/api/analyze-word`.

---

## 6. Number of managed server keys

**One:** `GROQ_API_KEY` in `backend/src/config/env.ts`.

No hidden separate keys found.

---

## 7. BYOK behavior

- Opt-in only (`aiProvider: 'byok'`)
- Correction only
- User key in `flowlary.correction` (local)
- Direct `api.groq.com` from service worker
- **Bypasses** managed entitlement gate (by design)
- Never sent to Flowlary API

---

## 8. Entitlement enforcement (client)

Central `EntitlementService` gates managed AI:

| Feature | Gated | File |
|---------|-------|------|
| Correction (managed) | ✅ | `background/correct.ts` |
| Translation | ✅ | `background/translate.ts` |
| Live translation | ✅ | `background/translate.ts` (`live_translation`) |
| Layout AI | ✅ | `background/classify.ts` |
| Layout auto (local) | ❌ exempt | `isLocalOnlyFeature` |

Policy (`packages/shared/src/entitlement/`):

- Unknown plan → **DENY**
- Free usage exhausted → **DENY**
- Valid free/trial/pro → **ALLOW** (client UX)
- BYOK → bypass managed gate

---

## 9. Server entitlement limitations

**Implemented (Phase 16.2):** `backend/src/middleware/entitlement.ts`

- `X-Flowlary-Entitlement` is **never** authoritative billing truth
- Authenticated + non-anonymous client claim → server tier **`free`** only
- Client `pro`/`trial` claims do **not** unlock pro/trial rate limits
- Anonymous/missing client claim → **deny** managed AI (403)
- Client claim logged as `clientClaim` for telemetry only

**Still missing (Phase 17):**

- Real account authentication
- Server-verified pro/trial/billing
- Persistent usage database

Install-token auth remains interim — not a full account system.

---

## 10. Local live Groq verification

**BLOCKED_BY_MISSING_KEY**

- `backend/.env` not present
- No key printed or fabricated

Use after adding key locally:

```bash
cp backend/.env.example backend/.env   # add GROQ_API_KEY
npm run dev:api
node scripts/verify-live-api.mjs
```

---

## 11. Production API verification

**DNS_MISSING**

```
dig api.flowlary.com → no A/AAAA records
curl https://api.flowlary.com/health → Could not resolve host
```

Not fabricated as success.

---

## 12. DNS/TLS status

| Check | Result |
|-------|--------|
| DNS A/AAAA | **DNS_MISSING** |
| TLS | Not reachable (no DNS) |
| Health endpoint | **NOT VERIFIED** |

---

## 13. CORS status

**Configured** — `backend/src/middleware/cors.ts`

- Default: `https://flowlary.com`, `https://www.flowlary.com`
- No wildcard `*`
- Chrome extension uses manifest host permissions (not browser CORS)
- Unit tests: `tests/unit/backend/cors.test.ts`

---

## 14. Tests

**489 / 489 PASS**

New in Phase 16.2:

- `tests/unit/backend/entitlement.test.ts` (7)
- Updated `phase16-ai-gateway.test.ts` (pro claim not trusted)

---

## 15. Build

`npm run build` — **PASS**

---

## 16. Release build

`npm run build:release` — **PASS**

Release manifest:

```json
"host_permissions": [
  "https://api.groq.com/*",
  "https://api.flowlary.com/*"
]
```

---

## 17. Dist security audit (release)

| Pattern | Result |
|---------|--------|
| `GROQ_API_KEY` | None |
| `flowlary-api.zaixos.com` | None |
| `localhost` / `127.0.0.1` | None |
| `api.groq.com` | Present (BYOK — expected) |
| `api.flowlary.com` | Present (expected) |

---

## 18. Nested duplicate investigation

**Path:** `flowlary/` (untracked, **117MB**, has own `.git`)

| Check | Finding |
|-------|---------|
| Git tracked | **No** (`git ls-files flowlary/` empty) |
| Referenced by build/tests | **No** |
| Unique work | **No** — stale pre-Phase-16.1 snapshot |
| `endpoints.ts` | Still uses `lingo-api.zaixos.com` / `flowlary-api.zaixos.com` |
| Modified | 2026-08-25 07:41 vs main 09:58 |

**Conclusion:** Accidental nested duplicate. Safe to remove manually when confirmed by owner — **not deleted automatically** (may contain local git history).

---

## 19. Files changed (Phase 16.1 + 16.2)

**New:**

- `backend/src/middleware/cors.ts`
- `backend/src/middleware/entitlement.ts`
- `docs/production/FLOWLARY_PRODUCTION_DOMAIN.md`
- `docs/production/FLOWLARY_AI_ARCHITECTURE.md`
- `tests/integration/phase16-1-domain.test.ts`
- `tests/unit/backend/cors.test.ts`
- `tests/unit/backend/entitlement.test.ts`
- `PHASE16_1_REPORT.md`, `PHASE16_2_REPORT.md`

**Modified:** manifests, endpoints, auth/gateway, active docs, tests (23 files in diff)

---

## 20. Git status

Uncommitted changes on `main`. Untracked: `flowlary/` duplicate, new docs/tests/middleware.

---

## 21. Remaining blockers

1. **DNS** — create records for `api.flowlary.com`
2. **Deploy** — backend with TLS + `GROQ_API_KEY`
3. **Live verify** — local Groq + production health
4. **Account/billing** — Phase 17 (not started per scope)
5. **Remove** nested `flowlary/` duplicate (manual, when ready)

---

## 22. Exact next phase

**Phase 17 — Deploy + Account Entitlement**

1. DNS + deploy `api.flowlary.com`
2. Live Groq verification (all three contracts)
3. Server account auth replacing install-only boundary
4. Server-verified pro/trial (no client header trust)
5. Do **not** start payment UI, Arabic, or redesign until steps 1–2 pass

---

## Architecture (verified)

```
                  ZAIXOS
                     │
                     ▼
                  FLOWLARY
                     │
             ┌───────┴───────┐
             ▼               ▼
       flowlary.com    api.flowlary.com
                             │
                             ▼
                        AI GATEWAY
                             │
                             ▼
                            GROQ
                       ┌─────┼─────┐
                       ▼     ▼     ▼
                  Correct Translate Layout
```

**ONE FLOWLARY API · ONE MANAGED GROQ KEY · THREE AI CONTRACTS · ZERO MANAGED SECRETS IN EXTENSION**

See also: [FLOWLARY_AI_ARCHITECTURE.md](./docs/production/FLOWLARY_AI_ARCHITECTURE.md)
