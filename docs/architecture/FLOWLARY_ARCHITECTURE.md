# Flowlary Architecture

> **HISTORICAL (Phase 1–16 narrative).** The live writing path is the enforce pipeline + Write Gate, not independent feature schedulers. Current specification:
>
> - [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)
> - [WRITING_ENGINE.md](./WRITING_ENGINE.md)
> - [ARCHITECTURE_FREEZE.md](./ARCHITECTURE_FREEZE.md)
>
> Do not implement new auto-writers from this document.

Writing-path decisions were specified in [unified-writing-decision-engine-spec.md](./unified-writing-decision-engine-spec.md) and **are implemented** in `extension/src/core/writeGate/pipeline.ts`.

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

Phase 3: InputEngine emits normalized events. **CommandOrchestrator** is the only consumer that may call CommandRouter. Ordinary `input` events update FieldSession only.

**Canonical command path:**

```
chrome.commands / Ctrl+Shift+, or P / RUN_COMMAND message
    → CommandOrchestrator
    → Safety Gate
    → FieldSession.tryAcquireWrite
    → CommandRouter (correction/translation stubs; layout implemented Phase 4)
```

Phase 4: **LayoutScheduler** subscribes to EventBus for auto-fix on word boundaries. **LayoutFeature** handles manual `FIX_LAYOUT`. **Speed Box** toggled via orchestrator callback — no extra document listeners.

Phase 5: **TranslationFeature** handles manual `TRANSLATE` (Ctrl/Cmd+Shift+,). Content script sends `TRANSLATE_TEXT` to service worker; SW calls `/api/translate`.

Phase 6: **TranslationScheduler** subscribes to EventBus for optional live translation (750ms debounce, segment-level). **Default OFF** (`liveEnabled: false`).

Phase 7: **CorrectionScheduler** subscribes to EventBus with EWA IntelligentDebouncer. **CorrectionFeature** sends `CORRECT_TEXT` to service worker for Groq BYOK (`llama-3.1-8b-instant`). Direct mode auto-merges; box mode shows CorrectionCard (Phase 8).

Phase 8: **CorrectionCard** (Shadow DOM, hostStyleAdapter, tokenDiff highlights). One card per field. Accept/dismiss with stale binding verification. Direct-edit and orchestrator-dispatch mutex integration. All commits use `WriteOrigin.CORRECT`.

Phase 9: **Unified popup** — single Flowlary control center (correction, translation, layout, global pause, Groq BYOK UX, quick actions). Popup uses `GET_STATUS` / `SET_*` / `RUN_COMMAND` only; never calls AI APIs directly.

Phase 11: **Unified history** — local-only `HistoryService` records successful correction, translation, and layout commits under `flowlary.history`. Privacy-gated, deduplicated, bounded (50 entries). Popup history view via `GET_HISTORY`. See [PHASE11_HISTORY.md](./PHASE11_HISTORY.md).

Phase 12: **Tiered cache** — L1 memory + L2 persistent `flowlary.cache`. Operation-isolated keys, TTL, LRU eviction, privacy gating, request coalescing. See [PHASE12_CACHE_PERFORMANCE.md](./PHASE12_CACHE_PERFORMANCE.md).

Phase 13: **Security / privacy hardening** — Runtime message validation, sender checks, safety text scanning, AI response bounds, CSP, documentation. See [SECURITY_ARCHITECTURE.md](../security/SECURITY_ARCHITECTURE.md) and [DATA_FLOW.md](../privacy/DATA_FLOW.md).

Phase 16: **Production AI Gateway** — Unified Flowlary API with managed Groq, three separate provider contracts (correction / translation / layout classification), install auth, rate limiting, usage metadata. Managed correction default; BYOK Groq opt-in. See [AI_PRODUCTION_ARCHITECTURE.md](../production/AI_PRODUCTION_ARCHITECTURE.md).

See [PHASE3_INPUT_ROUTING.md](./PHASE3_INPUT_ROUTING.md), [PHASE4_LAYOUT.md](./PHASE4_LAYOUT.md), [PHASE5_TRANSLATION.md](./PHASE5_TRANSLATION.md), [PHASE6_LIVE_TRANSLATION.md](./PHASE6_LIVE_TRANSLATION.md), [PHASE7_CORRECTION.md](./PHASE7_CORRECTION.md).

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
| `features/correction` | EWA | `CorrectionAI` — managed Flowlary API (default) or BYOK Groq |
| `features/translation` | Lingo | `TranslationAI` — Flowlary API `/api/ai/translation` |
| `features/layout` | Layfix | `LayoutClassifierAI` — Flowlary API fallback; remap local |

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
| `flowlary.correction` | Correction settings (Groq key in `flowlary.correction.groqKey`) |
| `flowlary.translation` | Lingo language + live toggles |
| `flowlary.layout` | Layfix layout toggles |
| `flowlary.layout.profile` | Personal exceptions + trust events |
| `flowlary.cache` | Tiered L1/L2 AI result cache (Phase 12) |
| `flowlary.history` | Unified operation history (Phase 11) + preserved legacy arrays until cleanup |
| `flowlary.entitlement` | License + usage (`FLOWLARY` product ID) |
| `flowlary.migrations.v1` | Migration v1 state machine |

Legacy keys (`ewa_*`, `lingo*`, `autofix*`, `licenseKey`, `wordCacheV2`) migrated in Phase 10 — **not deleted** until explicit cleanup after verification. See [PHASE10_STORAGE_MIGRATION.md](./PHASE10_STORAGE_MIGRATION.md).

## Cache Isolation

`CacheCoordinator` keys **must** include operation type. Persistent cache lives under `flowlary.cache` (Phase 12).

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
