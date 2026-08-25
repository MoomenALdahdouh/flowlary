# Phase 7 Gap Analysis — EWA Correction → Flowlary

**Date:** 25 Aug 2026

## EWA correction architecture

- Single content script owns document listeners
- Per-field `InputAdapter` + `IntelligentDebouncer` + `CorrectionCard`
- Pipeline: input → instantSpell (direct) → language gates → debounce → `CORRECT` message → SW Groq BYOK → merge or card
- Stale: debouncer generation + requestSeq + `canMergeCorrection`

## Flowlary correction (pre-Phase 7)

- Stub `createStubCorrectionFeature()` returning `feature_not_ported`
- CommandRouter/Corchestrator CORRECT path wired
- `StateManager.correction` types only (no persistence, no groq key)
- No scheduler, no background Groq handler

## Files to port (behavior)

| EWA source | Flowlary target |
|------------|-----------------|
| `content/debounce.ts` | `features/correction/debounce.ts` |
| `content/segment.ts` | `features/correction/segment.ts` |
| `content/mergeCorrection.ts` | `features/correction/mergeCorrection.ts` |
| `content/instantSpell.ts` | `features/correction/instantSpell.ts` |
| `language/detect.ts` | `features/correction/language.ts` |
| `background/groqCorrect.ts` | `background/correct.ts` |
| `shared/index.ts` (schemas/prompt) | `packages/shared/src/correction/` |
| `content/index.ts` orchestration | `CorrectionFeature.ts` + `scheduler.ts` + `applyCorrection.ts` |
| `ui/correction-card/CorrectionCard.ts` | `features/correction/ui/CorrectionCard.ts` (minimal) |

## Files NOT to copy

- EWA `adapters/*` — use Flowlary `core/dom/`
- EWA content `index.ts` document listeners — use EventBus
- EWA `storage/settings.ts` keys (`ewa_*`) — use `flowlary.correction`
- EWA backend fallback (optional dev only, not Phase 7 requirement)

## Adapter / DOM differences

| EWA | Flowlary |
|-----|----------|
| `adapter.getText/setText` | `readFieldText` / `writeReplacement` |
| `adapter.subscribe(onInput)` | InputEngine EventBus |
| Generation in debouncer only | FieldSession.generation authoritative |
| Session requestSeq | FieldSession.requestSequence + tryAcquireWrite |

## Dependencies deferred

- Full CorrectionCard polish → Phase 8
- History (`ewa_history`) → Phase 11
- Legacy migration → Phase 10
- Unified popup → Phase 9

## Stale handling adaptation

EWA `canMergeCorrection(current, segment)` + debouncer generation → Flowlary adds `FieldSession.canCommit`, `writeReplacement` snapshot gates, `WriteOrigin.CORRECT`.
