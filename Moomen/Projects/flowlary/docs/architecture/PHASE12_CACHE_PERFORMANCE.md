# Phase 12 — Cache & Performance

## Overview

Flowlary uses a **tiered cache** to avoid redundant AI calls while preserving safety, stale protection, and operation isolation.

```
request → safety → L1 memory → L2 persistent (`flowlary.cache`) → AI → validate → write → cache
```

Cache never bypasses safety, mutex, or stale checks.

## Layers

| Layer | Scope | Backing |
|-------|-------|---------|
| L1 | In-process memory | `createMemoryCacheCoordinator` |
| L2 | Cross-session persistent | `flowlary.cache` via `PersistentCacheStore` |

L1 is checked synchronously on hot paths. L2 is loaded lazily on `getWithL2()`.

## Cache keys

Built via `buildCacheKey()` in `@flowlary/shared`:

| Operation | Key shape |
|-----------|-----------|
| CORRECT | `CORRECT:{hash}:{contextHash}` |
| TRANSLATE | `TRANSLATE:{hash}:{src}:{tgt}` |
| FIX_LAYOUT | `FIX_LAYOUT:{hash}:{source}:{candidates}[:{ctxHash}]` |

Cross-operation hits are forbidden.

### Normalization

- **CORRECT:** NFC + collapse whitespace
- **TRANSLATE:** NFC only (spacing/punctuation preserved)
- **FIX_LAYOUT:** NFC only (characters matter)

Correction context hash includes `previousText` (last 200 chars) and `fieldType`.

## TTL

| Operation | TTL |
|-----------|-----|
| CORRECT | 15 minutes |
| TRANSLATE | 60 minutes |
| FIX_LAYOUT | 24 hours |

## Eviction

- `MAX_CACHE_ENTRIES = 200`
- On write: remove expired entries first, then LRU by `lastAccessAt`
- Invalid/sensitive entries rejected at write time

## Privacy

Reuses history sensitive-text detection. Never caches:

- Passwords, OTP, payment fields
- API keys, JWT, credentials
- Oversized text (>2000 chars)

Cache contents are never logged or sent remotely.

## Request coalescing

`createRequestCoalescer()` deduplicates identical in-flight AI requests:

- Translation SW handler
- Correction SW handler
- Layout classifier (existing)

Stale consumers may still reject coalesced results independently.

## Feature integration

| Feature | Cache location | Notes |
|---------|----------------|-------|
| Translation | Content + SW | L1 then L2 before provider/SW fetch |
| Correction | SW | Context-aware keys, coalesced Groq calls |
| Layout | Content | Local mapping first; L2 before classifier |

## Metrics (local dev only)

`getCacheMetrics()` tracks counts only — no user text:

- `cache_l1_hits`, `cache_l2_hits`, `cache_expired`, `cache_evictions`
- `request_coalesced`, `ai_requests_*`, `ai_requests_avoided`

## Legacy migration

Layfix `wordCacheV2` remains untouched (Phase 10 Option B). Flowlary rebuilds its own cache under `flowlary.cache`.

## Startup

Background and content script call `initializeFlowlaryCache()` after storage migration. Does not preload entire cache into memory.

## History interaction (Phase 11)

Cache hits do not create history directly. Features record history only after successful DOM commit.
