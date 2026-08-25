# Phase 6 — Live Translation Architecture

Optional live translation while typing. **Default OFF.**

## Flow

```
InputEngine (input / composition-end / Enter)
    ↓ EventBus
TranslationScheduler (750ms debounce)
    ↓
runLiveTranslation()
    ↓ Safety Gate + segment eligibility
    ↓ FieldSession.tryAcquireWrite('TRANSLATE')
    ↓ TranslationEngine (mode: 'live')
    ↓ stale verification
    ↓ writeReplacement(origin: TRANSLATE)
```

Manual translation (Phase 5) remains:

```
CommandOrchestrator → TranslationFeature.execute()
```

## Segmentation (Lingo semantics)

1. `lastCompletedSegment` — sentence ending in `.!?…؟。！？` or newline
2. Fallback: `currentParagraph` — `\n\n` boundaries
3. Never per-word; only after debounce pause

## Settings

- `flowlary.translation.liveEnabled` — default **`false`**
- Toggle via popup or `SET_TRANSLATION` message

## Invariants

- No feature-level `document.addEventListener`
- No auto CORRECT / FIX_LAYOUT / PIPELINE
- Controlled writes use `WriteOrigin.TRANSLATE` (no generation bump loop)
- Cache keys remain `TRANSLATE:{hash}:{src}:{tgt}`
