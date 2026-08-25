# Phase 16 Report — Production AI Gateway + Groq Unification

**Date:** 2026-08-25  
**Status:** **COMPLETE**

## Summary

Phase 16 implemented a production-ready Flowlary AI Gateway in `@flowlary/backend`, unified extension transport through `FLOWLARY_API_BASE`, preserved three separate AI contracts, and made **managed Flowlary AI** the default for correction while keeping **explicit BYOK Groq** opt-in.

## What was inspected

- All phase reports (1–15), architecture docs, extension SW handlers (`correct.ts`, `translate.ts`, `classify.ts`)
- Backend placeholder state, endpoint config, manifests, entitlement/storage, tests (458 baseline)
- AI call sites: Groq BYOK correction, split translation/layout APIs, local layout-first path
- Security: host permissions, message validation, cache isolation, secret exposure patterns

## What was already implemented

- Three feature modules with separate semantics and cache namespaces
- Safety gate before all AI operations
- Extension-side caching, coalescing, stale protection
- BYOK Groq correction in service worker
- External translation/layout HTTP endpoints (separate hosts)
- Entitlement client model (trial/free/pro)

## What was changed

### Backend (new)

- Node HTTP server on port **8787** (dev)
- **AI Gateway** with `CorrectionProvider`, `TranslationProvider`, `LayoutClassifierProvider`
- Routes: `/api/ai/correction`, `/api/ai/translation`, `/api/ai/layout-classification`
- Legacy: `/api/translate`, `/api/analyze-word`
- Auth: `/api/auth/register`, bearer install tokens
- Rate limiting, timeouts, normalized errors, usage metadata logging

### Shared

- `packages/shared/src/ai/*` — models, errors, translation/layout prompts

### Extension

- Unified `FLOWLARY_API_BASE` (prod: `https://flowlary-api.zaixos.com`)
- Managed correction path via API; BYOK remains direct to Groq
- `aiProvider: 'managed' | 'byok'` (default **managed**)
- Install auth storage + headers on API calls
- Popup UX: managed AI default, BYOK labeled and opt-in
- Release manifest: removed `lingo-api` host (unified API)

## AI architecture before

```
Correction:  Extension → Groq (BYOK key in browser)
Translation: Extension → lingo-api.zaixos.com/api/translate
Layout AI:   Extension → flowlary-api.zaixos.com/api/analyze-word
Backend repo package: placeholder only
```

## AI architecture after

```
Correction (managed): Extension → flowlary-api → Gateway → CorrectionProvider → Groq
Correction (BYOK):    Extension → Groq (local key, opt-in)
Translation:          Extension → flowlary-api → Gateway → TranslationProvider → Groq
Layout classify:      Extension → flowlary-api → Gateway → LayoutClassifierProvider → Groq
Local layout remap:   unchanged (no AI)
```

## Groq model configuration

| Operation | Model |
|-----------|-------|
| Correction | `llama-3.1-8b-instant` |
| Translation | `openai/gpt-oss-120b` |
| Layout classification | `allam-2-7b` |

Single `GROQ_API_KEY` per environment on the server.

## API key architecture

| Key | Where | Exposure |
|-----|-------|----------|
| Managed `GROQ_API_KEY` | Server env | ✅ Not in extension/build/docs |
| BYOK Groq key | `flowlary.correction.groqKey` (local) | User-owned; never sent to Flowlary API |
| Install token | `flowlary.auth.installToken` (local) | Extension→API auth only |

## BYOK behavior

- **Default:** managed Flowlary AI (consent required, no Groq account)
- **Opt-in:** user switches to BYOK in popup, saves local Groq key
- BYOK correction bypasses Flowlary server and does not expose managed key
- BYOK keys are not included in status payloads or logs

## Backend routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Health check |
| POST | `/api/auth/register` | Mint install token |
| POST | `/api/ai/correction` | Managed correction |
| POST | `/api/ai/translation` | Translation |
| POST | `/api/ai/layout-classification` | Layout classifier |
| POST | `/api/translate` | Legacy translation |
| POST | `/api/analyze-word` | Legacy layout |

## Authentication

- Install ID + HMAC bearer token (interim extension boundary)
- Headers: `Authorization`, `X-Flowlary-Install-Id`, `X-Flowlary-Entitlement`
- Dev: auth relaxed when `FLOWLARY_ENV=development`
- Full account JWT: **deferred** (documented dependency)

## Usage tracking

In-memory `AIUsage`-style records: user, operation, model, tokens, status, latency, request_id. **No user text logged.**

## Rate limiting

Tier-based per operation (anonymous/free/trial/pro/byok). Returns HTTP 429 + `AI_RATE_LIMITED`.

## Cache behavior

Extension L1/L2 cache unchanged; operation namespaces preserved. Backend stateless (no response cache in Phase 16).

## Security

| Check | Status |
|-------|--------|
| No GROQ key in release `dist/` | ✅ VERIFIED |
| No localhost in release manifest | ✅ VERIFIED |
| Managed key not in GET_STATUS | ✅ VERIFIED |
| Separate AI contracts preserved | ✅ VERIFIED |
| Safety gate unchanged | ✅ VERIFIED |

## Tests

| Metric | Result |
|--------|--------|
| Baseline | 458 passing |
| Final | **470 / 470** passing (+12) |
| New | `phase16-ai-gateway`, `ai/models`, `correction/readiness` |

## Build

| Command | Status |
|---------|--------|
| `npm run build` | ✅ VERIFIED |
| `npm run build:release` | ✅ VERIFIED |

## Live API verification

| Operation | Status |
|-----------|--------|
| Correction | ⚠️ NOT VERIFIED — `GROQ_API_KEY` unavailable in environment |
| Translation | ⚠️ NOT VERIFIED — same |
| Layout classification | ⚠️ NOT VERIFIED — same |

Gateway logic verified via unit/integration tests with mocked Groq fetch.

## Chrome verification

| Check | Status |
|-------|--------|
| Unpacked extension load | ⚠️ NOT VERIFIED — no Chrome automation |
| E2E feature paths | ⚠️ NOT VERIFIED — manual QA recommended |

## Remaining blockers

1. Deploy unified API to production host with `GROQ_API_KEY`
2. Persist usage to database + link to account system
3. Replace install-token auth with account JWT when account phase ships
4. Manual Chrome QA on managed + BYOK paths

## Next recommended phase

**Phase 17 — Account auth + server entitlement:** wire API gateway to real user accounts, server-verified pro/trial, and persistent usage/billing.

## Original repositories

- `english-writing-assistant` — untouched  
- `ai-writing-translator` — untouched  
- `autofix-layout` — untouched  

## Final verdict

**PRODUCTION AI GATEWAY IMPLEMENTED**

One Flowlary product, one managed Groq architecture on the server, three separate AI contracts, no exposed server keys in the extension, with tests and release build passing. Live Groq and production deployment verification remain environment-dependent.
