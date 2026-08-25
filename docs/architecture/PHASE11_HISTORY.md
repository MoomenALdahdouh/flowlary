# Phase 11 — Unified History

## Overview

Flowlary exposes **one local history model** for all successful user-visible operations: correction, translation, and layout fix. History is local-first, privacy-preserving, bounded, and written only after successful DOM commits.

## History model

```typescript
HistoryEntry {
  id: string              // crypto.randomUUID() or timestamp-sequence fallback
  operation: CORRECT | TRANSLATE | FIX_LAYOUT
  timestamp: number       // ms since epoch
  domain?: string         // hostname only (no path/query/fragment)
  fieldKind?: textarea | text | contenteditable | unknown
  sourceText: string
  resultText: string
  metadata?: {
    mode?: manual | automatic | live
    sourceLanguage?: string
    targetLanguage?: string
    sourceLayout?: string
    targetLayout?: string
  }
}

HistoryStoreV1 {
  version: 1
  entries: HistoryEntry[]
  legacyImported?: boolean
}
```

Raw storage at `flowlary.history` may also retain Phase 10 preserve arrays (`ewa`, `layfix`) until cleanup policy removes them.

## Constants

| Constant | Value | Rationale |
|----------|-------|-----------|
| `MAX_HISTORY_ENTRIES` | 50 | EWA used 50; Layfix used 40 — unified on EWA limit |
| `MAX_HISTORY_TEXT_LENGTH` | 2000 | Matches field safety limits; reject oversized entries |
| `HISTORY_DEDUPE_WINDOW_MS` | 5000 | Collapse duplicate commit notifications |

## Storage API

Features must use `HistoryService` / facade — never raw `chrome.storage` keys.

- `getHistory()`
- `getHistoryStats()`
- `addHistoryEntry` via `HistoryService.record()` / `recordHistory()`
- `removeHistoryEntry(id)`
- `clearHistory()`

## HistoryService

Location: `extension/src/storage/history/`

Responsibilities:

- `initialize()` — legacy import (once), normalize store
- `record()` — privacy gate, validate, dedupe, prune, persist
- `list()` — newest-first
- `remove()` / `clear()`
- Write queue — serializes concurrent read-modify-write

## Privacy rules

Before persistence, `canRecordHistory()` runs:

1. `evaluateFieldSafety()` — blocked/protected fields, excluded domains, code editors
2. `isSensitiveText()` on source and result — API keys, JWT, credentials, markdown fences, token patterns

**Fail closed:** if safety cannot be determined, do not store.

Never stored:

- Passwords, OTP, payment fields
- API keys, JWT, bearer tokens
- Code-editor / protected regions
- Excluded domains
- Identical source/result text

Domain storage: **hostname only** (`example.com`), normalized (lowercase, strip `www.`).

Field storage: **kind only** — no field name, HTML, or page content outside the operation.

## Deduplication

Deterministic key:

```
operation + domain + sourceText + resultText
```

Duplicate if an existing entry shares the key and timestamps are within `HISTORY_DEDUPE_WINDOW_MS`.

Legitimate repeated edits with different results or outside the window remain separate entries.

## Pruning

When entries exceed `MAX_HISTORY_ENTRIES`, oldest entries are removed after sorting newest-first. Pruning runs on every write.

## Legacy migration

Phase 10 preserved legacy arrays under `flowlary.history`:

```typescript
{ _v: 1, ewa?: [], layfix?: [] }
```

On first `HistoryService.initialize()`:

1. Import EWA `{ original, corrected }` → `CORRECT`
2. Import Layfix `{ token, replacement }` → `FIX_LAYOUT`
3. Privacy-filter and validate each entry
4. Dedupe merged list
5. Set `legacyImported: true`
6. **Preserve** original `ewa` / `layfix` arrays in storage (not deleted)

Lingo had no legacy history source — nothing to import.

Migration is idempotent: skipped when `legacyImported === true`.

## Feature integration

History is recorded **by the feature after successful write**:

| Feature | Trigger | Mode |
|---------|---------|------|
| Correction | `commitMergedCorrection` after `writeReplacement` succeeds | `automatic` |
| Translation (manual) | `TranslationFeature` after write | `manual` |
| Translation (live) | `liveTranslate` after write | `live` |
| Layout (manual) | `applyLayoutFix` with `historyMode: 'manual'` | `manual` |
| Layout (automatic) | scheduler via `applyLayoutFix` with `historyMode: 'automatic'` | `automatic` |

Failed, stale, blocked, or aborted operations **never** create history.

Cache hits follow the same rule: history only if the cached result is successfully committed.

## Background / popup

- Background handles `GET_HISTORY`, `DELETE_HISTORY_ENTRY`, `CLEAR_HISTORY`
- Popup **History** view lists entries (view / delete / clear all)
- No export, cloud sync, restore-to-page, or analytics

## Concurrency

`HistoryService` uses an internal write chain so simultaneous feature commits cannot lose entries.

## Error handling

History failures are swallowed — primary features never fail because history storage failed.

## Deferred

- `PIPELINE` operation type (future phase)
- Restore historical text into pages
- Cloud history / analytics
- Persistent cache changes (Phase 12)
- Full security audit (Phase 13)
