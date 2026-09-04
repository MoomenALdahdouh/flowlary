# Phase 6 — Live Translation Architecture

Optional live translation while typing. **Default OFF.**

Pro/trial live and shortcut translation use **Groq `gpt-oss-120b` on the source text** (Lingo contract: JSON `translation`, no Google draft). Free remains Google-only. Google is not mixed into a Pro result.

## Flow

```
InputEngine (input / keyup / focus-out)
    ↓ EventBus
enforceCoordinator
    ↓ immediate runFieldCycle (layout / correction)
    ↓ scheduleEnforceRetry(LIVE_PAUSE_MS = 750) when liveTranslation active
runFieldCycle()
    ↓ collectHypotheses (translationPauseReady + liveSegmentOnPause)
    ↓ decideWriting → translation
fulfillTranslationDecision()
    ↓ executeTranslation()  ← shared with manual shortcut path
    ↓ stale verification
    ↓ commitWriteTransaction(origin: TRANSLATE)
```

Manual translation (Phase 5) uses the same executor:

```
CommandOrchestrator → TranslationFeature.execute() → executeTranslation()
```

## Segmentation (Lingo semantics)

`liveSegmentOnPause()` in `features/translation/segments.ts`:

1. `lastCompletedSegment` — sentence ending in `.!?…؟。！？` or newline
2. Fallback: `currentParagraph` — `\n\n` boundaries (after deliberate pause)
3. Never per-word; translation hypothesis requires `translationPauseReady` (750ms since last input, or focus-out bypass)

## Pause gate

- `features/translation/pauseGate.ts` — `LIVE_PAUSE_MS = 750`
- Wired in `enforceCoordinator` via `scheduleEnforceRetry`
- `buildFieldContext` exposes `translationPauseReady` for hypotheses

## Settings

- `flowlary.translation.liveEnabled` — default **`false`**
- Toggle via popup or `SET_TRANSLATION` message

## Invariants

- No feature-level `document.addEventListener`
- No standalone `TranslationScheduler` writer (retired; enforce pipeline owns live path)
- Controlled writes use `WriteOrigin.TRANSLATE` (no generation bump loop)
- Cache keys remain account-scoped `TRANSLATE:{account}:{hash}:…`
