# Flowlary Privacy

Flowlary processes writing locally in the browser extension. Selected operations may send text to remote AI or backend services **after** the safety gate passes.

## What stays local

- Layout conversion via `mapLayout` (preferred path)
- Settings, entitlement cache, migration state
- Tiered cache (L1 memory + L2 `flowlary.cache`) — privacy-gated; secrets not cached
- Unified history (`flowlary.history`) — privacy-gated; max 50 entries
- Field safety decisions
- DOM writes through controlled `writeReplacement()`

## What may leave your device

| Operation | Destination | When | Data sent |
|-----------|-------------|------|-----------|
| CORRECT (BYOK) | `https://api.groq.com` | After safety; user enabled correction with Groq key | English segment + minimal context JSON |
| TRANSLATE | `https://lingo-api.zaixos.com` | Manual shortcut or live mode (opt-in) | Text, languages, mode |
| FIX_LAYOUT classifier | `https://flowlary-api.zaixos.com` | When local mapping cannot resolve token | Word + short context |

Development builds (`npm run dev` / `npm run build`) may use localhost APIs and include localhost host permissions in `manifest.json`. **Release builds** (`npm run build:release`) use `manifest.prod.json` with HTTPS production hosts only.

## BYOK Groq

- User provides their own Groq API key in popup settings
- Key stored in extension local storage (`flowlary.correction`)
- Key used only in the service worker `Authorization: Bearer` header
- Key is **not** sent to Flowlary servers, logs, metrics, cache, or history

## Safety before network

No correction, translation, or classifier request runs until `evaluateFieldSafety()` allows the field and text.

Blocked categories include: password/OTP/payment fields, code editors, markdown code regions, excluded domains, JWTs, API keys, private keys, and other high-risk tokens.

## Cache

- Keys are derived hashes; values exclude known secrets
- Cache is never transmitted remotely
- User can clear extension data via browser

## History

Records successful CORRECT, TRANSLATE, and FIX_LAYOUT commits when privacy rules allow.

Does **not** record blocked/sensitive content. User can delete entries or clear all history from the popup.

## Storage namespaces

`flowlary.settings`, `flowlary.correction`, `flowlary.translation`, `flowlary.layout`, `flowlary.history`, `flowlary.entitlement`, `flowlary.cache`

## Data retention

- History: bounded (50 entries), user-deletable
- Cache: TTL + LRU eviction
- Settings/keys: until user changes or uninstalls extension

## User controls

- Global pause
- Per-domain exclusions
- Disable live translation (default OFF)
- Clear history
- Remove Groq API key

## Limitations

- This is not a legal privacy certification
- Client-side entitlement is not cryptographically tamper-proof
- Heuristic safety cannot detect every secret format
- Remote services (Groq, translation, classifier) receive text you choose to process

See [DATA_FLOW.md](./DATA_FLOW.md) and [SECURITY_ARCHITECTURE.md](../security/SECURITY_ARCHITECTURE.md).
