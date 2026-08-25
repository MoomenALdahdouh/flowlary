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

## FieldSession (Phase 2 hardened)

Per-field state and concurrency boundary:

| Property / API | Purpose |
|----------------|---------|
| `generation` | Authoritative stale counter — increments on **user** input only (synced to DOM map) |
| `requestSequence` | Monotonic ids — results from older ids must never commit |
| `tryAcquireWrite()` | Mutex acquire — returns `{ ok: false, reason: 'mutex-held' \| 'composing' }` if blocked |
| `releaseWrite()` / `noteWrite()` | Release mutex after successful commit |
| `abortActiveRequest()` | Aborts controller + invalidates request sequence |
| `canCommit(gen, requestId)` | Pre-write gate: composing, aborted, stale generation/sequence |
| `lastWriter` | Diagnostic: `CORRECT` \| `TRANSLATE` \| `FIX_LAYOUT` \| `SYSTEM` \| null |
| `composing` | IME guard — no acquire/commit while true |

**Invariants:**

1. Operation started at generation N may commit only if field is still compatible with N.
2. Only one active write mutex holder per field.
3. Timestamps in snapshots are diagnostic only — **generation is authoritative**.

## WriteOrigin (Phase 2)

Programmatic writes use `WriteOrigin`: `USER` \| `CORRECT` \| `TRANSLATE` \| `FIX_LAYOUT` \| `SYSTEM`.

- `withWriteOrigin()` wraps controlled DOM writes.
- `InputEngine` skips generation bump when `insertReplacementText` or controlled write is active.
- Prevents feature-write → input event → re-trigger loops (Phase 3 wiring builds on this).

## DOM Layer (Phase 2 unified API)

Canonical operations in `core/dom/editor.ts`:

| API | Role |
|-----|------|
| `readText()` | Field text |
| `readSelection()` / `readCaret()` | Selection state |
| `createSnapshot()` | FieldSnapshot with generation |
| `verifySnapshot()` | Stale text/generation check |
| `writeReplacement()` | Range write with session gates + `baselineSnapshot` |
| `restoreSelection()` | Reapply selection range |

`EditableAdapter` (`core/dom/adapter.ts`) bridges EWA edge cases: password ignore, Monaco/CodeMirror block, contenteditable host resolution.

## Safety Gate (Phase 2 — fail closed)

Baseline: Lingo/Layfix. Blocks before any future AI call:

- Sensitive fields (password, OTP, payment, username, email, URL)
- Code editors (Monaco, CodeMirror, Ace)
- Markdown fenced / inline code regions
- High-risk tokens (JWT, API keys, cards, env secrets)
- Excluded domains (exact + subdomain, no unsafe wildcards)

If uncertain → **BLOCK**.

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
