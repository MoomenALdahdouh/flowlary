# Safety

Every rule below is implemented in `extension/src/core/safety`, `tokenKind.ts`, `FieldSession`, Write Gate, or review island skip. None of these is optional “nice to have.”

| Mechanism | Protects | Why | When it triggers |
| --- | --- | --- | --- |
| `evaluateFieldSafety` | Secrets, wrong field types, excluded hosts | Do not rewrite passwords or user-blocked sites | Password, email-as-secret probe, excluded domain → no cycle writes |
| Token skip (JWT, API key, Bearer, URL, email, hash, card, env) | Credentials and identifiers | Models and layout must not “fix” secrets | Chunk `protectedKind`; review **skips whole field** for JWT/key/URL/email/… |
| Incomplete prefixes (`eyJ`, `sk-`, `https:`) | Mid-typing secrets | Sequential typing must not layout-map a key | `incompleteProtectedReason` |
| Code editor detect | Source code | Not a prose field | Tier 4, no auto-write |
| Markdown fence | Fenced code in CE | Do not remap code blocks | Safety probe |
| Paste / drop | Foreign blobs | Auto layout/review would clobber pasted text | `inputSource` paste/drop |
| Composition | IME | Partial glyphs | `composing` |
| Open token | Unfinished word | Do not rewrite while typing the word | Caret inside token; review skip if overlap |
| Generation + abort | Stale AI | User kept typing | `bumpGeneration` aborts review/advisor |
| Mutex | Concurrent writers | One origin at a time | `tryAcquireWrite` |
| Cooldown 450ms | Write storms | After auto-write | `enterCooldown` |
| User override ranges | Re-typed corrections | User is authority | Overlap → no auto English/layout |
| Personal layout exceptions | Tokens the user marked “don’t remap” | Shortcut `FIX_LAYOUT` and auto analysis (`inExceptionList`) | Token left unchanged |
| Site exceptions | User choice | Not a vendor denylist | `excludedDomains` |
| Undo | User recovery | `execCommand insertText` | Write Gate |
| Snapshot / neighborGuard | DOM races | Text moved | Write rejected stale |
| AI packet bounds | Prompt injection / size | Max snippet 400 review; advisor ID-only | Parser `forbidden_field` |
| Shadow coordinator | Dual-run | Observe without write | `engineOriginated` blocked in shadow |

## Cross-origin iframe

Content script `all_frames` still **skips cross-origin** frames. Same-origin iframes inherit page trust.

## Logging

`writingAnalytics` / `writeTelemetry` store **reason codes, origins, timings** — not raw field text. Do not add `console.log` of field contents in production paths.
