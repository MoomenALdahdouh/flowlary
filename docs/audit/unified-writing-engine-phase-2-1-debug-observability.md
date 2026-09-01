# Unified Writing Engine — Phase 2.1 Debug Observability

**Date:** 2026-08-31  
**Contract:** [docs/architecture/unified-writing-decision-engine-spec.md](../architecture/unified-writing-decision-engine-spec.md)  
**Predecessor:** [unified-writing-engine-phase-2-shadow-mode.md](./unified-writing-engine-phase-2-shadow-mode.md)  
**Gap this closes:** [phase-2-manual-bilingual-scenario-check.md](./phase-2-manual-bilingual-scenario-check.md)  
**Scope:** Read-only developer diagnostics hook for shadow decisions and Phase 1 write telemetry. Not Phase 3. No enforce mode. No writer migration. No user-visible UI.

**INTERNAL / DEVELOPMENT ONLY.** This hook is not a product API.

---

## Changed files

### New

| File | Role |
|---|---|
| `extension/src/core/engine/diagnostics.ts` | Read-only hook: attach/remove `globalThis.__FLOWLARY_DEBUG__` only when mode is `internal_shadow`. Reuses existing rings. No persistence. |
| `tests/unit/writing-engine/phase2-1-debug-observability.test.ts` | Hook presence, privacy, clear-scope, no-write |
| `docs/audit/unified-writing-engine-phase-2-1-debug-observability.md` | This report |

### Modified

| File | Change |
|---|---|
| `extension/src/core/engine/flag.ts` | Mode-change listeners; optional isolate watch so assigning `__FLOWLARY_ENGINE_MODE__` attaches/removes the hook |
| `extension/src/core/engine/index.ts` | `startShadowEngine` installs the watch, hydrates, and syncs the hook |

No popup, dashboard, settings schema, Decision Engine policy, legacy writer, backend, or storage-schema changes.

---

## Why page DevTools cannot access current data directly

1. Shadow events and write telemetry live in **content-script in-memory rings** (`engine/telemetry.ts`, `observability/writeTelemetry.ts`).
2. Chrome content scripts run in an **isolated world**. They share the page DOM but **not** the page JavaScript heap.
3. The page Console defaults to the **`top` (page) execution context**. `window` / `globalThis` there is the page isolate. Module exports such as `getShadowDecisionSnapshot` are not bound on that object.
4. There is no `console` emit, no `chrome.storage` dump, and no page-world injection (this phase still does not inject a page script).
5. Reload / navigation drops both rings.

That is why the Phase 2 manual bilingual check found zero inspectable events.

---

## Chosen access method

**Content-script isolated-world object only** — not a runtime-message route, not a page-world script.

```ts
globalThis.__FLOWLARY_DEBUG__ = {
  getEngineMode,
  getEffectiveWritingPolicy,
  getShadowDecisionSnapshot,
  getWriteTelemetrySnapshot,
  clearDebugSnapshots,
}
```

Chrome DevTools can evaluate in that isolate. Official Chrome docs: open the host-page DevTools Console, click the execution-context dropdown next to **top**, and select the extension. ([Debug extensions](https://developer.chrome.com/docs/extensions/get-started/tutorial/debug))

A message route was not added. The context selector is the supported developer path; a second surface would expand attack/inspection area without gaining privacy.

The object is:

- attached only when `getEngineMode() === 'internal_shadow'`
- removed when mode is `off`
- never assigned on `window` of the page world
- frozen; getters only; `clearDebugSnapshots` clears **only** the two in-memory rings

---

## Exact steps to enable shadow mode

Default remains **off**. Pick **one** enable method.

### A. Persist for this browser profile (recommended)

From an **extension** context (not the page):

1. `chrome://extensions` → Flowlary → **Service worker** / Inspect views.
2. In that Console:

```js
chrome.storage.local.set({ 'flowlary.debug.engineMode': 'internal_shadow' })
```

3. Reload the **test tab** so the content script hydrates the flag and attaches `__FLOWLARY_DEBUG__`.

### B. This tab only (content-script isolate)

1. Open the test page, open DevTools, switch Console context to the Flowlary content script (see below).
2. Run:

```js
globalThis.__FLOWLARY_ENGINE_MODE__ = 'internal_shadow'
```

3. Confirm:

```js
globalThis.__FLOWLARY_DEBUG__?.getEngineMode()
// → "internal_shadow"
```

This assignment is **not** persisted. Reload clears it unless method A was also used.

### Tests

`setInternalEngineMode('internal_shadow')`

Invalid / missing values stay `off`. The hook is absent when mode is `off`.

---

## Exact steps to open the correct DevTools execution context

Verified against current Chrome extension debugging behavior (Console context dropdown; isolated world).

1. Focus the **web page tab** under test (not the popup, not the service worker).
2. Open DevTools for that page (`F12` / right-click → Inspect).
3. Open the **Console** panel.
4. In the Console toolbar, find the execution-context dropdown. It defaults to **`top`** (page JavaScript).
5. Open the dropdown and select the **Flowlary** content-script context (labeled with the extension name, not `top`, not an iframe unless that iframe is the target).
6. Confirm you are in the isolate:

```js
typeof chrome !== 'undefined' && !!chrome.runtime
typeof globalThis.__FLOWLARY_DEBUG__
```

If `__FLOWLARY_DEBUG__` is `undefined` while `chrome.runtime` exists, shadow mode is still `off` — enable it (above) and reload if you used storage.

**Do not** run these commands in:

- the default **`top`** page context (the hook is invisible there by design)
- the **service worker** Console (different isolate; no content-script rings)
- the **popup** DevTools

Sources → Content scripts can be used to set breakpoints in the same isolate; the Console dropdown is what evaluates `__FLOWLARY_DEBUG__`.

---

## Exact developer workflow (dogfood dump)

1. Enable `internal_shadow` (method A or B).
2. Reload the test tab if you used storage (method A).
3. Open DevTools on the test page.
4. Switch Console execution context from **`top`** to the Flowlary content script.
5. Clear rings:

```js
globalThis.__FLOWLARY_DEBUG__.clearDebugSnapshots()
```

6. Type one test scenario in a Tier 1 field (`input` / `textarea`) and pause / Space / Enter / Tab as you normally would.
7. Dump shadow decisions:

```js
globalThis.__FLOWLARY_DEBUG__.getShadowDecisionSnapshot()
```

8. Dump Phase 1 write telemetry:

```js
globalThis.__FLOWLARY_DEBUG__.getWriteTelemetrySnapshot()
```

9. Optional:

```js
globalThis.__FLOWLARY_DEBUG__.getEngineMode()
globalThis.__FLOWLARY_DEBUG__.getEffectiveWritingPolicy()
```

10. Copy only this sanitized structured output into an audit note. Do not copy field text from the page.

---

## Expected privacy-safe data shape

No raw field text, tokens, source/target strings, selection, or DOM content.

### `getEngineMode()`

```ts
'off' | 'internal_shadow'
```

(The hook itself is absent when `'off'`.)

### `getEffectiveWritingPolicy()`

```ts
{
  helpStyle: 'auto' | 'suggestions' | 'shortcuts_only'
  assistantEnabled: boolean
  fixWrongTyping: boolean
  improveEnglish: boolean
  liveTranslation: boolean
  derived: boolean
  engineMode: 'internal_shadow'
}
```

No exception tokens, no host lists, no user text.

### `getShadowDecisionSnapshot()` — ring, max 80

```ts
[{
  shadow_only: true,
  shadowOnly: true,
  engine_version: '2.0.0-shadow',
  engineVersion: '2.0.0-shadow',
  feature_flag_key: 'flowlary.debug.engineMode',
  featureFlagKey: 'flowlary.debug.engineMode',
  feature_flag_variant: 'internal_shadow',
  featureFlagVariant: 'internal_shadow',
  timestamp: 1770000000000,
  cycleId: 'sh-1',
  fieldTier: 1,
  fieldKind: 'textarea',
  scriptMix: { arabic: 0, latin: 12, other: 0 },
  dominantOrigin: 'original_en',
  candidateTypes: ['english_correction'],
  decision: 'english_correction',
  confidenceClass: 'high',
  reasonCodes: ['single_winner_correction', 'shadow_observe_only'],
  comparison: 'legacy_not_observable',
  legacyObserved: 'not_observable',
  analyzed: true
}]
```

### `getWriteTelemetrySnapshot()` — ring, max 80

```ts
[{
  id: 1,
  timestamp: 1770000000000,
  capability: 'layout',
  trigger: 'auto',
  outcome: 'blocked',
  reasonCodes: ['unsupported_editor_auto_write'],
  fieldKind: 'contenteditable',
  composing: false,
  shadowOnly: false,
  metrics: { rangeLength: 12 }
}]
```

`clearDebugSnapshots()` empties both arrays in memory only.

---

## Tests run and results

| Suite | Result |
|---|---|
| `tests/unit/writing-engine/phase2-1-debug-observability.test.ts` | **7 passed** |
| `tests/unit/writing-engine/phase2-shadow-engine.test.ts` | **14 passed** |
| `tests/unit/writing-engine/phase1-hardening.test.ts` | **12 passed** |
| Related slice (layout / correction / translation / phase2 integration / dom-replace) | **30 files / 227 passed** |

**Lint:** No diagnostics on the Phase 2.1 engine files or new test file.

**Typecheck:** No new errors under `extension/src/core/engine`, `writeTelemetry.ts`, or `content_script.ts`. Repo-level `npm run typecheck` may still report pre-existing TS5097 / website-include noise.

Covered:

1. Hook absent when mode is `off`
2. Hook present when mode is `internal_shadow`
3. Snapshot JSON has no raw text-like keys or typed sample strings
4. Clear resets only the two in-memory rings (settings / field value unchanged)
5. Hook has no write/lock APIs; calling it does not mutate the field
6. Existing Phase 2 shadow tests still pass
7. Existing Phase 1 telemetry tests still pass

---

## Confirmations

- **No raw text is exposed.** Snapshots reuse existing privacy-safe event types. Policy dump is booleans + enums only. Tests serialize dumps against sample Arabic/Latin strings.
- **No data is persisted.** No `chrome.storage` write, no backend log, no disk dump. Rings are process-local and bounded (80).
- **No DOM or field writes through the hook.** The API is five read/clear functions. `clearDebugSnapshots` only calls `clearShadowDecisions` and `clearWriteTelemetry`.
- **No user-visible behavior changed.** Legacy writers, Decision Engine policy, cards, popup, and dashboard are untouched. When mode is `off`, the hook is not installed.

---

## Remaining limitations

1. You **must** evaluate in the content-script Console context. Page `top` will never see `__FLOWLARY_DEBUG__`.
2. Rings are lost on navigation / content-script restart.
3. Shadow `legacyObserved` remains `'not_observable'` (no live join to the write ring in this phase). Compare timestamps / `fieldKind` manually.
4. Setting `__FLOWLARY_ENGINE_MODE__` in the **page** Console does nothing (wrong isolate). Use storage or the content-script context.
5. No Phase 3 work: no enforce mode, no layout-writer migration.

Phase 3 was not started.
