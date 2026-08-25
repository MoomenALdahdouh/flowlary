# Phase 3 — Input Engine Routing

Phase 3 wires **InputEngine → FieldSession → CommandOrchestrator → CommandRouter**. Feature handlers remain stubs (`feature_not_ported`). No AI.

## 1. Event flow

```
DOM event (capture, document)
    ↓
InputEngine  (sole document-listener owner)
    ↓
NormalizedInputEvent (EventBus)
    ↓
  input / focus     → FieldSession update only (NO feature dispatch)
  shortcut          → CommandOrchestrator.handleShortcut
    ↓
resolveCommandTarget → Safety Gate → tryAcquireWrite → CommandRouter
    ↓
stub feature handler
```

User typing **never** auto-dispatches CORRECT, TRANSLATE, or FIX_LAYOUT.

## 2. Normalized event model

`NormalizedInputEvent` (`core/events/EventBus.ts`):

| type | Extra fields |
|------|----------------|
| `focus-in` / `focus-out` | target, session, composing, origin |
| `input` | generation, origin (`USER` \| controlled), composing |
| `keydown` / `keyup` | key, code, modifiers |
| `composition-start` / `composition-end` | composing flag, generation on end |
| `shortcut` | `TRANSLATE` \| `FIX_LAYOUT` \| `SPEED_BOX` |

Raw DOM events stay inside InputEngine.

## 3. FieldSession resolution

- One `FieldSession` per element (`WeakMap` registry).
- Focus switch updates `activeElement`; other sessions stay alive.
- Commands use `engine.sessions.getOrCreate(target)` after safety passes.

## 4. Target resolution

`resolveCommandTarget()` (`core/input/resolveTarget.ts`):

1. `findEditableFromTarget` / `EditableAdapter` (canonical).
2. Fallback: password/OTP/email/URL inputs and code editors so **Safety can block** them instead of returning `no_target`.

Seed order: explicit `target` → `InputEngine.getActiveElement()` → `document.activeElement`.

## 5. Shortcut flow

Physical `event.code` (layout-independent):

| Shortcut | Code | Path |
|----------|------|------|
| Ctrl/Cmd+Shift+, | `Comma` | InputEngine shortcut → orchestrator → TRANSLATE |
| Ctrl/Cmd+Shift+P | `KeyP` | same → FIX_LAYOUT |
| Ctrl/Cmd+Shift+L | `KeyL` | SPEED_BOX recognized only — **no UI** |

Manifest registers only `TRANSLATE` and `FIX_LAYOUT`.

## 6. CommandRouter flow

`CommandOrchestrator.dispatch(operation)`:

1. Resolve field (`no_target` if none)
2. `evaluateFieldSafety` — **before** any handler
3. `tryAcquireWrite` (`busy` if mutex/composing)
4. `router.dispatch(command)` — stub returns `feature_not_ported`
5. `releaseWrite` (stubs do not write)
6. `canCommit` maps stale/aborted

`PIPELINE` remains reserved (`pipeline_not_implemented`).

## 7. Safety-before-command

Blocked: password, OTP, payment, username, email, URL, code editor, markdown fences, sensitive tokens, excluded domains, paused extension.

Handler **does not run** when blocked.

## 8. WriteOrigin

Controlled writes (`insertReplacementText` / `withWriteOrigin`) do not bump user generation. Input events never call `dispatch()`.

## 9. Composition

- `compositionstart` → `session.setComposing(true)` (aborts in-flight write)
- Input during composition does **not** bump generation
- `compositionend` → composing false; generation bumps (invalidates IME-era ops)

## 10. Mutex

Orchestrator uses Phase 2 `tryAcquireWrite` / `releaseWrite` / `canCommit`. One writer per field.

## 11. No auto-chain

Dispatching TRANSLATE runs only the TRANSLATE handler. Same for CORRECT and FIX_LAYOUT. No PIPELINE execution.

## 12. Background / service worker

**Single path:**

```
chrome.commands.onCommand (TRANSLATE | FIX_LAYOUT)
    or popup DISPATCH_COMMAND / RUN_COMMAND
        ↓
service worker sendCommandToActiveTab
        ↓
tabs.sendMessage({ type: 'RUN_COMMAND', operation })
        ↓
content CommandOrchestrator
```

The service worker never reads field text and never calls feature handlers.

Keydown and `chrome.commands` can both fire; orchestrator **dedupes** identical shortcuts within 250ms.

## 13. Speed Box

Content-script shortcut only. `lastShortcut === 'SPEED_BOX'`, status `speed_box`. No overlay in Phase 3.

## 14. Phase 4+ extension points

Replace stub `execute()` implementations. Orchestrator already:

- resolves the field
- runs safety
- holds the write mutex
- passes `generation` + `requestId` on `Command`

Wire live-translation / auto-correct **schedulers** later — still must not add extra document listeners.
