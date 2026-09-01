# FLOWLARY — COMPLETE ARCHITECTURE GAP AUDIT

**Date:** 2026-09-01  
**Repository:** `/Users/moomen/Projects/flowlary`  
**Method:** Code-first call-graph trace; unit/integration tests; live provider probe; Playwright Chromium with `extension/dist` loaded.  
**Prior docs:** Secondary. Several 2026-08-26 / 2026-08-31 audits are stale. The previous same-day gap audit was wrong on one product fact: `allowsAutomaticFieldWrite` had been **value-fields only** (CE shortcut/suggestion). This session changed that for **simple** contenteditable only.

**Evidence classes**

| Tag | Meaning |
| --- | --- |
| REAL OBSERVED | Executed in this session |
| AUTOMATED | Vitest in this session |
| CODE TRACE | Reachable path in current source |
| UNVERIFIED | Not executed this session |

---

## 1. Executive Summary

Flowlary’s live typing path is a **local-first unified pipeline**, not three competing writers:

`InputEngine` → `startEnforceCoordinator` → `runFieldCycle` → analyze → hypotheses → `decideWriting` → `UserWritingPolicy` → `commitWriteTransaction` → DOM.

Feature schedulers for layout / correction / translation **do not subscribe as EventBus writers**. They remain for shortcuts, Speed Box, and explicit commands.

**What a daily user actually gets after this session:**

- **Textarea and input:** wrong-keyboard layout remaps, mixed Arabic/English preservation, unfinished-token wait, site exceptions, paste conservative, offline layout. **REAL OBSERVED.**
- **Simple contenteditable (plain text / one wrapping block):** the same two-word layout sequence that previously glued as `helloحمثشسث` now completes as `hello please`. **REAL OBSERVED** (Playwright Chromium, `keyboard.type`).
- **Nested/rich composers:** auto-write stays off; suggestion + shortcut remain. **CODE TRACE + AUTOMATED.** Not a site blocklist.
- **LLM advisor:** wired (content → SW `RANK_HYPOTHESES` → `/api/ai/hypothesis-advisor` → Groq → Gemini → OpenRouter). Ranks hypothesis **IDs**. Does not invent replacement text. Does not block keystrokes. Consulted only on conflict / mixed-risk. **This session did not prove a user keystroke produced an advisor HTTP call.**
- **Live providers (probe, not typing):** Groq `openai/gpt-oss-20b` **3/3 QUOTA_EXHAUSTED**. Gemini `gemini-3.5-flash-lite` **3/3 SUCCESS**. OpenRouter `openai/gpt-4o-mini` **3/3 SUCCESS**. Injected Groq 429 → Gemini **PASS**. Stock `.env.example` still ships fallback **off**.
- **Context** is FieldContext + FieldSession, not a durable session model. **No IndexedDB. No fastText.** Writing personalization does not feed `decideWriting`.
- **Decision engine** is explicit evidence + precedence, not a learned scorer.

**Product verdict:** Flowlary is a **coherent beta writing assistant for ordinary form fields and simple contenteditable**. It is **not** a launchable daily companion across Gmail/Notion/Slack-class editors. Architecture ownership is mostly correct. Remaining product holes: rich-editor adapters, live advisor-in-the-loop proof, Groq quota/contract reliability, incremental protected-token races, session learning, long-session proof.

---

## 2. Current Architecture

```
extension/          MV3 content + SW + popup + dashboard
backend/            Node AI gateway, auth, Paddle, JSON store
packages/shared/    contracts, credits, advisor prompt
website/            marketing + account
tests/              unit, integration, Playwright e2e
```

**Live writing core (enforce mode default after `establishEngineMode`):**

| Owner | File | Role |
| --- | --- | --- |
| Input | `extension/src/core/input/InputEngine.ts` | Sole document listeners |
| Session | `extension/src/core/session/FieldSession.ts` | generation, mutex, cooldown, overrides |
| Editor host | `extension/src/core/dom/editorHost.ts` | simple vs structured CE capability |
| Context | `extension/src/core/engine/context.ts` | FieldContext snapshot |
| Analysis | `extension/src/core/engine/chunks.ts` | chunks, scripts, protected kinds |
| Hypotheses | `extension/src/core/engine/hypotheses.ts` | layout / spell / translate / preserve |
| Decide | `extension/src/core/engine/decide.ts` | one arbitration function |
| Policy | `extension/src/core/policy/writingPolicy.ts` | UserWritingPolicy |
| Write Gate | `extension/src/core/writeGate/writeGate.ts` | `commitWriteTransaction` |
| DOM write | `extension/src/core/dom/write.ts` | value + simple CE |
| Advisor client | `extension/src/core/engine/hypothesisAdvisorClient.ts` | RANK_HYPOTHESES |
| Advisor server | `backend/src/providers/advisorProviderManager.ts` | Groq → Gemini → OpenRouter |

Engine modes: `off` | `internal_shadow` | `enforce`. Production default is **enforce**. Shadow coordinator **must not write**.

---

## 3. Actual Runtime Flow

```
USER KEYSTROKE / PASTE / COMPOSITION / FOCUS-OUT
  → InputEngine (capture-phase document listeners)
  → FieldSession (generation bump unless owned write)
  → EventBus NormalizedInputEvent
        ├─ startEnforceCoordinator  (input, Space/Enter/Tab, focus-out)
        │     → runFieldCycle
        │           analyzeFieldText
        │           collectHypotheses
        │           decideWriting (local; advisorResult unused)
        │           consultAdvisor? (async, abortable, non-blocking)
        │           fulfillWritingDecision → Write Gate
        │           [later] advisor compare; apply only if local abstained
        ├─ startShadowCoordinator   (telemetry only if mode=internal_shadow)
        └─ LayoutScheduler          (Escape → Speed Box only)
  → shortcuts / RUN_COMMAND
        → CommandOrchestrator → safety → mutex → CommandRouter
        → Write Gate (CORRECT | TRANSLATE | FIX_LAYOUT)
```

This **is** the architecture. The prompt’s layer diagram maps onto it; Flowlary does not need a new stack.

**Who owns what (runtime)**

| Question | Owner |
| --- | --- |
| Who receives the keystroke? | `InputEngine` only |
| Who analyzes the field? | `analyzeFieldText` in `runFieldCycle` |
| Who generates hypotheses? | `collectHypotheses` |
| Who scores hypotheses? | Local scores + `decideWriting` precedence |
| Who makes the final decision? | `decideWriting` (local immediately; optional late advisor re-decide) |
| Who can call an LLM? | Advisor rank via SW; translation/correction remotes via SW |
| Who can trigger fallback? | `AdvisorProviderManager` (sequential, failure-only) |
| Who can modify the DOM? | `commitWriteTransaction` → `writeReplacement` (plus shortcut/Speed Box/suggestion accept through the same gate) |
| Who can bypass Write Gate? | No live EventBus bypass. Retired scheduler auto-paths are not writers. |
| Who can cancel a request? | `FieldSession` abort + `CANCEL_RANK_HYPOTHESES` + generation mismatch |
| Who owns user policy? | `writingPolicy.ts` projected onto `stateManager` |
| Who owns editor state? | `FieldSession` + DOM adapters (`editorHost` for write capability) |
| Who owns session state? | `FieldSession` (in-memory per field; lost on navigation) |

---

## 4. Component Inventory

| Area | Status | Evidence |
| --- | --- | --- |
| Extension content script | PRODUCTION READY (value + simple CE) | Playwright this session |
| Backend gateway | BETA READY | HTTP + providers; JSON file store |
| Shared package | PRODUCTION READY | contracts used by both sides |
| Writing engine | BETA READY | enforce pipeline |
| Input engine | PRODUCTION READY | single listener owner |
| Analysis | BETA READY | chunks + roles + protected kinds |
| Hypothesis generation | BETA READY | layout/spell/translate/preserve |
| Decision engine | BETA READY | one function; leftoverLayout now respects `eligibleForAuto` |
| Policy | BETA READY | intent flags + feature projection |
| Write Gate | PRODUCTION READY | generation + mutex + cooldown |
| Advisor | PARTIAL | wired; consult rare; Groq quota this session |
| Groq | WEAK (quota) | probe 3/3 `QUOTA_EXHAUSTED` |
| Gemini / OpenRouter | BETA READY (adapters) | probe 3/3 SUCCESS each |
| Translation | PARTIAL | async fulfill; `runFieldCycle` now awaits the Promise |
| Layout detection | PRODUCTION READY (value + simple CE) | Playwright |
| Spelling | PARTIAL | small map + edit distance |
| Punctuation / capitalization | MISSING as first-class hyps | not generated as types |
| Language detection | PARTIAL | script/role heuristics, no model |
| Context/session | PARTIAL | FieldContext + FieldSession |
| Personalization | PARTIAL | learning dashboard, not writer |
| IndexedDB | MISSING / NOT NECESSARY | no references; reject until measured need |
| Popup / first win | BETA READY | prior Playwright; not re-run every test this session |
| Site controls | PRODUCTION READY | Playwright site exception **REAL OBSERVED** |
| Editor detection | PARTIAL | value vs simple CE vs structured vs code |
| Rich-text adapters | MISSING | structured CE → suggestion/shortcut |
| Background SW | PRODUCTION READY | AI proxy |
| Telemetry | PARTIAL | analytics events; hashed feedback |
| Eval harnesses | PARTIAL | holdout + live probes |
| E2E | BETA READY | CE incremental **PASS**; protected-token sequential **FAIL** this run |
| Config / env | BETA READY | `.env.example` third ranker off by default |
| Schedulers (legacy) | REDUNDANT (retired writers) | start() no-ops as writers |
| Security/privacy | BETA READY | token skip + advisor mask; incremental key typing still weak |
| Build/deploy | BETA READY | Vite succeeded; CE circular-chunk warnings |

---

## 5. One-Writer Analysis

**Target:** ONE WRITER / ONE DECISION PATH / ONE POLICY / ONE WRITE GATE.

| Claim | Reality |
| --- | --- |
| One Write Gate | **YES:** `commitWriteTransaction`. |
| One auto decision path | **YES:** `runFieldCycle`. |
| One user policy | **MOSTLY:** `resolveWritingPolicy` + entitlement overlay. |
| Competing EventBus writers | **NO** on `start()`. |
| Shortcut / Speed Box / suggestion accept | Legitimate second **entries** through the same gate. Keep. |
| Late advisor apply | Guarded: only if `localOutcome` is `noop` or `suggestion`, and no in-flight translation key. **AUTOMATED.** |
| Hidden vetoes | Many reason codes in `decideWriting`. These **are** the decision engine. |
| leftoverLayout vs autoWrite | **Was** a hidden second auto path: leftover layout could return `layout_fix` even when `eligibleForAuto` was false (Write Gate then rejected). **Fixed this session:** ineligible leftover/unique layout becomes **suggestion** (or noop), not a rejected auto-write. |

**Do not remove:** CommandRouter shortcut path, Speed Box, pipeline suggestion accept.  
**Do not resurrect:** EventBus auto-writers.

---

## 6. Input / Safety Analysis

**CODE TRACE + AUTOMATED + REAL OBSERVED (mixed; protected sequential typing failed).**

| Control | Implementation |
| --- | --- |
| textarea / input | `isValueEditable` → auto-write |
| simple contenteditable | `editorHost.allowsAutomaticEditorMutation` → auto-write |
| nested/rich CE | suggestion + shortcut |
| password / sensitive fields | `skipReasonForField` / probe |
| URL, email, JWT, API key, env secret, path, code-id | `tokenKind.ts` on **completed** tokens |
| Code editors | `looksLikeCodeEditor` → deny auto-write |
| Site exclusion | user `excludedDomains` only |
| IME / composition | `composing` → noop |
| Paste / drop | `paste_conservative` → noop **REAL OBSERVED** |

**Gap:** safety is still a **classifier list**. Complete `sk-…` tokens classify as `api-key` **AUTOMATED**. Incremental typing of a long Latin secret **before** the token is finished can still enter layout. Playwright sequential typing of URL/email/JWT/key on `#longform` **FAILED** this session (key span scrambled). Do **not** add magic strings; treat `sk-` / `eyJ` / `http` **prefixes** as protected classes while the token is open.

Protected content is masked before advisor packets when `SENSITIVE_SKIP` kinds appear.

---

## 7. Context Engine

**Classification: PARTIAL.**

Present: fieldId, generation, cycleId, editorTier, capabilities, safety, composing, mutex, translationSessionId, hostname, fieldKind, helpStyle, flags, cooldown, textLength, inputSource, selection, chunks, openToken, layout spans, override ranges.

**Missing as a first-class model:** previous/next sentence, paragraph, typing-direction history, website writing mode, durable session intent.

**Stay in-memory:** caret, composition, mutex, generation, open token, override spans, last layout run.  
**May persist later (chrome.storage, not IndexedDB):** repeated override tokens, site help-style.  
**Reject IndexedDB** until a measured persistence need exists.

---

## 8. Hypothesis Generation

| Type | Generator | Replacement | Writes independently? |
| --- | --- | --- | --- |
| `fix_layout` | layout map | yes | **No** — hypothesis only |
| `fix_english` | spelling / remote stub | sometimes | **No** |
| `translate` | translation segment | no (remote later) | **No** |
| `preserve` / `write_as_is` | protected / correct / override | none | **No** |
| `user_override` | session ranges | none | veto only |
| punctuation / capitalization | — | — | **MISSING** |
| Arabizi / dialect | role flag, usually abstain | — | **PARTIAL** |
| technical interpretation | `technicalTokens` + preserve | — | preserve, not rewrite |

Layout mapping **does not write**. `decideWriting` + Write Gate write.

---

## 9. Local Evidence / Scoring

**PARTIAL — evidence structs + if/else arbitration.**

Kinds: `physical_key_map`, `language_plausibility`, `sequence_agreement`, `mapping_coverage`, `neighbor_context`, lexicon, `short_token`, `script_mix`, `lexicon_en`, `edit_distance`.

`localScore` is heuristic (0–1), not calibrated probability. **Do not add a scoring microservice.** Keep one `decideWriting`.

---

## 10. Language Understanding

| Capability | Status |
| --- | --- |
| Arabic script | YES |
| English | YES |
| Mixed AR/EN | YES on value fields; simple CE now shares the same decide/write path |
| Code switching | PARTIAL (chunk roles) |
| Arabizi | DETECT + usually abstain |
| Dialect | MISSING |
| Token-level language | Script/role, not a classifier |
| Sentence-level language | `dominantOrigin` heuristic |

**Class of the original failure:** incremental mixed-language typing + keyboard-layout ambiguity + unfinished tokens + spelling ambiguity.

That class is handled on **value fields** (unit + Playwright bilingual) and now on **simple CE incremental two-word layout** (**REAL OBSERVED**). It is **not** handled on nested rich editors.

---

## 11. Semantic / Intent Understanding

**MISSING as a layer; correctly not faked.**

The system answers layout/language of tokens more than “what is the user trying to say?” Advisor ranking is the only semantic-ish step and only **orders existing IDs**.

**Reject:** standalone intent-engine service, local semantic model, fourth LLM. Keep hybrid: local for layout/protect/unfinished; advisor when `shouldConsultAdvisor`.

---

## 12. AI Advisor

```
runFieldCycle → shouldConsultAdvisor → consultAdvisor
  → RANK_HYPOTHESES → POST /api/ai/hypothesis-advisor
  → AdvisorProviderManager → validate vote (IDs only)
  → decideWriting(advisorVote) → Write Gate if apply AND local abstained
```

`registerProductionHypothesisAdvisor()` sets **apply** mode. `.env.example` comment updated this session (was claiming shadow).

**Called during real typing?** Only on consult conditions. Strong unique layout does **not** call the advisor. **No keystroke→HTTP proof this session.**

---

## 13–17. Groq / Gemini / OpenRouter / Manager / Fallback

**Live probe** (`tests/e2e/results/provider-probe.json`, 2026-08-31T23:04:48Z UTC):

### Groq

| Item | Value |
| --- | --- |
| Model | `openai/gpt-oss-20b` |
| Max tokens | 512 |
| Results | 3/3 `QUOTA_EXHAUSTED` (90ms, 136ms, 53ms) |
| Request ID | present |

Groq cannot be treated as a reliable first hop **this session** (quota, not only contract). Failures must fall through.

### Gemini

| Item | Value |
| --- | --- |
| Model | `gemini-3.5-flash-lite` |
| Results | 3/3 SUCCESS, 764–1015ms, ~313 in / 27–52 out |
| Request ID | absent on Gemini responses |
| Local productionEnabled | true (this machine’s backend process) |

### OpenRouter

| Item | Value |
| --- | --- |
| Model | `openai/gpt-4o-mini` (local env, not a repo default) |
| Results | 3/3 SUCCESS, 549–1051ms |
| Request ID | present |

### Manager

Sequential. Max 3 providers. No parallel voting. Abort → `STALE_REQUEST` (no fallback). Success returns immediately.

### Fallback

| Event | Evidence |
| --- | --- |
| Injected Groq RATE_LIMITED → Gemini | PASS (`winner=gemini`) |
| Live Groq quota → Gemini in one **user keystroke** | UNVERIFIED |
| All down → local decide | CODE TRACE; Chrome offline layout **REAL OBSERVED** |

**`.env.example` defaults:** `GEMINI_ADVISOR_ENABLED=0`, `OPENROUTER_ADVISOR_ENABLED=0`, `ADVISOR_FALLBACK_ENABLED=0`. A stock deploy is **Groq-only**. This machine’s running API had all three + fallback **on** (process log). Do not confuse local `.env` with shipped defaults.

**No provider blocks typing** on the local path. **AUTOMATED** (`does not await slow advisor`).

---

## 18. Decision Engine

Actions: `layout_fix` | `translation` | `english_correction` | `suggestion` | `noop`.  
Wait/abstain are `noop` + reason codes.

**One function:** `decideWriting`. Provider-specific logic does not live here.

This session: unique strong layout and leftover layout **must** be `eligibleForAuto` to auto-write; otherwise suggestion (if capability exists). That is the one-decision path for rich CE.

---

## 19. User Policy

`UserWritingPolicy`: helpStyle, assistantEnabled, fixWrongTyping, improveEnglish, arabicToEnglishMode, polishAfterTranslate, aiAdvisorEnabled.

Defaults allow work where technically supported. Users can disable globally, per site, per feature. **Playwright site exception PASS this session.**

**Do not** hardcode site blocks. Current code does not.

---

## 20. Write Gate

`commitWriteTransaction`: shadow block, cooldown, stale generation, `writeReplacement`, flash, telemetry.

This session **removed** the CE-only `placeCaretAfter` default that parked the caret **between** the remapped word and its completing space (`hello| حم…` → next letters glue). Value-field and CE caret restore now skip trailing whitespace the same way.

**Classification: PRODUCTION READY** for the contract it implements.

---

## 21. Correction Transaction

Present: generation, write mutex, neighbor guard, stale text check, abortable advisor, cooldown (450ms), override detection.

`runFieldCycle` now **awaits** translation fulfill (`CycleOutcome | Promise<CycleOutcome>`) so TypeScript matches runtime and late-advisor `localOutcome` unwraps after translation.

**Undo on CE:** UNVERIFIED quality.  
**Stale AI:** generation + abort + text check; late apply guarded. Playwright stale A/B race **UNVERIFIED** as a dedicated Chromium test this session (unit stale generation exists).

---

## 22. Personalization

Learning dashboard **does not** feed `decideWriting`. Hashed feedback ring has no writer consumer. One rejection ≠ permanent ban (good).

**Reject** ML personalization service. Optional later: thresholded override memory in `chrome.storage`.

---

## 23. Session Intelligence

`FieldSession` understands this field, generation, cooldown, translation session, recent engine spans, overrides. It does **not** understand “drafting in Gmail, switched to Arabic.”

---

## 24. Editor Intelligence

| Surface | Status |
| --- | --- |
| input / textarea | WORKS **REAL OBSERVED** |
| simple contenteditable | WORKS incremental two-word layout **REAL OBSERVED** |
| nested/rich CE | auto-write off; shortcut/suggestion **AUTOMATED** |
| Gmail / Notion / Slack | UNVERIFIED; no named adapter (structured probe by DOM, not domain) |
| ProseMirror / Lexical / Draft / Quill / Slate | `editorHost` STRUCTURED_HOST → no auto-write |
| CodeMirror / Monaco | blocked as code |
| iframe / shadow DOM | `frameGuard` + target resolve; not a full adapter |

**Do not disable websites.** Capability is by **editor structure**, not host allowlists.

---

## 25. Site Controls

User exclusions only. Playwright verified host exception this session.

---

## 26. Settings

Dashboard + popup; `chrome.storage` + `stateManager`. Site exception persistence **REAL OBSERVED**. Multi-day persistence **UNVERIFIED**.

---

## 27. Onboarding

First Win exists. Not fully re-run this session. Status pill / pause / site off / AI toggle: prior evidence + code.

---

## 28. Privacy / Security

| Path | What leaves the device |
| --- | --- |
| Local layout / spelling | stays on device |
| Advisor | masked snippet + hypothesis metadata **when consulted** |
| Translation / remote English | field segment → backend → provider |
| Telemetry | action/outcome/reason; feedback hashes |

API keys: server `.env` only. `.env.example` empty keys. **Git history secret scan: UNVERIFIED this session.**

---

## 29. Performance

| Measurement | Evidence |
| --- | --- |
| Local analyze+decide < 50ms | AUTOMATED (`product-readiness`) |
| Pipeline does not wait on advisor | AUTOMATED |
| Groq probe | 53–136ms quota errors |
| Gemini rank | 764–1015ms live |
| OpenRouter rank | 549–1051ms live |
| Write cooldown | 450ms |
| CPU / memory / listener growth | UNVERIFIED |

---

## 30. Real Chrome Evidence

Harness: Playwright persistent Chromium, `--load-extension=extension/dist`. Build: Vite succeeded.

| Scenario | Result |
| --- | --- |
| Textarea layout `اثممخ حمثشسث ` | PASS |
| Input layout | PASS |
| **CE incremental `اثممخ ` then `حمثشسث `** | **PASS** (`hello please`; not glued) |
| Fresh-browser `#thread` CE auto layout | **PASS** |
| Protected tokens sequential `#longform` | **FAIL** (API-key span scrambled) |
| Bilingual wrong-keyboard | PASS |
| Rapid type / Space/Enter/Tab / paste / selection | PASS |
| Offline typing | PASS |
| Site exception on/off | PASS |
| Paste no auto-remap | PASS |
| Long session / Gmail / Notion | UNVERIFIED |

---

## 31. Real LLM Evidence

| Claim | This session |
| --- | --- |
| Live Groq rank | NO — quota exhausted |
| Live Gemini rank | YES (probe) |
| Live OpenRouter rank | YES (probe) |
| Extension typing → advisor HTTP | **NO** |
| Injected fallback | YES |
| Live product fallback on typing | UNVERIFIED |
| Provider dashboards | not inspected |

---

## 32. Original Mixed-Language Failure

Historical observed class:  
`مرحبا hello how are you are you ؤخةةهىل خق ىخف نعم hkh rh]l hghk`  
Intended: `مرحبا hello are you comming or not نعم انا قادم الان`

**Do not patch that string.** Value-field bilingual e2e **PASS**. Simple CE incremental layout **PASS**. Nested composers still out of auto-write scope.

---

## 33. Long Session Evidence

**UNVERIFIED.** No multi-hour run.

---

## 34. Bugs Found

1. **CE incremental layout glue** (`helloحمثشسث`) — caret parked before trailing space + CE auto disabled as a product patch. **Root-caused and fixed this session. Playwright PASS.**
2. **leftoverLayout ignored `eligibleForAuto`** — Write Gate reject instead of suggestion. **Fixed.**
3. **`fulfillWritingDecision` returned a Promise while typed as a string** — **Fixed** (await + `CycleOutcome`).
4. **Groq quota** — 3/3 probe failures. **REAL OBSERVED.**
5. **Incremental protected-token typing** — sequential `#longform` scrambled `sk-…`. **REAL OBSERVED.** Class: open technical token + overlapping layout writes. Not a one-word patch.
6. **Advisor on unsigned-in installs** — entitlement deny; local engine continues.
7. **Personalization unwired** to decide.
8. **Stock production flags** disable Gemini/OpenRouter/fallback.
9. **Vite circular chunk warnings** on learning re-exports.
10. **Keystroke→LLM** still unproven.

---

## 35. Root Causes

1. CE glue: Write Gate forced `placeCaretAfter` on auto CE, inserting the next word *before* the completing space. Disabling CE auto-write hid the bug instead of fixing caret ownership.
2. Groq: quota (this session) plus known contract flakiness on `gpt-oss-20b`.
3. Protected tokens: classifiers fire on **completed** tokens; incremental Latin secrets look like layout-mismatch English.
4. Context/personalization: learning stack never connected to `decideWriting`.
5. Editor story: one generic CE writer; structured hosts need adapters, not domain denylists.

---

## 36. Fixes Implemented (this session)

1. **`editorHost`:** simple CE may auto-write; structured/code may not. Not a site list.
2. **CE write:** logical offsets match text-node concatenation; caret skips completing whitespace (same as value fields); stop CE-only `placeCaretAfter`.
3. **Decision:** unique/leftover layout respects `eligibleForAuto` → suggestion on rich CE.
4. **Pipeline:** await translation fulfill; `CycleOutcome` typing.
5. **Tests:** unit (simple vs nested CE, caret/space, `runFieldCycle` on CE); Playwright incremental CE + thread auto-write.
6. **`.env.example`:** advisor apply comment matches `registerProductionHypothesisAdvisor`.
7. **Live probe** written to `tests/e2e/results/provider-probe.json`.
8. **Extension built**; Chromium executed.

**Not fixed:** rich-editor adapters; Groq quota; sequential protected-token race; personalization→decide; keystroke→advisor HTTP proof; long session.

---

## 37. Architectural Changes

No new product layers. No fastText. No IndexedDB. No parallel voting.

**Kept (matches the repo):**

```
USER → Input/Safety → FieldContext + FieldSession
  → Hypothesis orchestrator → Local evidence + decideWriting
  → Advisor ranks IDs when needed (Groq → Gemini → OpenRouter)
  → UserWritingPolicy → Write Gate → DOM → Feedback hook
```

**Added:** editor-host capability split (simple vs structured).  
**Rejected:** extra writer, extra policy, local semantic service, IDB, site denylist, LLM-first rewrite, disabling CE globally.

---

## 38. Remaining Gaps (priority)

1. Incremental **technical-token** class (open `sk-` / `eyJ` / URL prefixes) so sequential typing cannot layout-map secrets.
2. Prove one typing cycle hits `/api/ai/hypothesis-advisor` (request id in writing analytics, no snippet).
3. Enable Gemini + OpenRouter + fallback in **staging** (or accept Groq-only outages). Groq is quota-dead here.
4. First real structured-editor adapter (Gmail-like nested CE fixture → suggestion quality, then write adapter).
5. Thresholded override learning into scores (n≥k).
6. Multi-hour memory/listener test.
7. Dedicated Chromium stale A/B advisor race (unit exists).

---

## 39. Production Readiness

| Question | Answer |
| --- | --- |
| Can a real user install it? | Yes (`extension/dist`) |
| Type normally on textarea/input? | Yes |
| Simple contenteditable? | Yes (incremental layout **REAL OBSERVED**) |
| Arabic and English? | Yes (value + simple CE) |
| Mid-sentence switch? | Yes (value bilingual e2e) |
| Keyboard-layout mistakes? | Yes |
| Spelling mistakes? | Small local set; else suggestion |
| Paste? | Conservative noop |
| Move cursor / edit previous? | Usable; override ranges exist |
| Long sessions? | UNVERIFIED |
| Real websites / rich editors? | UNVERIFIED / structured CE no auto-write |
| AI invoked from typing? | Wired; not proven |
| Providers fail without breaking writing? | Yes (local path) |
| Fallback work? | Injected yes; live typing UNVERIFIED; Groq quota yes as a failure mode |
| User control / per-site disable? | Yes |
| Learn from behavior? | Dashboard only |
| Protect URL/email/keys/code? | Complete-token classifiers yes; sequential typing **FAIL** this run |
| Responsive? | Yes locally |
| Recover from network? | Layout yes |
| Stale AI discarded? | Generation + abort + late-apply guard |
| Survive repeated real-world use? | UNVERIFIED |

**Not production-ready as a daily-use product across the web.**  
**Beta-ready as a layout-aware assistant on standard form fields and simple contenteditable, with fallback providers enabled in the deployed API.**

---

## 40. Exact Next Steps

1. Reproduce sequential `#longform` secret scramble as a **unit** (open `sk-` prefix class), then generalize prefix protection — no site/word patches.
2. Log advisor `requestId` / provider / fallback on writing analytics; capture one live typing consult.
3. Staging: Gemini + OpenRouter + fallback on; Groq may be quota-empty.
4. Gmail-like nested fixture: suggestion path, then a write adapter if structure is stable.
5. Thresholded override memory.
6. Multi-hour session.
7. Stop writing audits that contradict `startWritingRuntime.ts` and `editorHost.ts`.

---

## Layer Gap Matrix

| Layer | Current vs required | Class |
| --- | --- | --- |
| L0 Input/Safety | Single input owner; token/field safety; prefix class still weak while typing | BETA READY |
| L1 Context | Snapshot, not a context engine | PARTIAL |
| L2 Hypothesis generation | Layout/spell/translate/preserve | BETA READY |
| L3 Local evidence/scoring | Evidence + precedence | BETA READY |
| L4 Language understanding | Script/mixed heuristics | BETA READY (value + simple CE) |
| L5 Semantic/intent | Advisor rank only | PARTIAL — extra layer REJECTED |
| L6 AI Advisor | Wired, rare, rank-only | PARTIAL |
| L7 Decision arbitration | One function; eligibleForAuto honored | BETA READY |
| L8 User policy | Intent + features | BETA READY |
| L9 Write Gate | Central; CE caret ownership fixed | PRODUCTION READY |
| L10 Correction transaction | Generation/mutex; translation awaited | BETA READY |
| L11 Personalization | Learning UX, not writer | PARTIAL |
| L12 Session intelligence | Per-field memory | PARTIAL |
| L13 Editor intelligence | Value + simple CE; structured hosts gated | PARTIAL |
| L14 Provider infrastructure | Three adapters + manager | BETA READY (Groq quota WEAK) |
| L15 Telemetry/evaluation | Events + probes; no long-session | PARTIAL |
| L16 Product UX | Popup/first-win/site controls | BETA READY |

---

## Architecture Compatibility Check

The prompt’s target stack is **not automatically correct**. It was checked against this repo.

| Proposal | Current Flowlary support | Compatibility | Conflicts | Required changes | Recommendation |
| --- | --- | --- | --- | --- | --- |
| Input / Safety | InputEngine + tokenKind + autoWrite | FULLY COMPATIBLE | None | Prefix-class for open secrets | KEEP / tighten |
| Context + Session + Editor | FieldContext + FieldSession + editorHost | COMPATIBLE WITH MODIFICATIONS | “Context engine” as new service | None | MERGE into existing types; **do not** add a service |
| Hypothesis orchestrator | `collectHypotheses` | FULLY COMPATIBLE | None | None | KEEP |
| Local evidence / scoring | hypothesis scores + decideWriting | FULLY COMPATIBLE | Statistical scorer would duplicate | None | KEEP rules; **reject** scorer service |
| Semantic / intent when required | Advisor rank only | PARTIALLY COMPATIBLE | New intent layer duplicates advisor | None | **REJECT** extra layer |
| AI Advisor Groq→Gemini→OpenRouter | AdvisorProviderManager | FULLY COMPATIBLE | None | Staging flags on | KEEP |
| Decision arbitration | `decideWriting` | FULLY COMPATIBLE | leftoverLayout vs gate (fixed) | None | KEEP |
| UserWritingPolicy | writingPolicy.ts | FULLY COMPATIBLE | Unscoped settings leftovers | None | KEEP |
| Write Gate | commitWriteTransaction | FULLY COMPATIBLE | CE caret default (fixed) | None | KEEP |
| Correction transaction | FieldSession + pipeline | COMPATIBLE WITH MODIFICATIONS | Translation Promise typing (fixed) | None | KEEP |
| Personalization | dashboard only | NOT CURRENTLY SUPPORTED (writer) | Connecting one-shot rejects | Threshold n≥k later | ADD later, not now |
| Editor adapters | generic CE + editorHost | PARTIALLY COMPATIBLE | Named Gmail adapter vs structure probe | Adapter interface later | ADD adapters; **reject** site blocks |
| fastText / local ML | absent | NOT NECESSARY | Would fight script heuristics | None | **REJECT** |
| IndexedDB | absent | NOT NECESSARY | chrome.storage exists | None | **REJECT** |
| Parallel provider voting | absent (correct) | FULLY COMPATIBLE | Voting would conflict with sequential manager | None | **REJECT** voting |

**Is the proposed architecture compatible with the current Flowlary project?**  
**Yes — COMPATIBLE WITH MODIFICATIONS.** It is essentially the architecture **already implemented**. Forcing a greenfield “layer cake” rewrite would **conflict** with `runFieldCycle` ownership.

| Bucket | Components |
| --- | --- |
| Compatible | InputEngine, hypotheses, decideWriting, Write Gate, policy, sequential providers, rank-only advisor |
| Partially compatible | Context depth, editor adapters, advisor apply rarity, safety prefix class |
| Conflicting (if forced new) | Second writer, second policy, LLM-first rewrite, site denylist, parallel voting |
| Missing | Rich-editor write adapters, writer-side personalization, punctuation hyps, keystroke LLM proof |
| Unnecessary | fastText, IndexedDB, intent microservice, scoring microservice |
| Redesign | Incremental technical-token protection (class, not list growth) |
| Implement directly | Advisor cycle telemetry; staging fallback flags |
| Require migration | Named rich-editor write adapters (new adapter interface, same Write Gate) |

**PROPOSED ARCHITECTURE vs ACTUAL FLOULARY ARCHITECTURE:** they match. Actual adds editor-host capability and local-first timing (advisor never on the keystroke). Do not replace this with a new orchestrator.

---

## Final Decision Table

| Bucket | Items |
| --- | --- |
| **WHAT WE HAVE** | InputEngine, enforce pipeline, hypotheses, decideWriting, Write Gate, UserWritingPolicy, site exceptions, local layout, simple CE auto-write, protected-token skip on complete tokens, advisor rank path, Groq/Gemini/OpenRouter adapters, sequential fallback manager, popup/account |
| **WHAT WE DO NOT HAVE** | fastText, IndexedDB, rich-editor write adapters, sentence-level intent model, writing-decision personalization, proven keystroke→LLM, long-session proof, punctuation/capitalization hyps |
| **WHAT IS WEAK** | Groq quota/contract, default-off fallback in `.env.example`, context depth, incremental secret typing, structured CE |
| **WHAT IS REDUNDANT** | Retired EventBus scheduler writers, shadow coordinator in production enforce, stale audits |
| **WHAT MUST BE ADDED** | Open-token technical prefix class; staging fallback on; advisor cycle telemetry; first structured-editor adapter |
| **WHAT MUST BE REBUILT** | Nothing on the live auto path. Incremental secret handling is an algorithm fix inside token/chunk roles, not a new engine. |
| **WHAT MUST BE REMOVED** | Nothing on the live auto path. Do not remove shortcuts/Speed Box. |
| **WHAT CAN STAY AS-IS** | Input ownership, Write Gate, local-first decide, rank-only advisor, user site exclusions, no hardcoded site blocklist, no LLM-first rewrite |

---

## Scores (evidence-backed only)

| Score | 1–10 | Why |
| --- | --- | --- |
| Architecture | **8** | One pipeline, one gate, one policy, simple vs structured CE. Translation typing and secret prefixes remain holes. |
| Product completeness | **6** | Form fields + simple CE + marketing/account. Not full-web. |
| Daily-use reliability | **5** | CE glue class fixed; Groq quota; protected sequential FAIL; no long session. |
| Intelligence | **5** | Strong layout heuristics; weak semantics; advisor rarely in the loop. |
| Browser compatibility | **6** | Value + simple CE proven; named rich editors absent. |
| LLM integration | **5** | Gemini + OpenRouter live ranks; Groq 0/3; typing path unproven. |
| User experience | **6** | Site controls work; CE now helps on simple composers; sequential secret scramble would destroy trust. |

**Launchable as a genuinely daily product?** **No.**  
**Launchable as a limited beta on standard fields and simple contenteditable?** **Yes, if the deployed API has fallback providers on and Groq quota is not the only hop.**
