# Flowlary — Final Product Release Report

**Date:** 2026-08-31  
**Evidence basis:** repository implementation, writing-engine unit suite, live provider connectivity, Chromium Playwright with a clean persistent profile loading `extension/dist`.

## FINAL RELEASE STATUS

**PUBLIC BETA**

The product is default-on, user-controlled, and useful on ordinary `input` / `textarea` surfaces. Local writing works without a developer site blacklist. Groq, Gemini, and OpenRouter each returned a valid advisor ranking in a live connectivity check. Contenteditable auto-write is enabled in architecture but is not yet reliable in real Chrome after the first remapped token (caret / bidirectional DOM). Network AI commands (CORRECT / TRANSLATE) were not proven in the extension e2e run because those tests did not exercise a running API against the loaded extension.

This is not PRODUCTION READY: contenteditable composers and third-party rich editors still lose subsequent tokens after the first safe write. It is past PRIVATE BETA: defaults, settings, site exceptions, local layout/English, and provider plumbing are real.

---

## FINAL ARCHITECTURE

```
input events
  → FieldSession (generation, cooldown, pending layout run, overrides)
  → evaluateFieldSafety (user site list, protected fields, code editors, secrets)
  → buildFieldContext (tier 1 value / tier 2 contenteditable / tier 4 blocked)
  → analyze + hypotheses + candidates
  → decideWriting (local, immediately)
  → Write Gate (range, snapshot, neighbor, unfinished token)
  → DOM write
  → advisor consult (async, apply mode, never a DOM writer)
  → re-decide + write only if generation and field text are unchanged
```

Safety mechanisms stay in the write path. They are not site blacklists.

## USER CONTROL MODEL

Default: Flowlary **on**. `excludedDomains` starts empty.

The user can control:

| Control | Where | Persistence |
|---|---|---|
| Global on/off | Popup system status | `flowlary.settings.enabled` |
| Help style: auto / suggestions / shortcuts only | Popup + Settings | `helpStyle` + projected feature flags |
| Layout / English / Arabic→English | Popup + Settings | writing policy |
| AI advisor on/off | Popup + Settings | `aiAdvisorEnabled` (default **true**) |
| Pause / resume **this site** | Popup | `excludedDomains` |
| Site list | Settings textarea | same list |

A site exception is a user preference: add host → off; remove host → on again. Content scripts rehydrate on `flowlary.settings` storage changes.

There is no developer hostname allowlist in the extension safety layer.

## EDITOR SUPPORT MODEL

| Surface | Policy | Chrome evidence |
|---|---|---|
| `input[type=text\|search\|tel]` | Auto-write when safety allows | Pass on lab + `127.0.0.1` fixture |
| `textarea` | Auto-write | Pass for layout, bilingual, protected tokens, offline typing |
| Ordinary `contenteditable` | Auto-write allowed (tier 2) | First token remaps; later tokens / caret still fail in Chrome |
| Code editors (Monaco, CodeMirror, Ace) | Blocked | Unit: `code-region` |
| Password / OTP / secrets / URLs / emails | Blocked or preserved | e2e protected-token pass |
| Same-origin iframe | Allowed | Browser same-origin only |
| Cross-origin iframe | Skipped | Real browser isolation |

`allowsAutomaticFieldWrite` no longer means “value fields only.” Contenteditable is included unless it looks like a code editor.

Chrome `document.execCommand('insertText')` ate the following space and/or moved the caret under RTL. Writes now prefer text-node splice and verify the planned next string. Auto contenteditable writes place the caret after the replacement. That is not yet sufficient for a full multi-word CE session.

## SITE SUPPORT MODEL

- Default: operate wherever the content script can attach.
- User list: `excludedDomains` / `isExcludedHost` (exact host or parent suffix).
- Not a product restriction: code editors, protected tokens, cross-origin frames.
- Popup “Pause on this site” uses the active http(s) tab hostname. Chrome-extension / file pages show an explanation instead of a fake hostname.

Chromium e2e: excluding `127.0.0.1` stopped layout writes; clearing the list restored them (first focused pass). A later rerun collided with an experimental caret change that was reverted to contenteditable-only.

DuckDuckGo was not used as a gate: its search box selector was unstable. Local HTTP + lab fixtures were used for host-control proof.

## INTELLIGENCE PIPELINE

Unchanged in role, used as the real writer:

1. Chunk / tokenize  
2. Layout sequence + pending run across cycles  
3. Hypotheses (layout, English, translate, preserve, override)  
4. Candidates (`eligibleForAuto` requires `capabilities.autoWrite`)  
5. `decideWriting`  
6. Optional LLM rank of existing hypothesis IDs  
7. Write Gate execution  

No example-specific phrase rules were added.

## LLM ROLE

- Production advisor is registered in **apply** mode (`registerProductionHypothesisAdvisor`).
- The input cycle does **not** await the advisor. Local decision writes first.
- A late valid vote may change the decision only if generation and field text still match.
- The advisor never returns replacement text and never writes the DOM.
- `shouldConsultAdvisor` allows editor tiers 1–2 and honors `aiAdvisorEnabled`.
- Strong unique local layout still skips a network call.

## PROVIDER MODEL

Configured failure-only fallback: Groq → Gemini → OpenRouter, then local engine.

Live connectivity (`npm run test:providers`, 2026-08-31):

| Provider | Result | Model | Latency |
|---|---|---|---|
| Groq | WORKING | openai/gpt-oss-20b | 1031ms |
| Gemini | WORKING | gemini-3.5-flash-lite | 908ms |
| OpenRouter | WORKING | openai/gpt-4o-mini | 1296ms |

3/3 returned a valid advisor ranking. This is API-level evidence, not a full in-page advisor-apply session.

## FALLBACK MODEL

Provider failure must not stop typing. Local decide/write continues. Advisor apply is asynchronous. Offline e2e: typing and local layout still worked; URLs/emails stayed intact.

## REAL CHROME RESULTS

Clean profile, unpacked `extension/dist`, Playwright Chromium (headed).

**Passed (representative):**

- Textarea / input obvious layout remap (`اثممخ حمثشسث` → hello please)
- Bilingual repair in one field
- Protected URLs, emails, JWT-like tokens, `sk-` keys
- Rapid typing, selection, reload, offline typing
- Unfinished wrong-keyboard word not rewritten before Space
- Paste (`insertFromPaste`) does not auto-remap
- Popup: site + AI controls after first run; first-win copy
- HTTP fixture layout on `127.0.0.1`
- User site exception + restore (focused pass)

**Failed or incomplete:**

- Contenteditable multi-word auto-remap (logical DOM after first write: remaining garbled tokens, often reordered by bidi)
- Some longer multi-sample subject/email sequences (cooldown / session leftover across `fill('')`)
- CORRECT / TRANSLATE e2e without a live API attached to the extension
- Public DDG selector timeout (harness, not a Flowlary domain block)

Writing-engine unit suite: **20 files passed** including new `user-control-defaults.test.ts`.

## REAL PROVIDER RESULTS

See table above. No keys logged. Advisor remains ID-only ranking through the existing backend contract.

## REAL USER JOURNEY RESULTS

| Step | Result |
|---|---|
| Install / load unpacked | Service worker up |
| First open / onboarding | First-win view; recommended defaults work |
| First / second local correction | Textarea/input yes |
| Mixed language | Intended bilingual text not destroyed; wrong-keyboard spans remapped after completion |
| Technical text | URLs, emails, identifiers preserved |
| Website change (file → http) | Layout works on localhost fixture |
| Popup / settings | Global, features, AI, site pause visible |
| Disable site / return / re-enable | Works on `127.0.0.1` exception list |
| Network loss | Local tools continue |
| AI failure | Local path does not depend on advisor await |
| Long session | Textarea incremental tests pass; CE long session not reliable |

## BUGS FOUND

1. Contenteditable was a permanent auto-write ban (product restriction, not safety).  
2. Advisor apply awaited the network on the typing cycle.  
3. No first-class “this site” control in the popup (list only in Settings).  
4. AI advisor had no user switch (always implicit).  
5. Chrome `insertText` on CE deleted the following space.  
6. After a CE LTR replacement in an RTL-biased field, caret ≤ start so later keystrokes prepended.  
7. Playwright `innerText` / even text-node order can show bidi-reordered CE content.  
8. `fill()` is not paste; treating it as paste hid a real input-source distinction.

## ROOT CAUSES

1. Phase-1 policy treated `contenteditable` as unsupported instead of integrating Write Gate.  
2. Shadow-era `await consultAdvisor` on apply mode blocked input.  
3. Site policy existed in storage but not as a tab-scoped control.  
4. CE write trusted `execCommand` without verifying the planned next string.  
5. `adjustCaret` keeps caret 0 when Chrome reports caret at start after an LTR splice.  
6. Contenteditable bidi node order is not the same as textarea `value`.

## FIXES IMPLEMENTED

- `allowsAutomaticFieldWrite`: value **or** ordinary contenteditable; code editors stay blocked.  
- `buildFieldContext`: `autoWrite` for tiers ≤ 2; `aiAdvisorEnabled` on context.  
- `decideWriting`: no longer noops solely because the editor is not tier 1.  
- Advisor consult is async; apply only if text/generation still match.  
- `aiAdvisorEnabled` default true; popup + settings toggles.  
- `pageHostname` / `pageExcluded` + Pause/Resume this site.  
- `withHostExclusion` for add/remove host preferences.  
- CE write: splice + verify expected text; restore on failure; caret after replacement on CE auto writes.  
- Tests updated away from “CE must never write.”  
- e2e: local HTTP host control; paste uses `insertFromPaste`; first-win reset isolation.

## REGRESSION RESULTS

- Writing-engine unit: pass (including open-token / bilingual incremental).  
- Phase-1 CE write + following-space unit: pass (happy-dom).  
- Chrome CE multi-word: still fail.  
- Textarea layout path: pass when caret-after is CE-only.  
- Providers: 3/3 rank OK.

## PERFORMANCE

- Local decide stays on the input cycle.  
- Advisor is async.  
- Keystroke p95 on textarea e2e previously stayed under 250ms.  
- Provider rank latencies ~0.9–1.3s and must not gate typing (they do not, after the pipeline change).

## SECURITY / PRIVACY

Unchanged and kept:

- Protected-content / token skip  
- Write Gate snapshot, neighbor, stale generation, mutex  
- Advisor packet masking; no replacement field from LLM  
- Secrets not written to telemetry as raw field text  
- Cross-origin frames not processed  
- Text leaves the browser only on opted AI / translation / account paths  

Do not confuse these with site lockouts.

## REMAINING LIMITATIONS

1. **Contenteditable multi-word auto-write in Chrome** — first remap works; continued typing under RTL/LTR mix still mis-places caret or node order. Rich third-party editors (Gmail/Notion/Slack) are not claimed verified.  
2. **AI in the page** — providers work at the API; in-extension CORRECT/TRANSLATE e2e needs a live backend bound to the loaded build.  
3. **Cross-origin iframes** — cannot be assisted; this is a browser rule.  
4. **Code editors** — intentionally skipped.  
5. Longer sequential samples on one `<input>` can miss later words if cooldown retries do not flush after `fill('')`.

## FINAL RELEASE STATUS (repeat)

**PUBLIC BETA**

Ship to users who write in normal form controls, with clear site and feature switches. Do not market “works in every rich composer” until Chrome contenteditable sessions remap the full phrase, not only the first token.
