# Flowlary Architecture

Flowlary merges three Chrome extensions (EWA, Lingo, Layfix) into **one** product with **one** content engine and **three** independent feature modules.

## Core Principles

1. **ONE content script** — `InputEngine` owns all document-level listeners.
2. **ONE background service worker** — message routing and future API orchestration.
3. **ONE popup** — unified product surface.
4. **THREE feature modules** — correction, translation, layout (separate code paths).
5. **THREE AI contracts** — never combined into a single prompt.

## Layer Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  Popup (React)                                               │
└───────────────────────────┬─────────────────────────────────┘
                            │ chrome.runtime messages
┌───────────────────────────▼─────────────────────────────────┐
│  Background Service Worker                                   │
│  GET_STATUS · SET_SETTINGS · DISPATCH_COMMAND · …           │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Content Script (single entry: content_script.ts)            │
│  ┌─────────────┐   ┌──────────────┐   ┌───────────────────┐ │
│  │ InputEngine │──▶│ FieldSession │──▶│ CommandRouter     │ │
│  └─────────────┘   └──────────────┘   └─────────┬─────────┘ │
│         │                    │                    │           │
│  ┌──────▼──────┐    ┌───────▼───────┐   ┌───────▼────────┐  │
│  │ DOM layer   │    │ Safety gate   │   │ Feature modules│  │
│  └─────────────┘    └───────────────┘   │ correction     │  │
│                                          │ translation    │  │
│                                          │ layout         │  │
│                                          └────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## InputEngine

Single owner of:

- `focusin` / `focusout`
- `input` (capture)
- `keydown` / `keyup` (capture)
- `compositionstart` / `compositionend`

Feature modules **must not** register competing global listeners.

## FieldSession

Per-field state:

| Property | Purpose |
|----------|---------|
| `generation` | Invalidates stale AI responses after edits |
| `requestSequence` | Monotonic request ids |
| `activeOperation` | Mutex — one writer at a time |
| `abortController` | Cancel in-flight work |
| `lastCommittedSnapshot` | Last known good text state |
| `composing` | IME guard |
| `pendingCommand` | Queued router command |
| `lastWriter` | Which feature last wrote |

## CommandRouter

Dispatches `CORRECT`, `TRANSLATE`, `FIX_LAYOUT`, `PIPELINE` to registered handlers.

**Rules:**

- No automatic TRANSLATE → CORRECT chaining.
- No automatic CORRECT → TRANSLATE chaining.
- `PIPELINE` reserved for explicit user intent (future).

## Feature Modules

| Module | Source | AI contract |
|--------|--------|-------------|
| `features/correction` | EWA | `CorrectionAI` — BYOK Groq |
| `features/translation` | Lingo | `TranslationAI` — server translate |
| `features/layout` | Layfix | `LayoutClassifierAI` — classify only; remap local |

## DOM Layer

Unified abstraction from Lingo/Layfix `dom/*` + EWA adapter patterns:

- Read text, caret, selection
- Snapshot + verify before write
- Surgical replacement with caret preservation
- Generation tracking for stale detection

## Safety Gate

Baseline: Lingo/Layfix `safety/*` (stricter than EWA).

Runs **before** any operation or AI call:

- Password, OTP, payment, username, email, URL fields
- Code regions, markdown fences
- Sensitive tokens (JWT, API keys, cards)
- Excluded domains

Returns `SafetyDecision { allowed, reason? }`.

## Storage Namespaces

| Key | Purpose |
|-----|---------|
| `flowlary.settings` | Master toggles, pause, exclusions |
| `flowlary.correction` | EWA settings |
| `flowlary.translation` | Lingo language + live toggles |
| `flowlary.layout` | Layfix layout profile |
| `flowlary.history` | Unified local history |
| `flowlary.entitlement` | License + usage |
| `flowlary.migrations.v1` | Migration completion flags |

Legacy keys (`ewa_*`, `lingo*`, `autofix*`) migrated in Phase 10 — not deleted until verified.

## Cache Isolation

`CacheCoordinator` keys **must** include operation type:

```
CORRECT:{hash}
TRANSLATE:{hash}:{src}:{tgt}
FIX_LAYOUT:{hash}:{layout}:{candidates}
```

Cross-operation cache hits are forbidden.

## iframe Policy (Phase 1 Decision)

**Manifest:** `all_frames: true` (per FL0 audit — preserves EWA same-origin iframe support).

**Runtime guard:** `shouldProcessFrame()` in `core/dom/frameGuard.ts`:

- Top frame: always process.
- Same-origin iframe: process.
- Cross-origin iframe: **skip** (cannot safely access DOM).

Documented in manifest and architecture; not a silent choice.

## Speed Box Shortcut

`Ctrl/Cmd+Shift+L` is **not** a manifest command (matches Layfix). It will be handled by the content script listener in Phase 4.

## Background Service Worker

Single entry: `src/background/index.ts`.

Phase 1: messaging infrastructure + `GET_STATUS` only. No external AI calls.
