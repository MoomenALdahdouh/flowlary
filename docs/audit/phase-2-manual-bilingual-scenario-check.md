# Phase 2 — Manual bilingual scenario check

**Date:** 2026-08-31  
**Updated:** 2026-08-31 — added `mixed_arabic_context_multiple_wrong_layout_spans_with_symbols` (span-level path replay).  
**Scope:** Inspect captured Phase 2 shadow telemetry for six user-typed cases; then trace the live layout/shadow decision path for one additional multi-span case. No code changes. No Phase 3.

**Inspection result:** **No Phase 2 shadow events were captured in any inspectable store.** Per-case shadow fields below are therefore **not available**. This is an observability gap, not a reconstructed engine run.

---

## What was searched

| Source | Found |
|---|---|
| Repo files (`*.json`, `*.jsonl`, `*.log`, QA shots, audit dumps) | No `shadow_only` / `2.0.0-shadow` / `flowlary.debug.engineMode` payload from a live tab |
| `getShadowDecisionSnapshot()` / `getWriteTelemetrySnapshot()` | In-memory only; not persisted; not attached to `window`; not exported from `content_script.ts` |
| Agent transcripts / terminals | No dump of these six sessions |
| Messaging / popup / dashboard | No `GET_DEBUG` / snapshot message type |
| Chrome profile storage (workspace-adjacent search) | No readable event dump in this environment |

Unit-test fixtures in `tests/unit/writing-engine/phase2-shadow-engine.test.ts` are **not** these six cases and were not used as substitutes.

---

## Why no telemetry was captured (code path)

Shadow recording is gated and isolated:

1. **Default off.** `getEngineMode()` is `off` unless `globalThis.__FLOWLARY_ENGINE_MODE__ === 'internal_shadow'`, `setInternalEngineMode('internal_shadow')`, or `chrome.storage.local` key `flowlary.debug.engineMode` hydrates to that value (`flag.ts`). Production default is `off`.
2. **Subscriber no-ops when off.** `startShadowEngine` always attaches one EventBus listener, but the first line is `if (!isShadowEngineEnabled()) return` (`coordinator.ts`). **No `recordShadowDecision` runs** while mode is `off`.
3. **Events never leave the content-script isolate.** `recordShadowDecision` pushes into a process-local array (max 80). There is no `console` emit, no `chrome.storage` write, no page-world export.
4. **`content_script.ts` does not export the snapshot.** It exports `engine, router, orchestrator, correction, layout, translation` only. Page DevTools (main world) cannot call `getShadowDecisionSnapshot()`.
5. **Reload / navigation / new document** drops the ring.
6. **Legacy write telemetry is a separate ring.** `recordWriteTelemetry` is used by layout/correction/translation writers. The shadow engine does **not** call it. `shadowOnly` on write events stays unused unless a writer passes it. `legacyObserved` on shadow events is **hard-coded** `'not_observable'` (`telemetry.ts`).

Even if internal shadow was enabled in the tab, this inspection still has **zero events** because nothing flushed them out of that isolate.

---

## Missing observability hook

To inspect a real dogfood session, Phase 2 is missing a **read-only dump** from the **content-script world**, for example:

- Content-script console helper on `globalThis` (isolate only), e.g. expose `getShadowDecisionSnapshot` + `getEngineMode` + `getWriteTelemetrySnapshot`, **or**
- A developer-only `chrome.runtime` / port message that returns the two rings (still no raw text), **or**
- A join key (`cycleId` / timestamp window) so shadow `legacyObserved` is not always `not_observable`.

Until that hook exists, manual bilingual checks cannot be evidenced from telemetry.

**How to dump in a future session (existing APIs, content-script inspector):**

1. Enable `internal_shadow` (see Phase 2 report).
2. In DevTools, select the **Flowlary content script** context (not the page).
3. There is still **no** bound global for the snapshot; the function exists only as a module export. That is the missing hook.

---

## Cross-cutting answers (all six cases)

These apply equally because no case-specific event exists.

| Question | Evidence |
|---|---|
| Effective engine mode | **Not captured.** Code default: `off`. Storage/global for the user’s tab: not readable here. |
| Effective writing policy | **Not captured.** Derived at runtime via `resolveHelpStyle()` / `resolveWritingPolicy()` from `stateManager`. No session snapshot. |
| Field tier / editable type | **Not captured.** Shadow events would store `fieldTier` + `fieldKind`. User did not record host/field. |
| Shadow analysis ran? | **Not captured.** If mode was `off`: **no**. If `internal_shadow` and gates passed: `analyzed: true` would be on the event. No event. |
| Shared chunk classification | **Not captured.** Would be `scriptMix` / `dominantOrigin` on the event (hashes only in analysis, not in the event). |
| Candidate actions | **Not captured.** Would be `candidateTypes`. |
| Final `WritingDecision` | **Not captured.** |
| Confidence bucket | **Not captured.** Would be `confidenceClass`. |
| Reason codes | **Not captured.** |
| Legacy layout/correction/translation | **Not captured.** Shadow always sets `legacyObserved: 'not_observable'`. Write-telemetry ring also not dumped. |
| Why the field did or did not change | **Cannot say from telemetry.** Shadow **cannot** write (`engine/` does not call writers). Any mutation would be **legacy only**. Whether legacy wrote is unobserved. |
| Matches intended policy? | **Cannot certify.** Intended policy is known; actual shadow + legacy outcomes are unknown. |

---

## Intended policy (spec / Phase 2 product rules — not observed output)

Used only for the **Expected behavior** column. Not a reconstruction of decisions.

1. Mixed Arabic + quoted wrong-layout Latin: one decision; high-confidence layout on mismatch tokens can outrank grammar; no grammar auto on mixed/ambiguous; translation is not inferred intent; isolated ≤2 tokens never auto-remap.
2. Stable Arabic only: evidence `original_ar`; not English correction; layout only if mismatch evidence; live translation only if explicitly configured (and shadow would mark `session_missing` / `legacy_live_behavior`).
3. Stable original English: English correction eligible only if unprotected and not layout/Arabizi/mixed.
4. Arabic + Latin product tokens (`API`, `key`): mixed/protected evidence; do not auto-grammar the Arabic or treat Latin jargon as layout by default.
5. Arabic + suspected layout Latin (`hulg`, `نثغ`) + `api`: layout evidence may outrank grammar; mixed remainder blocks correction auto; `api` is a short/ambiguous Latin token (no auto-remap).
6. `في` (length 2): **never** auto layout; `noop` or suggestion.

---

## Scenario table

All **observed** columns are `not captured` because no shadow/write dump exists for the session.

| Case | Field type | Engine mode | Legacy action | Shadow decision | Reason codes | Expected behavior | Actual behavior | Discrepancy | Next action |
|---|---|---|---|---|---|---|---|---|---|
| 1. `مرحبا هل لديكم بعض العسل "مرحبا هل g]d;l fu'hgusg"` | not captured | not captured (default `off`) | not captured (`legacyObserved` always `not_observable`) | not captured | not captured | One decision: treat quoted Latin as layout **evidence**; do not grammar-auto the mixed field; no inferred translation | not captured (field change unknown) | Cannot compare — no events | Enable `internal_shadow`; dump snapshot from content-script isolate after typing |
| 2. `ذهبت الى المكتب اليوم` | not captured | not captured (default `off`) | not captured | not captured | not captured | Arabic evidence → no English correction auto; layout only if mismatch; translation only if live explicitly on | not captured | Cannot compare | Same dump + note whether live translation was on |
| 3. `I sent the email yesterday` | not captured | not captured (default `off`) | not captured | not captured | not captured | Original English → correction candidate only if eligible; no layout auto | not captured | Cannot compare | Same dump; record whether a correction card/API ran (legacy) |
| 4. `انا اعمل على API key اليوم` | not captured | not captured (default `off`) | not captured | not captured | not captured | Mixed / protected Latin tokens → no English-correction **auto**; no layout auto on `API`/`key` | not captured | Cannot compare | Same dump; confirm field was Tier 1 vs Writing Lab CE |
| 5. `انا hulg على api نثغ اليوم` | not captured | not captured (default `off`) | not captured | not captured | not captured | Layout evidence may win over grammar; mixed + short `api` block auto-remap/grammar | not captured | Cannot compare | Same dump; record whether legacy remapped `hulg` / `نثغ` |
| 6. `في` | not captured | not captured (default `off`) | not captured | not captured | not captured | Isolated token length ≤ 2 → never auto layout; `noop` or suggestion | not captured | Cannot compare | Same dump after Space/Enter/Tab (coordinator also runs on those keyups) |
| 7. `mixed_arabic_context_multiple_wrong_layout_spans_with_symbols` | not captured in tab; path replay used default Tier-1 `textarea` context | tab telemetry not captured; replay used default `helpStyle` derived `auto` + `DEFAULT_PROFILE` (`en-US-qwerty` → `ar-101`) | **Replay:** `planFieldFixes` = `[]` (no local write). Remote `CHECK_WORD` may still run, but `canApply` is the same lexicon gate. | **Replay (not tab dump):** `noop` | `shadow_observe_only`, `ambiguous_mixed` | Arabic-context wrong-layout spans should be one layout decision (or per-span layout), not left as Latin; no grammar auto | User: many Latin/symbol spans left uncorrected | Matches the **local** path: every Latin span fails `confidentArabicMismatch` / `isArabicWord`; § spans never infer a source | Do not treat as CE/policy until a dump exists; the blocking function is `confidentArabicMismatch` → `isArabicWord` |

---

## What would have been required for a real per-case row

For each case, in the **content-script** DevTools context, after the last pause/space:

- `getEngineMode()` → `off` | `internal_shadow`
- `getShadowDecisionSnapshot()` last event: `analyzed`, `fieldTier`, `fieldKind`, `scriptMix`, `dominantOrigin`, `candidateTypes`, `decision`, `confidenceClass`, `reasonCodes`, `shadow_only`, `engine_version`, `feature_flag_*`
- `getWriteTelemetrySnapshot()` for the same window: layout / correction / translation `outcome` + `reasonCodes`

Those calls are not bound for dogfood today. That is the missing hook.

---

## Case 7 — `mixed_arabic_context_multiple_wrong_layout_spans_with_symbols`

**Input (verbatim):**

`انا اليوم في u'gm لكن ghhuvt هل سوف h§if hl لا لكن ]ukh kvn هل dl;kkh hg§ihf hl لا سوف hofv; fhgjthwdg اليوم hglyvt او hguahx`

**Observed (user):** extension does not accurately correct all wrong-layout spans; many Latin/symbol-heavy segments stay Latin inside strong Arabic context.

**Evidence used:** live call of `tokenizeText` → `planFieldFixes` → `localClassificationHint` / `mapLayout` / `canCommitMismatch` / `analyzeFieldText` / `collectShadowCandidates` / `decideWriting` on `DEFAULT_PROFILE` (`en-US-qwerty` + `ar-101`) and default `stateManager.layout` (`autoEnabled: true`, `mode: 'direct'`). This is **the same functions** `LayoutScheduler.applyLocalFixes` and the shadow adapters call. It is **not** a captured tab `getShadowDecisionSnapshot()` (that hook is still missing).

There is **no multi-span object** in the current path. The planner walks `tokenizeText` tokens and decides each token independently (`sentence.ts` `considerToken` + `LOCAL_CONTEXT_RADIUS = 3` neighbor **words** only as a string for `canCommitMismatch`). Adjacent Latin tokens are never merged into one span.

`contextSuggestsTarget(fullField, 'ar-101')` is **true** (Arabic already in the field). That only relaxes the **1–2 letter** rule. It does **not** skip the lexicon gate.

### Path (legacy local)

`LayoutScheduler.evaluate` → `applyLocalFixes` → `planFieldFixes(text, profile, { finalizeAll, caret })` → for each `FieldFix`, `canCommitMismatch(..., text)` again → `applyLayoutFix`.

`planFieldFixes` result on this string: **`fixes: []`**. `applyFixesToText` is a no-op. The field staying Latin on the local path is therefore **not** a CE guard, mutex, or `shortcuts_only` effect of this replay.

Remote: tokens with `localClassificationHint === null` are queued for `CHECK_WORD` (`scheduler.ts` `evaluateRemote`). **Apply still requires** `classifier.canApply` → `canCommitMismatch` → `confidentArabicMismatch` → `isArabicWord(mapped)` (`heuristics.ts` 250–261, `LayoutClassifier.ts` 157–165). A remote `LAYOUT_MISMATCH` that remaps to a word **outside** `ar-words.ts` is discarded.

### Path (shadow)

`analyzeFieldText`: `hasLayoutSuspicion === false` because `localClassificationHint` never returns `LAYOUT_MISMATCH` (same lexicon gate). Latin chunks stay `origin: unknown`, `layoutSuspicion: none`. Then `hasAmbiguousMixed = (arabic chunks > 0 && latin chunks > 0 && !hasLayoutSuspicion)` → **true**.

`collectShadowCandidates`: layout adapter requires `hint.kind === 'LAYOUT_MISMATCH'` → **no layout candidates**. Correction adapter: `shouldShowEnglishAssistant` / `isEligibleForCorrection` fail on dominant Arabic → **no correction candidate**. Translation off → **no translation candidate**.

`decideWriting`: no layout winner; `hasAmbiguousMixed` → **`noop`** with `shadow_observe_only`, `ambiguous_mixed`. Confidence class **`high`** on that noop (gate noop, score 1). `blockedCandidateCapabilities` is empty because no correction candidate was built.

Shadow still **cannot write**. User-visible leftover Latin is the **legacy** path.

### Span-level table (suspected wrong-layout runs)

Punctuation: `LAYOUT_SYMBOL_BREAK` is only `÷×—–`. `§` is **not** a delimiter; it stays inside the token. Trailing `;` **is** `TRAIL_PUNCT` and is peeled off `hofv;`.

| Span (user-visible run) | Detected boundaries (token / raw) | Punct / symbols | `mapLayout(en-US-qwerty → ar-101)` | Arabic context before / after | Legacy local decision | Shadow candidate | Shadow final (field) | Confidence / reasons | Rejection | Cause class |
|---|---|---|---|---|---|---|---|---|---|---|
| `u'gm` | token `[13,17]` raw same; `'` **retained** in token (`AR_LETTER_PUNCT`) | `'` kept; not split | `عطلة` | before `انا اليوم في`; after `لكن ghhuvt` | no fix (`hint: null`, `canCommit: false`) | none | field `noop` | replay: `ambiguous_mixed` | `isArabicWord('عطلة') === false` | **lexicon gate** (not missing context; `contextSuggestsAr` true) |
| `ghhuvt` | `[22,28]` | none | `لااعرف` | `لكن` / `هل سوف` | no fix | none | same | same | mapped is concatenated `لا`+`اعرف`; not in `ARABIC_WORD_SET` | **lexicon gate**; no phrase/span merge |
| `h§if` | `[36,40]` whole token | `§` **retained**; not in `LAYOUT_SYMBOL_BREAK` | **`null`** (`§` ∉ US QWERTY table) | `هل سوف` / `hl لا` | `inferSourceLayout === null`; skipped by `considerToken` (`!token.source`) | none | same | same | no physical-key hit | **keyboard glyph / profile mismatch** (`§` ≠ Arabic Shift+I `÷`); not tokenizer split |
| `hl` | `[41,43]` and later `[77,79]` | none | `ام` | `h§if` / `لا`; second: `hg§ihf` / `لا` | no fix | none | same | same | length 2 **and** `ام` not in lexicon; `contextSuggestsTarget` true is not enough | **lexicon gate** + **short-token rule** (both required in `confidentArabicMismatch`) |
| `]ukh` | `[51,55]`; `]` **retained** | `]` kept (`AR_LETTER_PUNCT`) | `دعنا` | `لكن` / `kvn هل` | no fix | none | same | same | `دعنا` not in lexicon | **lexicon gate** |
| `kvn` | `[56,59]` | none | `نرى` | `]ukh` / `هل` | no fix | none | same | same | `نرى` not in lexicon | **lexicon gate**; adjacent `]ukh kvn` never one span |
| `dl;kkh` | `[63,69]`; `;` **retained** in token | `;` kept | `يمكننا` | `هل` / `hg§ihf` | no fix | none | same | same | `يمكننا` not in lexicon | **lexicon gate** |
| `hg§ihf` | `[70,76]` | `§` retained | **`null`** | `dl;kkh` / `hl لا` | source null | none | same | same | same as `h§if` | **keyboard glyph / profile mismatch** |
| `hofv;` + `fhgjthwdg` | tokens `hofv` `[87,91]` and `fhgjthwdg` `[93,102]`; delimiter `;` `[91,92]` **split off** | `;` peeled as trail punct (then space) | `hofv` → `اخبر`; `hofv;` would be `اخبرك`; `fhgjthwdg` → `بالتفاصيل` | `سوف` / `اليوم` | no fix on either token | none | same | same | `اخبر`, `اخبرك`, `بالتفاصيل` all fail `isArabicWord` | **tokenizer/symbol splitting** (`;` vs letter ك) **and** **lexicon gate** |
| `hglyvt` | `[109,115]` | none | `المغرف` | `اليوم` / `او` | no fix | none | same | same | not in lexicon (surface form ≠ `اليوم` list) | **lexicon gate** |
| `hguahx` | `[119,125]` | none | `العشاء` | `او` / (end) | no fix | none | same | same | `العشاء` not in lexicon | **lexicon gate** |

Arabic tokens (`انا`, `اليوم`, `في`, `لكن`, `هل`, `سوف`, `لا`, `او`) classify `VALID` / `original_ar` and are not remapped.

**Ruled out on this replay (default Tier 1, assistant on, layout direct):**

- Protected-token skip: `skipReasonForToken` / `protectedKind` all **null**; `isSafeToken` **true**.
- Contenteditable auto-write guard: not in this function replay; leftover Latin is explained without it.
- Feature off / `shortcuts_only`: default settings would be `auto` (layout + correction direct).
- Implementation bug of “mapLayout broken”: maps are produced for every QWERTY-only token; they are then **rejected**.
- Insufficient Arabic context scoring: `contextSuggestsAr` is already true; it never opens the ≥3-letter path past the lexicon.

**Not from tab telemetry:** whether `CHECK_WORD` ran, whether a CE host blocked auto write, and the live `engineMode`.

---

## Why the current system fails on multi-span Arabic-context wrong-layout writing

The product sees one bilingual sentence. The engine sees **independent tokens** plus a **closed Arabic word list**.

1. **No span layer.** `]ukh kvn`, `hofv; fhgjthwdg`, and `h§if hl` are not one mismatch region. Neighbors are only a 3-token string for `canCommitMismatch`. Phrase-level Arabic (لا أعرف، دعنا نرى، أخبرك بالتفاصيل) never exists as a unit.
2. **Lexicon is the auto-write gate.** `confidentArabicMismatch` requires `isArabicWord(mapped)`. `ar-words.ts` is a short hardcoded set (`في`, `لكن`, `اليوم`, `سوف`, …). Physical maps that a speaker would accept (`عطلة`, `يمكننا`, `العشاء`, `بالتفاصيل`, `دعنا`, `نرى`, `لااعرف`) all return false. Local **and** remote apply share this gate.
3. **Arabic context does not promote those maps.** `contextSuggestsTarget` only unlocks length ≤ 2. Length ≥ 3 still needs the lexicon hit.
4. **Shadow agrees with the gate, then mis-labels the field.** Because hint never becomes `LAYOUT_MISMATCH`, chunks stay `layoutSuspicion: none`. Mixed Arabic + leftover Latin becomes `hasAmbiguousMixed` and a field-level **`noop` / `ambiguous_mixed`**, not `layout_fix`. So shadow does not record “layout should win on these spans”; it records mixed uncertainty.
5. **`§` is outside the physical tables.** `en-US-qwerty` has no `§`. `inferSourceLayout` and `mapLayout` fail. The tokenizer does not treat `§` as `÷` (Arabic Shift+I). Those spans cannot enter the mismatch path at all.
6. **`;` is sometimes a letter and sometimes punctuation.** `hofv;` loses `;` (ك on Arabic 101) before the first `decideTarget`. The raw-token retry exists only when peel/extra rules fire; even `اخبرك` would still die on the lexicon.

That is why strong Arabic context plus several remappable Latin runs still leaves the field largely unchanged: the current decision path never commits a remap that is not already in `ARABIC_WORD_SET`, and it never scores a multi-token wrong-layout span.

---

## Confirmation

- Cases 1–6: no captured Phase 2 shadow/write telemetry in this environment (observability gap unchanged).
- Case 7: diagnosed by executing the current layout planner + shadow decide functions on the typed string and default EN→AR profile. Not a tab event dump.
- No product source was changed. Phase 3 was not started.
