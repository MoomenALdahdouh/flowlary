# Phase 5 — Manual Translation

Phase 5 ports Lingo manual translation into `features/translation/` using existing Flowlary infrastructure. **Live translation is NOT implemented.**

## Flow

```
Ctrl/Cmd+Shift+, / RUN_COMMAND
  → InputEngine shortcut
  → CommandOrchestrator
  → Safety Gate
  → FieldSession mutex (TRANSLATE)
  → TranslationFeature.execute
  → TranslationEngine (local validation + cache)
  → chrome.runtime.sendMessage(TRANSLATE_TEXT)
  → service worker handleTranslateText
  → POST /api/translate (optional backend)
  → stale verification
  → writeReplacement(WriteOrigin.TRANSLATE)
```

## Selection behavior (Lingo semantics)

| Case | Behavior |
|------|----------|
| Non-empty selection | Translate selection slice only |
| Collapsed caret | Translate current paragraph (`\n\n` boundaries) |
| Empty / whitespace | `empty_text` — no AI call |
| Protected token | `protected` — no AI call |

## Safety

Orchestrator runs `evaluateFieldSafety` before `TranslationFeature.execute`. Feature additionally runs `targetLooksProtected` on the translation slice.

## Stale protection

`TranslationTicket` captures generation + range + original slice. After async translate:

1. `isStaleTicket`
2. `session.canCommit`
3. `writeReplacement` snapshot verification

## Mutex

Orchestrator acquires `tryAcquireWrite('TRANSLATE')` before feature execution.

## Cache

`CacheCoordinator` keys: `TRANSLATE:{hash}:{src}:{tgt}` — isolated from CORRECT/FIX_LAYOUT.

## Storage

`stateManager.translation` / `flowlary.translation` namespace:

- `sourceLanguage` (default `ar`)
- `targetLanguage` (default `en`)
- `shortcutEnabled`
- `liveEnabled` (**default false**)

## Backend

Service worker: `background/translate.ts` → `http://127.0.0.1:8004/api/translate`

If backend unavailable: `translation_unavailable` — original text preserved.

## Phase 6 extension point

`TranslationModule.prepareLiveScheduler()` — subscribe to InputEngine EventBus (no document listeners).

## Invariants preserved

- No automatic CORRECT / FIX_LAYOUT chaining
- No live translation in Phase 5
- No feature-level document listeners
- No backend secrets in content script
