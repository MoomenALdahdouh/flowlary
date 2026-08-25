# Flowlary Data Flow

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
AI / backend (only if cache miss and operation requires it)
  ↓
Response validation (schema + size bounds)
  ↓
DOM write (writeReplacement)
  ↓
History record (privacy-gated, optional)
```

**Invariant:** Safety always runs before cache and before network.

## CORRECT (English correction)

| Stage | Local | Remote | Notes |
|-------|-------|--------|-------|
| Input read | ✓ | | From focused field only |
| Safety | ✓ | | Blocks secrets, sensitive fields |
| Local typo pass | ✓ | | No network |
| Cache | ✓ | | L1/L2; no raw secrets cached |
| Groq BYOK | | ✓ | `https://api.groq.com/openai/v1/chat/completions` |
| Response | ✓ | | Validated JSON; rendered as text |
| History | ✓ | | Bounded list; privacy-gated |

**Remote payload:** Segment of English text (+ optional previous context slice). User's Groq API key in Authorization header only.

**Not sent to Flowlary servers:** Correction text and Groq keys.

## TRANSLATE

| Stage | Local | Remote | Notes |
|-------|-------|--------|-------|
| Manual shortcut | ✓ | | Ctrl/Cmd+Shift+, |
| Live mode | ✓ | | 750ms debounce; default OFF |
| Safety | ✓ | | Before request |
| Cache | ✓ | | |
| Translation API | | ✓ | Configured base URL + `/api/translate` |
| DOM write | ✓ | | |
| History | ✓ | | |

**Remote payload:** Text segment, source/target language, mode metadata.

**Default dev URL:** `http://127.0.0.1:8004` (override via `VITE_TRANSLATION_API_URL`).

## FIX_LAYOUT

| Stage | Local | Remote | Notes |
|-------|-------|--------|-------|
| mapLayout | ✓ | | Preferred local path |
| Safety | ✓ | | |
| Cache | ✓ | | Layout classification results |
| Classifier API | | ✓ (fallback) | `/api/analyze-word` when local mapping insufficient |
| Speed Box | ✓ | | Manual conversion overlay |
| History | ✓ | | |

**Remote payload:** Word token + minimal context (when classifier used).

## Storage & retention

| Namespace | Contents | Retention |
|-----------|----------|-----------|
| flowlary.settings | enable/pause/excluded domains | Until user clears |
| flowlary.correction | mode, consent, **Groq key** | Until user clears |
| flowlary.translation | languages, live/shortcut toggles | Until user clears |
| flowlary.layout | layouts, auto/manual flags | Until user clears |
| flowlary.history | Operation metadata + text snippets | Max 50 entries; user can delete |
| flowlary.cache | Hashed keys; operation results | TTL + LRU eviction |
| flowlary.entitlement | Usage/trial/license cache | Until migration/clear |

## User controls

- Pause extension globally
- Exclude domains
- Disable live translation (default off)
- Clear history
- Remove Groq key (correction settings)
- BYOK: user supplies own Groq key

## Limitations

Flowlary **does** send writing text to configured remote services when the user triggers correction, translation, or classifier fallback. Do not claim "no data leaves your device" when those features are used.
