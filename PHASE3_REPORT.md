# Phase 3 Report — InputEngine + CommandRouter Event Wiring

**Date:** 25 Aug 2026  
**Status:** ✅ Complete

---

## 1. Phase objective

Connect the unified InputEngine event system to CommandRouter so shortcuts and explicit commands follow:

DOM event → InputEngine → normalized event → FieldSession → CommandOrchestrator → CommandRouter → **stub** feature handler.

No feature AI.

---

## 2. Architecture before Phase 3

- InputEngine owned document listeners and updated FieldSession.
- CommandRouter existed but was **not** driven by events.
- Content script constructed engine + router and left them unwired.
- Background `DISPATCH_COMMAND` used a **separate** empty SW router.

---

## 3. Architecture after Phase 3

- `CommandOrchestrator` is the single command pipeline in the content script.
- Shortcuts (keydown + `chrome.commands` → `RUN_COMMAND`) share that pipeline.
- Safety runs before handlers.
- User input never auto-dispatches features.

---

## 4. InputEngine event flow

Document capture listeners (unchanged set): focusin, focusout, input, keydown, keyup, compositionstart, compositionend.

keydown additionally detects physical shortcuts (`Comma`, `KeyP`, `KeyL`) with Ctrl/Cmd+Shift.

---

## 5. Normalized event model

See `docs/architecture/PHASE3_INPUT_ROUTING.md` §2. Added `shortcut` events and richer session/origin/composing fields.

---

## 6. FieldSession resolution

Registry is still one session per element. Focus A → B keeps A's session. Commands after safety use `getOrCreate` on the resolved target only.

---

## 7. CommandRouter integration

Orchestrator builds a `Command` (field ref, text, generation, requestId) and calls `router.dispatch`. Stubs return `feature_not_ported`. PIPELINE stays unimplemented.

---

## 8. Shortcut handling

| Shortcut | Manifest | Content keydown | Result |
|----------|----------|-----------------|--------|
| Ctrl/Cmd+Shift+, | `TRANSLATE` | `Comma` | TRANSLATE stub |
| Ctrl/Cmd+Shift+P | `FIX_LAYOUT` | `KeyP` | FIX_LAYOUT stub |
| Ctrl/Cmd+Shift+L | **not** in manifest | `KeyL` | `SPEED_BOX` recognized, no UI |

---

## 9. Safety integration

`evaluateFieldSafety` before `tryAcquireWrite` and before `router.dispatch`. Password, OTP, payment, username, email, URL, code editor → `blocked`, `handlerExecuted: false`.

---

## 10. WriteOrigin integration

Programmatic `insertReplacementText` / `withWriteOrigin` does not bump generation. Input events do not call `dispatch()`.

---

## 11. Composition handling

Composing true on start; input does not bump generation; end clears composing and bumps generation.

---

## 12. Background routing

```
chrome.commands.onCommand → sendCommandToActiveTab → RUN_COMMAND → content orchestrator
```

SW never reads field text. Popup `DISPATCH_COMMAND` is forwarded the same way.

---

## 13. Tests added

- `tests/integration/phase3.test.ts` — TESTs 1–22 + invariants + extra safety fields + RUN_COMMAND
- `tests/unit/backgroundCommands.test.ts`
- Extended `inputEngine.test.ts`, `commandRouter.test.ts`, `manifest.test.ts`

---

## 14. Total tests

**86 / 86 passing** (Phase 1 + 2 + 3).

---

## 15. Build result

```
npm run build — ✓ built in 797ms
```

---

## 16. Files created

- `extension/src/core/input/shortcuts.ts`
- `extension/src/core/input/resolveTarget.ts`
- `extension/src/core/router/dispatch.ts`
- `extension/src/core/router/CommandOrchestrator.ts`
- `extension/src/background/commands.ts`
- `docs/architecture/PHASE3_INPUT_ROUTING.md`
- `PHASE3_REPORT.md`
- `tests/integration/phase3.test.ts`
- `tests/unit/backgroundCommands.test.ts`

---

## 17. Files modified

- `extension/src/content_script.ts`
- `extension/src/core/input/InputEngine.ts`
- `extension/src/core/events/EventBus.ts`
- `extension/src/background/index.ts`
- `extension/src/messaging/types.ts`
- `extension/vitest.setup.ts`
- `docs/architecture/FLOWLARY_ARCHITECTURE.md`
- `docs/development/PHASES.md`
- existing unit/integration tests listed above

---

## 18. Known limitations

- Feature handlers are still stubs.
- Speed Box has no UI (Phase 4).
- No auto-correct / live-translate schedulers (Phases 6–7).
- 250ms shortcut dedup may drop a genuine double-press of the same command (acceptable).

---

## 19. Explicit confirmation

- ✅ No AI implemented
- ✅ No Groq call exists
- ✅ No translation API call exists
- ✅ No layout classifier implemented
- ✅ No CorrectionCard implemented
- ✅ No auto-correction implemented
- ✅ No live translation implemented
- ✅ Original repositories were not modified

---

## Next: Phase 4 (awaiting approval)

Port Layfix layout module (local-first `mapLayout`, boundary triggers, speed box UI) into `features/layout`, using this orchestrator. Do not start until approved.
