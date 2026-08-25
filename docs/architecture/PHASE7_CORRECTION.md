# Phase 7 — English Writing Correction

## Architecture

```
InputEngine → EventBus → CorrectionScheduler (IntelligentDebouncer)
    → runCorrectionRequest → Safety → FieldSession mutex
    → CORRECT_TEXT (service worker) → Groq BYOK
    → mergeCorrection → writeReplacement(CORRECT)
```

Manual `CORRECT` command uses the same `runCorrectionRequest` path via `CorrectionFeature.execute()`.

## BYOK Groq

- User API key stored in `flowlary.correction.groqKey` (local storage)
- Service worker calls `https://api.groq.com/openai/v1/chat/completions`
- Model: `llama-3.1-8b-instant`
- Key never exposed to page context

## Modes

| Mode | Behavior |
|------|----------|
| `direct` | Auto-merge correction into field (default Phase 7) |
| `box` | Show minimal CorrectionCard; user clicks Apply |

## Debounce (EWA)

| Mode | Default | Word | Sentence |
|------|---------|------|----------|
| box | 120ms | 45ms | 30ms |
| direct | 90ms | 25ms | 20ms |

## Language gate

- `shouldShowEnglishAssistant` — lenient UI gate
- `isEligibleForCorrection` — strict API gate (English only)
- Max assist field: 250 chars; max correction segment: 2000 chars

## Stale protection

Debouncer generation + FieldSession mutex + `canMergeCorrection` + `writeReplacement` gates.

## Cache

In-memory SW cache + `CORRECT:{hash}` via CacheCoordinator (content-side ready).

## Phase 8 deferrals

- Full CorrectionCard UX polish
- hostStyleAdapter theming
