# Phase 9 — Unified Popup UX

## Overview

The popup is the single control surface for Flowlary. It communicates one product with three complementary capabilities:

1. Writing Correction (primary)
2. Translation
3. Keyboard Layout Fix

All actions use the existing messaging layer — the popup never calls AI APIs directly.

## Architecture

```
Popup (React)
  ↓ chrome.runtime.sendMessage
Service worker (handleMessage)
  ↓ stateManager + flowlaryStorage
ExtensionStatus response
  ↓
Popup UI update
```

Quick actions:

```
Popup → RUN_COMMAND → tabs.sendMessage → content CommandOrchestrator
```

## Views

- **Home** — global status, feature cards, quick actions, shortcuts, global pause
- **Settings** — correction mode/highlights, Groq key, languages, layout shortcut, privacy

## State flow

1. Popup opens → `GET_STATUS`
2. Toggle change → optimistic UI → `SET_*` message → storage → `ExtensionStatus` → confirm or revert on error
3. Global pause → `SET_SETTINGS { enabled }` using existing `stateManager.isActive()`

## Messaging types

| Message | Purpose |
|---------|---------|
| `GET_STATUS` | Load current state |
| `SET_SETTINGS` | Global enable/pause |
| `SET_CORRECTION` | Correction + Groq key |
| `SET_TRANSLATION` | Languages, live/manual |
| `SET_LAYOUT` | Auto-fix, shortcuts |
| `RUN_COMMAND` | Translate / Fix Layout on active tab |

## Groq API key UX

- Stored via `flowlary.correction.groqKey` (local storage)
- Popup shows Connected / Not configured only
- Full key never rendered after save
- Remove key clears local storage entry

## Feature independence

Each feature toggle patches its own namespace. Global pause is the only control that affects all features via `settings.enabled`.

Live Translation requires Translation (`shortcutEnabled`). Disabling Translation also disables live mode in the UI and patch.

## Accessibility

- Real `<button>` elements and `role="switch"` toggles
- Visible focus rings
- Semantic headings and `aria-label`s
- Error alerts use `role="alert"`

## Known limitations

- No unified history (Phase 11)
- No legacy settings migration (Phase 10)
- No billing/subscription UI (Phase 10)
- Language selectors in Settings only (not on home card)

## Deferred

- Entitlement/licensing UI (Phase 10)
- History dashboard (Phase 11)
- Persistent cache controls (Phase 12)
