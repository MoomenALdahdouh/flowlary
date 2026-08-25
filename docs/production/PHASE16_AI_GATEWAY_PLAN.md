# Phase 16 — AI Gateway Implementation Plan

**Status:** COMPLETE (living document — final state recorded below)

## Baseline (pre-implementation)

| Check | Result |
|-------|--------|
| `npm install` | PASS |
| `npm test` | **458 / 458** passing |
| `npm run build` | PASS |

## Architecture before

| Operation | Path | Model | Key |
|-----------|------|-------|-----|
| Correction | Extension SW → Groq direct | `llama-3.1-8b-instant` | BYOK in `flowlary.correction.groqKey` |
| Translation | Extension SW → `lingo-api` `/api/translate` | `openai/gpt-oss-120b` (external) | Server |
| Layout classify | Extension SW → `flowlary-api` `/api/analyze-word` | `allam-2-7b` (external) | Server |

Backend package was a **placeholder** only.

## Architecture after

```
Extension (SW)
  ├─ CORRECT (managed) → POST /api/ai/correction
  ├─ CORRECT (BYOK opt-in) → Groq direct (local key)
  ├─ TRANSLATE → POST /api/ai/translation
  └─ CHECK_WORD (fallback) → POST /api/ai/layout-classification
        ↓
Flowlary API (@flowlary/backend)
  └─ AI Gateway
       ├─ CorrectionProvider
       ├─ TranslationProvider
       └─ LayoutClassifierProvider
        ↓
     GROQ_API_KEY (server only)
```

## Completed tasks

- [x] Forensic AI inventory (see `PHASE16_REPORT.md`)
- [x] Shared model config (`packages/shared/src/ai/models.ts`)
- [x] Normalized AI error codes (`packages/shared/src/ai/errors.ts`)
- [x] Backend AI Gateway with three separate providers
- [x] Auth: install registration + bearer token (production)
- [x] Rate limiting by entitlement tier
- [x] Usage accounting (in-memory; metadata only)
- [x] Legacy routes preserved: `/api/translate`, `/api/analyze-word`
- [x] Unified extension endpoint config (`FLOWLARY_API_BASE`)
- [x] Managed correction default + explicit BYOK opt-in
- [x] Extension install auth (`flowlary.auth.*`)
- [x] Tests: **470 / 470** passing (+12 Phase 16)
- [x] Production manifest: single HTTPS API host (+ Groq for BYOK)
- [x] Documentation under `docs/production/`

## Remaining / deferred

- [ ] Persistent usage DB (depends on account/billing phase)
- [ ] Full account JWT auth (install token is interim boundary)
- [ ] Deploy unified API to production host
- [ ] Live Groq verification (no `GROQ_API_KEY` in dev environment)

## Test results (final)

| Command | Result |
|---------|--------|
| `npm test` | **470 / 470** PASS |
| `npm run build` | PASS |
| `npm run build:release` | PASS (no localhost in release manifest) |
