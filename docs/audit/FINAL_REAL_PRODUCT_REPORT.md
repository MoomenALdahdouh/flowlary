# Final Real Product Report

**Date:** 2026-08-31  
**Repository:** `/Users/moomen/Projects/flowlary`  
**Goal:** Make the installed extension behave correctly under continuous mixed-language typing — not produce another architecture audit.

Evidence classes used below:

- **REAL OBSERVED** — executed in this session (Chrome, live HTTP, or a field cycle that wrote the DOM).
- **AUTOMATED TEST EVIDENCE** — Vitest / Playwright assertions.
- **UNVERIFIED** — not executed here, or only documented previously.

---

## REAL USER JOURNEY

Install the built `extension/dist` in Chromium → open a normal text field → type Arabic, English, and mixed text with the mistakes people actually make → keep typing after a fix → reload → open the popup.

**REAL OBSERVED (Playwright + loaded extension):** that journey works for textarea/input writing, protected tokens, bilingual wrong-keyboard repair, intended mixed prose (not destroyed), unfinished words (not rewritten before Space), offline typing, reload, and correction cue.

**UNVERIFIED:** daily use across days, Gmail/Notion/Slack composers beyond the contenteditable no-auto-write policy, signed-in account/subscription screens with a real user session.

---

## REAL CHROME RESULTS

Harness: Playwright persistent Chromium, `--load-extension=extension/dist`, fixture `tests/e2e/fixtures/writing-lab.html`.

| Scenario | Browser result | Class |
|---|---|---|
| Service worker loads | PASS | REAL OBSERVED |
| Textarea layout (`اثممخ حمثشسث ` → hello please) | PASS | REAL OBSERVED |
| `<input>` layout | PASS | REAL OBSERVED |
| Contenteditable: no auto-write | PASS (field kept garbled Arabic) | REAL OBSERVED |
| URL / email / JWT / API key intact | PASS | REAL OBSERVED |
| Bilingual garbled sentence → `comming or not` + `انا قادم الان` | PASS | REAL OBSERVED |
| English-on-Arabic inside Arabic | PASS | REAL OBSERVED |
| Arabic-on-English inside English | PASS | REAL OBSERVED |
| Mixed Arabic + API + URL + email not destroyed | PASS | REAL OBSERVED |
| Rapid typing, Space/Enter/Tab, paste, selection | PASS | REAL OBSERVED |
| Type immediately after a correction | PASS | REAL OBSERVED |
| Offline typing + layout still applies | PASS | REAL OBSERVED |
| Page reload still types | PASS | REAL OBSERVED |
| **Intended mixed sentence not layout-destroyed** | PASS | REAL OBSERVED |
| **Unfinished `ؤخةةهىل` not rewritten; Space then `comming`** | PASS | REAL OBSERVED |
| Popup first-run | PASS in isolation; **flaky** in the full file (shared profile) | REAL OBSERVED |
| Long multi-hour session | UNVERIFIED | UNVERIFIED |
| Gmail / Notion / Slack | UNVERIFIED (policy: no CE auto-write) | UNVERIFIED |

Full-file Playwright this session: **17 passed**, popup failed once on a shared profile; isolated popup re-run **passed**.

---

## REAL PROVIDER USAGE

Advisor **apply remains shadow**. Local engine does not wait on an LLM. Providers rank hypotheses only.

### GROQ

| Item | This session |
|---|---|
| Model | `openai/gpt-oss-20b` |
| Max tokens | 512 |
| Live probe | 2/3 SUCCESS, 1/3 `CONTRACT_FAILURE` |
| Success usage | 414/479/893 (reasoning 441) @ 872ms; 414/295/709 (reasoning 257) @ 681ms |
| Request ID | present |
| Connectivity one-shot | `CONTRACT_FAILURE` @ 972ms |

**REAL OBSERVED:** Groq can complete the advisor contract and can also fail the contract on the same model/budget. Failures must fall through; they must not write.

### GEMINI

| Item | This session |
|---|---|
| Model | `gemini-3.5-flash-lite` |
| Live probe | 3/3 SUCCESS |
| Usage | ~313 in / 27–54 out, 753–991ms |
| Connectivity | WORKING @ 1075ms |

**REAL OBSERVED:** Gemini returns ranked IDs and usage.

### OPENROUTER

Local env has `OPENROUTER_ADVISOR_MODEL=openai/gpt-4o-mini` (not invented in code; no repo default).

| Item | This session |
|---|---|
| Model | `openai/gpt-4o-mini` |
| Live probe | 3/3 SUCCESS |
| Usage | 323 in / 37–38 out, 579–1313ms, request ID present |
| Connectivity | WORKING @ 1019ms |

**REAL OBSERVED:** OpenRouter ranking works when that model is set. Production flags in `.env.example` still default the third ranker **off**.

---

## REAL FALLBACK EVENTS

| Event | Result | Class |
|---|---|---|
| Injected Groq `RATE_LIMITED` → Gemini success | PASS (`winner=gemini`, `fallbackUsed`) | AUTOMATED / injected, not a live 429 |
| Live Groq contract fail → automatic Gemini in the same user keystroke | UNVERIFIED this session | UNVERIFIED |
| All providers down → local engine continues | Prior closure + architecture (shadow advisor) | AUTOMATED / prior |

---

## LOCAL FALLBACK EVENTS

**REAL OBSERVED (Chrome offline):** layout still applied; typing continued; URLs/emails after a layout fix stayed intact.

**AUTOMATED:** when the advisor is unused/unavailable, `decideWriting` keeps the local winner.

---

## LLM ADVISOR TRIGGERS

`shouldConsultAdvisor` still requires conflicting write hypotheses or multiple `needsLLM` items. Strong unique layout does not call the advisor.

**REAL OBSERVED:** live provider HTTP from the probe/connectivity scripts (advisor packet contract).

**UNVERIFIED:** a specific Chrome keystroke in this session that waited on / displayed an advisor rank (apply is shadow; UI must not name providers).

---

## LLM REQUEST COUNT

This session (probe + connectivity, not extension traffic):

- Groq: 1 connectivity + 3 probe = **4**
- Gemini: 1 + 3 = **4**
- OpenRouter: 1 + 3 = **4**
- Injected fallback manager: **1** (fake providers)

Extension content-script advisor calls during Playwright: **UNVERIFIED** (not traced in SW logs this session).

---

## TOKEN USAGE

See tables above. Groq reasoning can exceed 400 tokens inside a 512 completion budget — that is the likely `CONTRACT_FAILURE` class.

---

## LATENCY

| Path | Observation | Class |
|---|---|---|
| Groq advisor | 681–972ms | REAL OBSERVED |
| Gemini advisor | 753–1075ms | REAL OBSERVED |
| OpenRouter advisor | 579–1313ms | REAL OBSERVED |
| Chrome keystroke (extension) | e2e `pressSequentially` delays 8–25ms; no user-visible freeze reported by tests | AUTOMATED / coarse |
| Perceptible typing jank | UNVERIFIED (no DevTools input-delay profile this session) | UNVERIFIED |

Advisor work is async/shadow. Typing does not await it.

---

## WRITING ACCURACY OBSERVATIONS

### The failure class

Intended evolving sentence:

`مرحبا hello are you comming or not نعم انا فادم الان`

Previously seen corruption:

`مرحبا hello how are you are you ؤخةةهىل خق ىخف نعم hkh rh]l hghk`

That string is **bidirectional layout remap of mixed spans**, not a single-token typo. Static snapshot of the *intended* sentence already voted `as_is`. The damage happened **while text was still being typed**:

1. Every `input` event ran a full field cycle.
2. An unfinished token at the caret was treated as a finished word (`allowActiveEdit` + caret-at-end).
3. After the first remap, later tokens lost sequence context (they sat next to *already correct* English/Arabic and were isolated).
4. Trailing English `.` was treated as an Arabic physical key (`punctKeyed`), so `know.` looked like a layout error and blocked instant spelling.

### MIXED-LANGUAGE RESULTS

| Case | Result | Class |
|---|---|---|
| Intended mixed sentence typed char-by-char | Preserved (`comming`, `فادم`, no `ؤخةةهىل` / `hkh`) | REAL OBSERVED + AUTOMATED |
| Garbled bilingual sentence after spaces | Repairs both runs | REAL OBSERVED + AUTOMATED |
| `أنا عملت deploy لكن فيه error` | No layout write | AUTOMATED |
| Isolated `في` next to English | Preserved | AUTOMATED |

### PROTECTED-CONTENT RESULTS

https prefixes, URLs, emails, JWT, `sk-` keys: **PASS** in Chrome e2e after earlier scheme protection. Incremental `https` / `https:` not remapped in unit tests.

### CURSOR / SELECTION RESULTS

Layout writes leave a usable caret (e2e asserts `selectionStart > 0`). Middle-of-field selection/paste covered by the rapid-typing e2e.

**UNVERIFIED:** every contenteditable caret map after a rejected auto-write.

### RACE / STALE RESULTS

Write Gate now checks generation, optional neighbor guard (12 chars each side), and `requireCompletedToken` on the auto pipeline. Stale advisor apply remains generation-aborted.

**UNVERIFIED:** a live stale advisor HTTP response racing a newer keystroke in Chrome this session.

### OFFLINE RESULTS

Chrome `setOffline(true)`: typing + local layout + flash cue. **REAL OBSERVED.**

---

## UI RESULTS

- First-win copy explains wrong-keyboard → `hello` without provider names. **REAL OBSERVED.**
- After save, home renders even when the popup is opened as a tab (removed `domain &&` gate). **REAL OBSERVED** (isolated popup test).
- Full-file popup test still raced once. **Treat as remaining flake.**
- Settings / entitlement / signed-in account chrome: **UNVERIFIED** with a real account this session.

---

## BUGS FOUND

1. **P0 — Unfinished token treated as final.** Coordinator runs on every `input`. Five-letter layout maps became auto-writes mid-word (`ؤخةةه` → English), then the user kept typing on the old keyboard.
2. **P0 — Sequence forgotten after the first write.** `ؤخةةهىل خق` remapped to `comming or`, then `ىخف` sat isolated beside English and was left as garbage. Same for `hkh` → `انا` then `rh]l`.
3. **P1 — Pending run cleared on trailing space.** `getPendingLayoutRun` used `/^\s*\S*$/`, which fails on `" word "`.
4. **P1 — Isolated misspelled English-on-Arabic (`comming`) stayed medium.** Source Arabic plausibility blocked low risk even with full-key coverage.
5. **P1 — Isolated Latin→Arabic over-triggered** (`nightly` → Arabic). Long-token low-risk must not apply to en→ar without a lexicon hit.
6. **P1 — Sentence-final `.` counted as Arabic-key punctuation**, so `know.` became a layout span and instant-spell (`dont` → `don't`) no-oped.
7. **P2 — Popup home required `domain`**, so a completed first-win on a non-page tab could render an empty main.

---

## ROOT CAUSES

The engine decided **each snapshot as a finished field**, not a growing utterance.

- Open token (caret inside or at end without a boundary) was eligible for auto-write.
- Layout sequence lived only inside one `inferLayoutSpans` call. A successful write turned the previous run into as-is neighbors, which *isolated* the next wrong-keyboard word.
- `punctKeyed` used any `[]';,./\`` character, including English period.

Not a missing example string. Not a provider bug.

---

## FIXES IMPLEMENTED

| Change | Where |
|---|---|
| Open-token range; unfinished tokens excluded from committed layout spans | `layoutSequence.ts`, `chunks.ts` |
| Analyze/pipeline pass `caret` + `commitOpenToken` (blur) | `pipeline.ts`, `enforceCoordinator.ts`, `FieldSession` |
| Pending layout run across cycles (same direction, whitespace-only gap) | `FieldSession`, `inferLayoutSpans` scoring |
| Write Gate: neighbor guard + `requireCompletedToken` on auto pipeline | `editor.ts`, `writeGate`/`pipeline.ts` |
| Isolated ar→en long full-coverage maps can be low risk | `scoreSpan` |
| Isolated en→ar without lexicon stays medium | `scoreSpan` |
| Title-case / structural tokens vote `protected` | `evaluateToken` |
| `punctKeyed` ignores `word.` / `word?` English trail | `scoreSpan` |
| `hasLayoutSuspicion` / chunk covering use **low-risk** spans | `chunks.ts` |
| Popup home after first-win without `domain &&` | `App.tsx` |
| Regression tests for incremental typing + intended sentence | `incremental-open-token.test.ts`, bilingual + e2e |

Advisor apply mode **unchanged** (shadow). Legacy layout/correction/translation schedulers remain gated off when enforce is on.

---

## REGRESSION TESTS

- `tests/unit/writing-engine/incremental-open-token.test.ts` (new)
- Updates in `bilingual-keyboard-mix.test.ts`, `extension-writing.spec.ts`
- Existing foundation / N3 / N4 / product-readiness suites kept green after the punctKeyed and suspicion fixes

---

## BUILD RESULT

`npm run build:ext` — **PASS** (2026-08-31). Load `extension/dist` only.

---

## TEST RESULTS

| Suite | Result | Class |
|---|---|---|
| Writing-engine cluster (incremental, bilingual, N3, N4, foundation, product-readiness, phase1) | PASS (119) | AUTOMATED |
| Full `extension` `npm test` | 31 failed / 1510 passed **before** punctKeyed + write-gate scoping; **not re-run in full** after those fixes | UNVERIFIED as a whole |
| Playwright writing e2e | 17/18 then popup isolated PASS | REAL OBSERVED |
| Provider connectivity | Gemini + OpenRouter WORKING; Groq one-shot CONTRACT_FAILURE | REAL OBSERVED |
| Live advisor probe | Groq 2/3, Gemini 3/3, OpenRouter 3/3 | REAL OBSERVED |

---

## REMAINING ISSUES

1. Groq `gpt-oss-20b` at 512 tokens is **usually** contract-valid but **not always** (reasoning spikes). Local engine must stay authoritative — it does.
2. Full extension Vitest file set was not re-run after the last two fixes (cost: ~3 minutes). Writing-engine cluster was.
3. Popup first-run e2e is **timing-sensitive** on a shared persistent profile.
4. Live 429 Groq → real Gemini in Chrome was **not** reproduced this session (injected manager test only).
5. Advisor apply is still shadow — users feel local decisions, not ranked LLM writes.
6. Contenteditable / rich composers: auto-write remains blocked by policy; not product-complete there.
7. Multi-hour daily session: **UNVERIFIED**.
8. Do not commit `backend/.env`. Rotate any key that has ever been checked in.

---

## REQUIRED SCENARIO CHECKLIST

| # | Scenario | Verdict | Evidence |
|---|---|---|---|
| 1 | Arabic sentence | PASS | Chrome + unit |
| 2 | English sentence | PASS | Chrome |
| 3 | Arabic + English | PASS | Chrome intended-mix |
| 4 | Arabic keyboard → English | PASS | Chrome |
| 5 | English keyboard → Arabic | PASS | Chrome |
| 6 | Spelling (`dont`) | PASS | Unit N3 (after punctKeyed) |
| 7 | Layout error | PASS | Chrome |
| 8 | Layout + spelling together | PARTIAL | Sequence layout PASS; combined live Chrome UNVERIFIED |
| 9 | Punctuation | PASS | Unit + `know.` guard |
| 10 | Capitalization | PASS | Foundation short-pair |
| 11 | Unfinished word | PASS | Chrome + unit |
| 12 | Multiple errors in one sentence | PASS | Bilingual Chrome |
| 13 | Mixed + technical English | PASS | Chrome |
| 14 | URL | PASS | Chrome |
| 15 | Email | PASS | Chrome |
| 16 | API identifier | PASS | Chrome `API_TOKEN` / `API` |
| 17 | Code | PASS | Unit protected roles |
| 18 | Protected content | PASS | Chrome JWT / key |
| 19 | Rapid typing | PASS | Chrome |
| 20 | Paste | PASS | Chrome |
| 21 | Selection | PASS | Chrome |
| 22 | Backspace | PASS | Chrome rapid suite |
| 23 | Cursor movement | PASS | Chrome |
| 24 | Middle edit | PASS | Chrome |
| 25 | Correction then more typing | PASS | Chrome |
| 26 | Multiple consecutive corrections | PASS | Chrome bilingual + cooldown drain |
| 27 | Provider success | PASS | Live Groq/Gemini/OpenRouter |
| 28 | Provider 429/failure | PARTIAL | Groq CONTRACT_FAILURE live; 429 injected only |
| 29 | Provider fallback | PARTIAL | Injected manager PASS; live chain UNVERIFIED |
| 30 | All providers unavailable | PASS local path | Chrome offline + prior manager tests |
| 31 | Stale advisor | UNVERIFIED live | Generation abort exists in code |
| 32 | Network loss | PASS | Chrome offline |
| 33 | Network recovery | PASS | Chrome setOffline false |
| 34 | Extension / page reload | PASS | Chrome |
| 35 | Popup | PASS isolated / flake in file | Chrome |
| 36 | Onboarding | PASS isolated | Chrome first-win |
| 37 | Settings | UNVERIFIED | Dashboard not driven this session |
| 38 | Repeated daily-use session | UNVERIFIED | — |

---

## FINAL RELEASE VERDICT

**The writing product is usable for the bilingual failure class that motivated this work.**

A human can install the current `extension/dist`, type the intended mixed sentence without the engine turning it into bidirectional garbage, finish a wrong-keyboard word with Space and get a coherent remap, keep URLs/emails/keys, and keep typing while advisors run in shadow.

**Not a launch stamp for:** guaranteed Groq JSON every call, live three-provider fallback in Chrome, rich-text composers, or a week of daily use.

**Do not ship advisor apply** as part of this work.

**Ship the local writing engine + enforce coordinator + Write Gate as they stand after this change**, with Groq/Gemini/OpenRouter as optional shadow rankers when configured.
