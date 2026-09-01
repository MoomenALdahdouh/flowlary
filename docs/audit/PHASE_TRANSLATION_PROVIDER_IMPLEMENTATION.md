# PHASE — Translation Provider Router + Google Translation

**Status:** IMPLEMENTED  
**Date:** 2026-08-26  
**Baseline:** `docs/audit/FLOWLARY_COMPLETE_ARCHITECTURE_AUDIT.md`

## 1. Files changed

### Backend
- `backend/src/config/env.ts` — Google + routing env (`GOOGLE_TRANSLATE_*`, `TRANSLATION_FORCE_PROVIDER`, `TRANSLATION_ALLOW_GROQ_FALLBACK`)
- `backend/.env.example` — placeholders only
- `backend/src/providers/googleTranslateProvider.ts` — official Cloud Translation (API key v2 and/or ADC v3)
- `backend/src/providers/translationCache.ts` — provider/strategy/account-aware in-memory cache
- `backend/src/providers/translationRouter.ts` — CACHE / GOOGLE / GROQ / GOOGLE_THEN_GROQ orchestration
- `backend/src/providers/translationProvider.ts` — preserved Groq translate; added refinement helper
- `backend/src/gateway/index.ts` — wires router; conditional Groq credit reservation
- `backend/src/gateway/errors.ts` — Google error normalization

### Shared
- `packages/shared/src/ai/translation.ts` — strategy/provider types, refinement prompt, `predictClientTranslationStrategy`
- `packages/shared/src/cache.ts` — `translationStrategy` in TRANSLATE keys; schema bump
- `packages/shared/src/capabilities.ts` — Free always keeps `ai.translation` / `ai.liveTranslation` (Google path)
- `packages/shared/src/entitlement/index.ts` — translation not Groq-credit-gated

### Extension (cache keys only)
- `extension/src/background/translate.ts` — strategy-aware cache keys
- `extension/src/features/translation/cache.ts` — strategy argument
- `extension/src/features/translation/TranslationFeature.ts` — strategy-aware L1/L2 cache

### Tests / docs
- `tests/unit/translation-router.test.ts`
- `tests/integration/phase16-ai-gateway.test.ts` / `phase17-account.test.ts` — clear backend translation cache between tests
- `docs/privacy/DATA_FLOW.md` — provider routing privacy note
- `docs/audit/FLOWLARY_COMPLETE_ARCHITECTURE_AUDIT.md` — Google no longer “NOT IMPLEMENTED”
- `docs/audit/PHASE_TRANSLATION_PROVIDER_IMPLEMENTATION.md` — this report

### Dependency
- `google-auth-library` (backend) for ADC / v3 access tokens

## 2. Files not changed

- `extension/src/core/input/InputEngine.ts`
- `extension/src/core/session/FieldSession.ts`
- EventBus / CommandRouter / CommandOrchestrator
- LayoutFeature / CorrectionFeature
- LearningEventService / HistoryService (still app-layer)
- Account isolation architecture (no redesign)

## 3. Provider architecture

```
TranslationFeature → TRANSLATE_TEXT → Background → POST /api/ai/translation
  → AiGateway.translation
    → TranslationRouter
         ├── CACHE (account + strategy keyed)
         ├── GOOGLE
         ├── GROQ (migration / force / controlled fallback)
         └── GOOGLE_THEN_GROQ (Pro non-live refine)
```

Google credentials and SDK usage remain **backend-only**.

## 4. Google integration

- Official Cloud Translation API only (no scraping).
- **API key path:** Translation API v2 REST when `GOOGLE_TRANSLATE_API_KEY` is set.
- **ADC path:** v3 `translateText` via `google-auth-library` when application credentials / ADC are available.
- Requires `GOOGLE_TRANSLATE_ENABLED=1` plus credentials.

## 5. Routing logic

`resolveTranslationStrategy(config, auth, mode)`:

| Condition | Strategy |
|---|---|
| `TRANSLATION_FORCE_PROVIDER` set | forced strategy |
| Google not configured | `groq` (controlled migration default) |
| Pro/trial + mode ≠ `live` | `google_then_groq` |
| Free / Pro live / otherwise | `google` |

## 6. Free behavior

- Default: **Google only** (when enabled).
- No Groq call, no Groq credit burn.
- If Google disabled/unconfigured: Groq (existing path) so local/tests keep working.
- Google failure → error unless `TRANSLATION_ALLOW_GROQ_FALLBACK=1` (observable + credit-gated).

## 7. Pro behavior

- **Live:** Google only (avoids multiplying Groq on ~750ms pauses).
- **Manual/shortcut:** Google → optional Groq refinement.
- If refinement cannot reserve credits or fails: **return Google translation**.

## 8. Groq refinement

- Reuses `callGroqChat` + `runTranslationRefinement` (same Groq client / model infrastructure).
- No second AI auth path.

## 9. Cache behavior

- Backend cache key: `accountId | strategy | source | target | textHash`
- Extension TRANSLATE keys include `translationStrategy` (schema bumped)
- Prevents Free Google hits from satisfying Pro refined lookups and vice versa

## 10. Credit behavior

- Google-only: **no** `reserveManagedUsage`
- Groq / successful refinement: reserve + finalize as before
- Failed refinement: release reservation; Google result still returned
- Free translation capability retained even at 0 Groq credits (Google path)

## 11. Error handling

Mapped via existing `GatewayError` / `mapProviderFailure`:

- Google auth / quota / rate limit / timeout / invalid / unavailable
- Groq timeout / rate limit / invalid / HTTP failures
- Backend abort timeout unchanged

User-facing codes remain normalized (no provider internals).

## 12. Security

- No Google key in extension / website / content scripts
- No Groq key in extension
- Secrets only via backend env / ADC

## 13. Privacy

Leaves browser as before for translation text: Extension → Backend.

Then:

- Free: Backend → Google
- Pro refine: Backend → Google → Groq

Raw source text is not written to normal application logs (telemetry is provider/strategy/latency only).

## 14. Tests

Added `tests/unit/translation-router.test.ts` covering:

- Free → Google
- Pro shortcut → google_then_groq
- Pro live → Google
- Google unconfigured → Groq
- Usage exhausted → Google allowed, Groq denied
- Free Google → no Groq / no credit reserve
- Pro refine success billable
- Refine failure → Google preserved
- Cache hit
- Strategy-isolated cache

## 15. Test results

```
✓ tests/unit/translation-router.test.ts (10)
✓ tests/integration/phase16-ai-gateway.test.ts (8)
✓ tests/integration/phase17-account.test.ts (17)
```

Phase 5/6 DOM suites require the extension jsdom environment and were not used as the gate for this backend-router phase.

## 16. Remaining limitations

- Progressive Google→refine UI streaming not added (returns final safe result to avoid flicker).
- Backend cache is in-process memory (fine for single-node; not shared across instances).
- Live Pro path intentionally skips auto-refine (cost control).
- Real Google API calls require deploying credentials; unit tests mock providers.
- CS AbortSignal still does not cancel in-flight SW fetch (pre-existing).

## 17. Recommended next phase

1. Progressive rendering for Pro refine (intermediate Google → final refine) with stale guards.
2. Shared/redis translation cache if multi-instance.
3. Production Google quota/alerting dashboards.
4. Optional completed-word boundary for Free live Google to further cut volume.
