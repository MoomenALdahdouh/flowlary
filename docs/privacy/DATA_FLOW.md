# Flowlary Data Flow

> Current writing-path network operations also include **hypothesis-advisor** and **writing-review** (island snippet only). See [../architecture/AI_ARCHITECTURE.md](../architecture/AI_ARCHITECTURE.md) and [../architecture/SAFETY.md](../architecture/SAFETY.md). Live translation default OFF is still true; live translate in production is the enforce pipeline, not `TranslationScheduler`.

This document describes what stays on-device vs what may leave the device for each operation.

## Common pipeline

```
User text in focused field
  ↓
Safety gate (evaluateFieldSafety)
  ↓
Operation (CORRECT | TRANSLATE | FIX_LAYOUT)
  ↓
Cache lookup (privacy-gated)
  ↓
Flowlary AI / backend (only if cache miss and operation requires it)
  ↓
Response validation (schema + size bounds)
  ↓
DOM write (writeReplacement)
  ↓
Activity record (privacy-gated, optional)
```

**Invariant:** Safety always runs before cache and before network.

## CORRECT (English correction)

| Stage | Local | Remote | Notes |
|-------|-------|--------|-------|
| Input read | ✓ | | From focused field only |
| Safety | ✓ | | Blocks secrets, sensitive fields |
| Local typo pass | ✓ | | No network |
| Cache | ✓ | | L1/L2; no raw secrets cached |
| Flowlary AI | | ✓ | `https://api.flowlary.com/api/ai/correction` |
| Response | ✓ | | Validated JSON; rendered as text |
| Activity | ✓ | | Bounded list; privacy-gated |

**Remote payload:** Segment of English text (+ optional previous context slice).

**Not stored server-side:** User writing text. Usage metadata (tokens, latency, operation) may be recorded for billing.

## TRANSLATE

| Stage | Local | Remote | Notes |
|-------|-------|--------|-------|
| Manual shortcut | ✓ | | Ctrl/Cmd+Shift+, |
| Live mode | ✓ | | 750ms debounce; default OFF |
| Safety | ✓ | | Before request |
| Cache | ✓ | | |
| Flowlary AI | | ✓ | `https://api.flowlary.com/api/ai/translation` |
| DOM write | ✓ | | |
| Activity | ✓ | | |

**Remote payload:** Text segment, source/target language, mode metadata.

**Provider routing (Phase translation provider):** Free defaults to Google Cloud Translation on the server. Pro non-live requests may refine via Groq after Google. When Google is not configured, the server falls back to Groq. Google credentials never leave the backend.

**Production release URL:** `https://api.flowlary.com` (set automatically in `npm run build:release`).

## FIX_LAYOUT

| Stage | Local | Remote | Notes |
|-------|-------|--------|-------|
| mapLayout | ✓ | | Preferred local path |
| Safety | ✓ | | |
| Cache | ✓ | | Layout classification results |
| Classifier API | | ✓ (fallback) | Flowlary AI layout classification when local mapping insufficient |
| Speed Box | ✓ | | Manual conversion overlay; not recorded in activity |
| Activity | ✓ | | Automatic and shortcut layout fixes only |

**Remote payload:** Word token + minimal context (when classifier used).

## Activity vs learning

| Domain | Store | Purpose |
|--------|-------|---------|
| **Activity** | `flowlary.history` | What Flowlary did (CORRECT, TRANSLATE, FIX_LAYOUT commits) |
| **Learning** | *(future)* | Meaningful language-learning signals — not implemented yet |

Activity is **not** language-learning progress. Translation and layout fixes must not be treated as mistakes.

## Storage & retention

| Namespace | Contents | Retention |
|-----------|----------|-----------|
| flowlary.settings | enable/pause/excluded domains | Until user clears |
| flowlary.correction | mode, consent, highlights | Until user clears |
| flowlary.translation | languages, live/shortcut toggles | Until user clears |
| flowlary.layout | layouts, auto/manual flags | Until user clears |
| flowlary.history | Activity metadata + text snippets | Max 50 entries; user can delete |
| flowlary.cache | Hashed keys; operation results | TTL + LRU eviction |
| flowlary.entitlement | Usage/trial/license cache | Until migration/clear |

Legacy `flowlary.correction.groqKey` from old BYOK installs is cleared on upgrade and is not sent anywhere.

## User controls

- Pause extension globally
- Exclude domains
- Disable live translation (default off)
- Clear activity log
- Enable Flowlary AI (consent for correction and translation)

## Limitations

Flowlary **does** send writing text to Flowlary AI when the user triggers correction, translation, or classifier fallback. Do not claim "no data leaves your device" when those features are used.
