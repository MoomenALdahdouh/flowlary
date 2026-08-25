# Flowlary Security Architecture (Phase 13)

Phase 13 documents trust boundaries, defenses, and residual risks. This is **not** a formal penetration test or legal certification.

## Trust boundaries

```
WEB PAGE (untrusted)
  ↓ validated target + safety gate
CONTENT SCRIPT (CommandOrchestrator, features)
  ↓ typed runtime messages + sender check
SERVICE WORKER (background)
  ↓ HTTPS + bounded payloads + response validation
EXTERNAL APIs (Groq, translation, layout classifier)
```

```
WEB PAGE
  ↓ writeReplacement() only
DOM WRITE (controlled origin tags)
```

```
POPUP (extension page)
  ↓ validateExtensionRequest()
SERVICE WORKER
  ↓ tabs.sendMessage(RUN_COMMAND)
CONTENT SCRIPT
```

Every boundary validates message type, payload shape, and bounded string lengths. Unknown types fail closed.

## Threat model (summary)

| # | Threat | Surface | Defense | Residual risk |
|---|--------|---------|---------|---------------|
| 1 | Malicious website | DOM, events | Safety gate; no page JS execution | Page can still show deceptive UI around fields |
| 2 | Malicious page JS | globals, DOM | No eval of page text; module-local state | DOM clobbering of unrelated globals |
| 3 | Compromised third-party page | same as #1 | Safety + excluded domains | User may enable extension on hostile sites |
| 4 | Cross-origin iframe | all_frames | `shouldProcessFrame()` skips cross-origin | Same-origin iframe inherits page trust |
| 5 | Malicious extension message | runtime messaging | `isTrustedExtensionSender` + schema validation | Other compromised extensions cannot spoof same-id |
| 6 | Malformed runtime message | all handlers | `validateExtensionRequest` | Logic bugs in new message types |
| 7 | Stolen Groq key | local storage | Key only in SW; password UI; never logged | Local disk access exposes key |
| 8 | Sensitive text to AI | correction/translate | Safety before network | Heuristic gaps on novel secret formats |
| 9 | Sensitive text in cache | L1/L2 cache | `canCacheValue` / `canCacheText` | Heuristic false negatives |
| 10 | Sensitive text in history | flowlary.history | `canRecordHistory` | Same as cache |
| 11 | Sensitive text in logs | console | No user text logging in product paths | DevTools still visible to user |
| 12 | Prompt injection | model input | System prompt: text is data; JSON output contract | Model may still misbehave |
| 13 | DOM mutation race | async AI | generation + requestSequence + mutex | Extreme timing bugs |
| 14 | Stale AI response | async AI | `canCommit` / stale tickets | Feature-specific edge cases |
| 15 | Feature write collision | FieldSession | Mutex per field | Different fields independent |
| 16 | Host permission abuse | fetch | Fixed config URLs only | localhost dev hosts in manifest |
| 17 | Backend endpoint abuse | API routes | Placeholder backend; extension uses fixed bases | Production API needs rate limits |
| 18 | Local dev endpoint exposure | host_permissions | Documented dev-only localhost entries | Dev build can reach local services |
| 19 | Storage corruption | chrome.storage | normalize* on read/write | Tampered entitlement not cryptographically verified |
| 20 | Malicious cached data | L2 store | Version + privacy gate on read | Corrupted JSON dropped |
| 21 | Unexpected contenteditable | probes | Field probes + safety | Rich editors vary |
| 22 | Code editor modification | Monaco/CodeMirror heuristics | `looksLikeCodeEditor` blocks | Unknown editors |
| 23 | Setting tampering | storage | normalize patches on SET_* | Client-side only |
| 24 | Entitlement manipulation | flowlary.entitlement | normalizeEntitlement fails closed | No server verification in Phase 13 |
| 25 | Message spoofing | extension contexts | sender.id === chrome.runtime.id | N/A for external pages |

## Permissions (manifest)

| Permission | Required | Feature |
|------------|----------|---------|
| `storage` | Yes | Settings, cache, history, entitlement |
| `activeTab` | Yes | Shortcut commands target active tab |
| `clipboardWrite` | Yes | Speed Box copy |

Host permissions:

- `https://api.groq.com/*` — BYOK correction (production)
- `https://flowlary-api.zaixos.com/*`, `https://lingo-api.zaixos.com/*` — production translation/classifier
- `http://127.0.0.1:*`, `http://localhost:*` (8003, 8004, 8787) — **development only**; required for local API testing

Content scripts match `<all_urls>` with `all_frames: true` because embedded same-origin editors (e.g. compose iframes) must be reachable. Cross-origin iframes are skipped at runtime.

## Messaging

Central validation: `extension/src/messaging/validate.ts`

- Known message types only
- Bounded strings via `SECURITY_LIMITS`
- `PIPELINE` explicitly rejected
- Settings patches normalized before persistence

## Safety gate

`evaluateFieldSafety()` runs **before** cache lookup and **before** any AI/network call.

Blocks: password/OTP/payment fields, code editors, markdown fences, excluded domains, JWT/API keys/private keys in field text (token scan).

## DOM / XSS

- AI output rendered via `textContent` / `createTextNode` (CorrectionCard, SpeedBox)
- Static Shadow DOM templates use fixed `innerHTML` for chrome only
- No `dangerouslySetInnerHTML` for model output

## API keys (BYOK Groq)

- Stored in `flowlary.correction` namespace
- Passed only in `Authorization: Bearer` header from service worker
- Never in URLs, logs, metrics, cache, or history

## Storage

Namespaces: `flowlary.settings`, `flowlary.correction`, `flowlary.translation`, `flowlary.layout`, `flowlary.history`, `flowlary.entitlement`, `flowlary.cache`, `flowlary.migrations.*`

All reads pass through `normalize*` helpers. Malformed data falls back to safe defaults.

## CSP

Extension pages: `script-src 'self'; object-src 'self'; base-uri 'self';`

## Residual risks (honest)

1. Client-side entitlement is not tamper-proof without server verification.
2. Public translation/classifier endpoints need production rate limiting (not implemented in Phase 13).
3. Heuristic safety cannot guarantee detection of all secrets.
4. Localhost host permissions remain in shipping manifest for developer workflows.
5. Phase 13 is hardening/review, not independent audit or Chrome Web Store approval.

See also: [DATA_FLOW.md](../privacy/DATA_FLOW.md), [PRIVACY.md](../privacy/PRIVACY.md).
