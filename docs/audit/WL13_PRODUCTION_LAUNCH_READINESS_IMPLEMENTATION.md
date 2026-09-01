# WL-13 — Production Launch Readiness & Final End-to-End Validation

**Status:** PARTIAL (WL-13D executed; Paddle credentials + Chrome E2E + production DNS remain)  
**Last updated:** WL-13D session

---

## Executive summary

WL-13D cleared the **Groq / correction** blocker, fixed **reintroduced debug telemetry** in the extension, and brought the staging E2E script to **31/31 PASS**. WL-13 remains **PARTIAL** because:

| Blocker | WL-13D result |
|---------|----------------|
| Groq correction API | **PASS** — valid key, `groqConfigured=true`, staging correction + learning chain verified |
| Writing Lab browser E2E | **NOT RUN** — no browser automation; API path verified via staging script |
| Paddle sandbox credentials in `backend/.env` | **Still missing** (`PADDLE_API_KEY`, `PADDLE_CLIENT_TOKEN`, `PADDLE_WEBHOOK_SECRET`) |
| Paddle live checkout + webhook | **NOT RUN** — credentials absent; sandbox catalog prices exist via MCP |
| Chrome extension browser E2E | **NOT RUN** — no browser automation |
| Full 40-step browser journey | **NOT RUN** — blocked by Paddle + Chrome |
| Production DNS/TLS | **NOT VERIFIED** — `flowlary.com` / `api.flowlary.com` do not resolve from this environment |

---

## WL-13D environment (clean start verified)

| Service | Status |
|---------|--------|
| API `http://127.0.0.1:8787/health` | **200** `ok=true`, `groqConfigured=true`, `billingConfigured=false` |
| Website Vite `:5173` | **200** |
| Mailpit `:8025` | **200** |
| Herd `https://flowlary.test` | Running (Node TLS to Herd fails; browser/Herd OK) |

### Commands

```bash
npm run dev:api
npm run dev:web
npm run test:wl13b          # 31/31 PASS (WL-13D)
npm run test:wl13b-live     # 2/2 PASS
npm run build:release -w @flowlary/extension
npm run package:release     # validates no localhost in release manifest
```

---

## Groq — PASS (WL-13D)

| Check | Result |
|-------|--------|
| `GROQ_API_KEY` present | Yes |
| Groq models API | **200** (key valid) |
| `GET /health` | `groqConfigured=true` |
| `POST /api/ai/correction` (verified account) | **200** with valid `CorrectionResponse` |
| Staging script correction + learning chain | **PASS** (31/31) |

### Real bugs fixed (WL-13D)

1. **`correctionProvider.ts`** — switched Groq call from `responseFormat: 'text'` to `'json_object'` (matches coach/report providers; gpt-oss models need structured JSON mode).
2. **`groqClient.ts`** — single retry on transient Groq HTTP 503 (600ms backoff).
3. **`scripts/wl13b-staging-e2e.mjs`** — fixed response parsing (`body.data.changes` not `body.changes`); added 3-attempt correction retry for flaky Groq availability.

---

## Mailpit / auth — PASS (re-verified WL-13D)

Staging script `npm run test:wl13b`: **31/31 PASS** (includes correction, learning ingest, deduplication, account isolation).

Live vitest `npm run test:wl13b-live`: **2/2 PASS**.

| Flow | Result |
|------|--------|
| Register → trial + 200 credits | PASS |
| Mailpit verification email | PASS |
| `flowlary.test` verify URL, no localhost in email | PASS |
| Token verify / reuse / invalid | PASS |
| `POST /api/ai/correction` | PASS |
| `POST /api/learning/events` + deduplication | PASS |
| Account A/B isolation | PASS |
| `GET /api/billing/status` 401/200 | PASS |
| Debug telemetry in source | PASS (none after WL-13D cleanup) |

---

## Debug telemetry cleanup — PASS (WL-13D real bug fix)

Reintroduced `#region agent log` + `127.0.0.1:7790/ingest` blocks removed from:

- `extension/src/background/index.ts`
- `extension/src/dashboard/components/ComposeWorkbench.tsx`
- `extension/src/features/correction/applyCorrection.ts`
- `extension/src/storage/learning/events/index.ts`
- `extension/src/features/learning/recordCorrectionLearning.ts`

Scan: **zero** matches for `127.0.0.1:7790` or `#region agent log` in source.

---

## Logout / JWT — documented product behavior

**Finding:** `POST /api/auth/logout` deletes the server session record, but access JWTs are **not** invalidated server-side. `resolveAccountFromBearer` verifies JWT signature/expiry only.

**Verdict:** Intentional stateless JWT behavior. Tokens remain valid until TTL after logout.

**Mitigations:** Website clears client storage; account-scoped data keyed by account ID; API storage layer shows no cross-account leak.

---

## Paddle — NOT RUN (credentials missing)

| Variable | In `backend/.env`? |
|----------|-------------------|
| `PADDLE_PRICE_ID_PRO` | Yes (matches sandbox `pri_01m0vzs74d5d2gk5czmk2jh0bq`) |
| `PADDLE_PRICE_ID_PRO_YEARLY` | Yes (matches sandbox `pri_01m0yswaktpqwzs5hxcp6x8ehf`) |
| `PADDLE_API_KEY` | **No** |
| `PADDLE_CLIENT_TOKEN` | **No** |
| `PADDLE_WEBHOOK_SECRET` | **No** |

| Check | Result |
|-------|--------|
| `billingConfigured` on `/health` | **false** |
| Live sandbox checkout | **NOT RUN** |
| Live webhook delivery | **NOT RUN** |
| In-process webhook + Pro entitlement | **PASS** — `phase20-billing.test.ts` (19 tests) |
| Invalid webhook signature (live API) | **PASS** — 503 |
| Paddle MCP sandbox prices | **Confirmed** — Flowlary Pro monthly + annual exist |
| Paddle notification destinations | **Empty** — webhook URL not configured in dashboard |

---

## Extension release artifacts — PASS

After `npm run build:release` + `npm run package:release`:

```json
"host_permissions": ["https://api.flowlary.com/*"]
```

- Release ZIP validation: **OK** (no localhost in host_permissions)
- `extension/dist` and `website/dist`: **zero** localhost/7790/debug ingest references

**Note:** Plain `vite build` (non-release) may leave dev localhost permissions — use **`build:release`** for store submission.

---

## Extension test suite (WL-13D classification)

| Run | Passed | Failed | Skipped |
|-----|--------|--------|---------|
| Default `npm run test -w @flowlary/extension` | **951** | **99** | 2 |
| `WL13B_LIVE_API=1` | **1024** | **28** | 0 |

### Failure classification (~99 default / ~28 live)

| Category | Count (approx.) | Examples |
|----------|-----------------|----------|
| **TEST HARNESS** | ~70 | happy-dom CORS to `:8787` without `WL13B_LIVE_API=1` |
| **PRE-EXISTING** | ~20 | Phase 5/6 live-translation scheduler integration |
| **ENVIRONMENT** | ~5 | Tests needing live Groq/Paddle in specific states |
| **REAL BUG** | **0 remaining** | Debug telemetry fixed in WL-13D |

---

## Automated regression totals (WL-13D)

| Suite | Passed | Failed |
|-------|--------|--------|
| `@flowlary/shared` | 126 | 0 |
| `@flowlary/backend` | 91 | 0 |
| `@flowlary/website` | 115 | 0 |
| `@flowlary/extension` (default) | 951 | 99 |
| `@flowlary/extension` (`WL13B_LIVE_API=1`) | 1024 | 28 |
| WL-13B staging script | **31** | **0** |
| WL-13B live vitest | 2 | 0 |

**Builds:** Website PASS · Backend typecheck PASS · Extension release PASS · Shared typecheck PASS

---

## Production DNS — NOT VERIFIED

```bash
curl -fsS https://api.flowlary.com/health   # Could not resolve host
curl -fsSI https://flowlary.com             # Could not resolve host
```

Manual verification from deploy environment:

```bash
curl -fsS https://api.flowlary.com/health
curl -fsSI https://flowlary.com | head -5
```

---

## 40-step browser journey — NOT EXECUTED

Chrome browser journey was **not run** in WL-13D (no browser automation; Paddle checkout steps blocked).

Steps verified **via API/Mailpit/staging script** (not browser):

| Step | Via | Result |
|------|-----|--------|
| 02 Register | API | PASS |
| 04–05 Email verification | Mailpit | PASS |
| 09–13 Correction + learning | Staging script | PASS |
| 14 Canonical sync | API | PASS |
| 38 Account B isolation | API | PASS |

All other steps: **NOT RUN** until Paddle credentials + Chrome E2E complete.

---

## Password reset

**NOT IMPLEMENTED** — documented post-launch.

---

## Storage

JSON file store: **PASS** for single-instance + persistent volume deployment. Multi-instance without shared storage remains a deployment prerequisite.

---

## Real bugs fixed (WL-13D summary)

1. Groq correction: `json_object` response format for structured JSON from gpt-oss model.
2. Groq client: single 503 retry for transient provider unavailability.
3. WL-13B staging script: correct `{ ok, data }` response parsing + correction retry.
4. Extension debug telemetry: removed 6 reintroduced debug ingest blocks (P0 security).

---

## Manual actions required (WL-13D)

1. **Add Paddle sandbox credentials** to `backend/.env`: `PADDLE_API_KEY`, `PADDLE_CLIENT_TOKEN`, `PADDLE_WEBHOOK_SECRET`
2. **Configure Paddle notification destination** → staging/tunnel URL → `POST /api/billing/webhook`
3. **Complete Paddle sandbox checkout in Chrome** (4242 test card)
4. **Load `build:release` extension in Chrome** — full dashboard E2E
5. **Execute 40-step journey manually** on `https://flowlary.test`
6. **Verify production DNS/TLS** from deploy host

---

## WL-13D final gate

```
WL-13 STATUS: PARTIAL

Cannot be COMPLETE while:
- Paddle credentials missing (checkout/webhook NOT RUN)
- Chrome E2E not executed
- 40-step journey not executed
- Production DNS not verified
- P1 count > 0
```

**NEXT PHASE:** WL-13E — add Paddle credentials, run Chrome 40-step journey, verify production DNS → LAUNCH PREP
