# Unified Writing Assistant — Full Project Audit

**AUDIT DATE:** 2026-08-31  
**REPOSITORY:** `/Users/moomen/Projects/flowlary`  
**BRANCH:** `main` (tracks `origin/main`, ahead 2)  
**HEAD COMMIT:** `61f349827f111231dd8ebdac1c557478dcb10cb8` — `feat: add production readiness audit and entitlement gating` (2026-08-25)  
**REPOSITORY STATE:** Dirty working tree. Unified-writing modules (`extension/src/core/engine/`, `extension/src/core/writeGate/`, `extension/src/core/policy/`, session chip, popup/dashboard policy UI) exist in the **current workspace** (many untracked or modified vs HEAD). This audit describes **that working tree**, not HEAD alone.  
**SCOPE:** Audit only. No application code, tests, config, or architecture were changed.

## TEST COMMANDS RUN

```bash
cd extension && npm run test -- tests/unit/writing-engine tests/unit/fieldSession.test.ts tests/unit/layout/speedBox.test.ts
```

## TEST RESULTS

- 6 files, **57 passed**, 0 failed (vitest 3.2.7, happy-dom).
- These tests prove **pure functions / isolated classes** (decideWriting, FieldSession cooldown, shadow “does not mutate”).
- They do **not** prove `startEnforceCoordinator` + `runFieldCycle` in a live content script, chip UI, Speed Box insert, or Chrome integration.
- **No tests import** `enforceCoordinator.ts`, `pipeline.ts` (`runFieldCycle`), or `sessionChip.ts`.

## FILES INSPECTED (primary)

- `extension/src/content_script.ts`
- `extension/src/content/accountBootstrap.ts`
- `extension/src/core/input/InputEngine.ts`
- `extension/src/core/session/FieldSession.ts`
- `extension/src/core/events/EventBus.ts`
- `extension/src/core/engine/{index,flag,coordinator,decide,candidates,chunks,context,types}.ts`
- `extension/src/core/writeGate/{writeGate,pipeline,enforceCoordinator}.ts`
- `extension/src/core/dom/{editor,writeOrigin,generation}.ts`
- `extension/src/core/policy/writingPolicy.ts`
- `extension/src/core/state/StateManager.ts`
- `extension/src/core/router/{CommandOrchestrator,CommandRouter}.ts`
- `extension/src/core/safety/{index,fields,tokenKind}.ts`
- `extension/src/core/observability/writingAnalytics.ts`
- `extension/src/features/layout/{LayoutFeature,scheduler,fixCurrentText,speedBox}.ts`
- `extension/src/features/layout/layouts/heuristics.ts`
- `extension/src/features/correction/{CorrectionFeature,scheduler,applyCorrection,instantSpell}.ts`
- `extension/src/features/translation/{TranslationFeature,scheduler,liveTranslate,segments,sessionChip}.ts`
- `extension/src/popup/{App.tsx,views/HomeView.tsx,views/FirstWinView.tsx,i18n/en.ts,i18n/ar.ts}`
- `extension/src/dashboard/onboarding/OnboardingFlow.tsx`
- `extension/src/dashboard/panels/SettingsPanel.tsx`
- `extension/src/ui/useFeatureMutations.ts`
- `extension/src/background/index.ts` (SET_SETTINGS / policy persist)
- `extension/src/storage/hydrate.ts`
- `tests/unit/writing-engine/*.ts`

Documentation under `docs/architecture/unified-writing-*.md` was **not** treated as evidence of runtime.

---

# 1. Executive Summary

**Flowlary today is a hybrid.** A unified Decision Engine + Write Gate **exists and is the intended auto path after boot**, but:

1. **Three feature schedulers still start on every page** and still contain independent auto-write logic.
2. They **self-disable when `engineMode === 'enforce'`**.
3. Production default after async hydrate is **`enforce` in memory**, not `off` and not `internal_shadow`. Comments/tests that say “default OFF” describe `getEngineMode()` **before** `startShadowEngine()` finishes hydrate — not the installed content-script end state.
4. In **enforce**, the pipeline can **actually apply only local layout remaps and local instant-English spelling**. Translation candidates have **no replacement string** (no API). Suggestion actions **do not mount cards**. Remote grammar and live translation **do not run** through the engine.
5. Shortcuts, Speed Box insert, and suggestion-accept still **bypass `decideWriting`**. Speed Box **mutates `input.value` / `textarea.value` directly**.
6. The popup/settings **mix** “one assistant” copy with **three quick-action tools** and leftover Direct/Card settings that can **diverge** from `UserWritingPolicy`.

**Closest honest answer to the audit question:**

> Flowlary is closer to *one decision layer for automatic local layout + tiny spelling* than it was as three always-on writers. It is **not** yet one bilingual assistant with one writer, one intent model, and one complete Observe→Act loop for translation and English.

**FINAL VERDICT (see §25):** **PARTIALLY READY** — core contracts exist; enforcement is incomplete; translation/English auto and suggestion UX do not match the product model.

---

# 2. Current Runtime Architecture

## Boot sequence (actually executed)

SOURCE: `extension/src/content_script.ts`

```
bootstrapContentScriptAccount({ layout, correction })  // hydrate settings, onChanged
engine.start()
correction.start()   // CorrectionScheduler.subscribe
layout.start()       // LayoutScheduler.subscribe
translation.start()  // TranslationScheduler.subscribe
orchestrator.start() // shortcuts + RUN_COMMAND only
startShadowEngine(engine)
startEnforceCoordinator(engine)
startTranslationSessionChip(engine)
```

All three feature modules **do start**. That is not documentation — `content_script.ts` calls `.start()` on each.

## What listens to EventBus

| Subscriber | When it runs | Writes? |
|---|---|---|
| `LayoutScheduler` | Always subscribed. `shouldRun` returns **false** if `isEnforceEngineEnabled()` | Yes via `applyLayoutFix` → Write Gate, **only when enforce is off** |
| `CorrectionScheduler` | Always subscribed. On input, if enforce: cancel debounce and **return** (after card stale-check) | Instant spell + remote via Write Gate when enforce is off |
| `TranslationScheduler` | Always subscribed. `isLiveEnabled()` false if enforce | `runLiveTranslation` → Write Gate when enforce is off |
| `startShadowCoordinator` | Subscribed always; body no-ops unless mode is `internal_shadow` | Never |
| `startEnforceCoordinator` | Subscribed always; body no-ops unless mode is `enforce` | `runFieldCycle` → Write Gate |
| `CommandOrchestrator` | `shortcut` events + chrome messages | Feature `execute()` or `runWritingPipeline` for `PIPELINE` |
| Translation chip | `document.focusin` (not EventBus) | No write |

## engineMode — actual behavior (Invariant D)

SOURCE: `extension/src/core/engine/flag.ts`, `extension/src/core/engine/index.ts`

| Claim | Reality |
|---|---|
| `flag.ts` comment: “Default OFF” | **True for `getEngineMode()` with no overrides.** `memoryMode` and `storageMode` start `'off'`. |
| Tests: `defaults to off` | **True** — tests call `resetEngineModeForTests()` and never `startShadowEngine`. |
| Production content script | `startShadowEngine` hydrates `chrome.storage.local['flowlary.debug.engineMode']`, then **`if (getEngineMode() === 'off') setInternalEngineMode('enforce')`**. |
| Persist | That `enforce` is **memory-only**. Not written to storage. Every content-script load repeats: off → hydrate → if still off → memory `enforce`. |
| Popup / dashboard | **No UI** for `engineMode`. |
| Priority | global `__FLOWLARY_ENGINE_MODE__` > memory > storage > `'off'`. |

**RUNTIME:** After a normal install/reload, once hydrate’s promise resolves, **`isEnforceEngineEnabled() === true`** unless a developer set `internal_shadow` or `enforce` in storage/global.

**Boot race:** `correction.start()` / `layout.start()` / `translation.start()` run **before** that promise. Until hydrate completes, mode is `'off'`, so **legacy schedulers can auto-write**. Then enforce flips on and they stop.

If storage is `'internal_shadow'`, hydrate does **not** force enforce. Shadow coordinator observes; **legacy schedulers stay live writers**.

## Current auto path when enforce is on

```
USER input (origin !== SYSTEM)
  → EnforceCoordinator
  → skip if composing or isInCooldown()
  → runFieldCycle
       resolveWritingPolicy()
       ensure/end TranslationSession
       buildFieldContext + analyzeFieldText + collectShadowCandidates
       decideWriting(..., { observeOnly: false })
       if auto winner with replacement → tryAcquireWrite → commitWriteTransaction
```

**RUNTIME:** This path **is executed** after enforce is on.

**Not executed as writers:** LayoutScheduler / CorrectionScheduler / TranslationScheduler auto loops (gated off).

**Still executed as writers on shortcut / Speed Box / card apply:** feature `execute` and Speed Box `insertResult`.

---

# 3. Target Architecture Comparison

| Target | Current |
|---|---|
| One observation → one decide → one write | **Partial.** Enforce cycle matches the shape. Candidates are **local stubs**. Translation has no text to write. Suggestions have no UI. |
| Intent-first | **Partial.** Policy + script/layout heuristics. No explicit user-intent type. Arabic script ≠ translation only because **policy flag** must be on. |
| Three capabilities, one product | **Partial in copy.** Runtime still three features + three commands + Speed Box modes. |
| Translation never from Arabic detection | **Mostly true in enforce.** Candidate exists only if `arabicToEnglishMode` / live flag. Arabic alone does not set the flag. **Legacy live path** (if enforce off) still requires the same policy flag. |
| Layout before English | **True in `decideWriting`.** Layout candidate wins first. Instant spell also refuses `hasLayoutSuspicion`. |
| One Write Gate | **Most page writes** use `commitWriteTransaction`. **Speed Box insert does not.** `writeReplacement` remains a public API (tests call it). |
| Field states observing/analyzing/suggesting/applying/cooldown | **Not implemented as a state machine.** See §11. |
| Cooldown after write | **450ms** on successful gate write. User keystrokes **clear cooldown** via `bumpGeneration()`. |

---

# 4. Decision Engine Audit

SOURCE: `extension/src/core/engine/decide.ts`  
CODE: `decideWriting`  
STATUS: **implemented** as a pure function  
RUNTIME: **executed** from `runFieldCycle` (enforce) and shadow coordinator (shadow only)  
UI: none  
TEST: **partially covered** (`unified-assistant.test.ts`, `phase2-shadow-engine.test.ts`) — not wired through `runFieldCycle`

Priority actually implemented:

1. `assistantEnabled` off → noop  
2. `helpStyle === 'shortcuts_only'` → noop  
3. `!safetyAllowed` → noop  
4. composing / mutex / cooldown / editorTier≠1 → noop  
5. **Highest-confidence layout candidate**  
   - short/ambiguous → noop (`ambiguous_short_token`), blocks grammar  
   - high + eligibleForAuto → `layout_fix`, blocks translation + grammar  
   - else → `suggestion`  
6. Arabizi / `hasAmbiguousMixed` → noop, block grammar  
7. Translation candidate  
   - requires `translationSessionId` **and** `arabicToEnglishMode`  
   - else `session_missing`  
   - low / not eligible → `suggestion`  
   - else `translation` (blocks grammar)  
8. Correction  
   - `translated_en` without polish → noop  
   - not eligible / layout suspicion → noop  
   - high + helpStyle auto → `english_correction`  
   - helpStyle suggestions → `suggestion`

`trigger` is **hardcoded `'auto'`** in `decideWriting`. Shortcuts never call this function.

`collectShadowCandidates` (SOURCE: `candidates.ts`):

- Layout: local `localClassificationHint` + `mapLayout`. **Has `replacement`.**  
- Translation: `lastCompletedSegment(..., { requireBoundary: true })`. **No `replacement`.** Confidence medium, `eligibleForAuto` only if session + mode.  
- Correction: field-wide range `[0, text.length]`. `replacement` only if `applyInstantSpelling(text) !== text`.

**Consequence:** `runFieldCycle` after a translation **win** hits `if (!replacement || !range) return 'noop'`.  
STATUS: translation auto in enforce is **dead / no-op**.  
RUNTIME: decide may say `translation`; pipeline **does not write**.

Suggestion action: pipeline returns `'suggestion'` and **does not** open CorrectionCard / InlineSuggestionCard.

---

# 5. Intent Understanding Audit

### A. Does the engine reason about intent?

**No, not as a first-class intent model.** It reasons about **policy flags + script/layout evidence + candidate list**.

There is no `UserIntent` enum. `OperatingState` is derived (`normal` / `translation` / `manual`) from helpStyle + `arabicToEnglishMode` (`writingPolicy.ts`). FieldContext copies those flags.

Logic is **not** simply `if Arabic → translate`. Translation candidate is emitted only if `arabicToEnglishMode || liveTranslation`. Arabic text with mode off produces **no** translation candidate.

It **is** closer to `if Latin + layout hint → layout; if English-looking + eligible → correct`.

### B. Arabic text vs “user wants translation”?

**Yes, distinguished** — by **explicit policy**, not by Arabic detection.

SOURCE: `candidates.ts` `translationCandidate`; `pipeline.ts` `ensureTranslationSession` only if `arabicToEnglishMode && !paused`.

Arabic detection alone **does not** set `arabicToEnglishMode`. Defaults: `DEFAULT_TRANSLATION.liveEnabled = false`; `settings.arabicToEnglishMode` unset → falls back to `liveEnabled` → **false**.

### C. English vs Arabic typed on English keyboard?

**Partial, lexicon-based.** `confidentArabicMismatch` requires mapped form to be a **known Arabic word**, typed token not English, and length ≥ 3 unless context already looks Arabic.

`"hwo"` is in `COMMON_TYPOS` → `"how"`. If layout heuristics do **not** flag suspicion, **enforce will treat it as English instant spelling**. That **violates** the product example if `"hwo"` was wrong-keyboard Arabic.

SOURCE: `instantSpell.ts` (`hwo: 'how'`); `applyInstantSpellingIfSafe` only skips when `hasLayoutSuspicion`.

### D. Correct Arabic short word vs English-looking ambiguous token?

**Partial.** Isolated 1–2 letter QWERTY tokens are not auto layout (`letterCount <= 2` → ambiguous; `confidentArabicMismatch` requires Arabic context for ≤2). Arabic words via `isArabicWord` are `VALID` when source is `ar-101`.

English shorts (`in`, `on`) are English lexicon → `VALID`, not remapped.

### E. Mixed Arabic/English?

**Analysis is chunk/token-level. Action is not.**

`analyzeFieldText` tokenizes and tags each chunk. `hasAmbiguousMixed` is **field-level**: any Arabic chunk + any Latin chunk without layout suspicion → `decideWriting` **noops English** (`ambiguous_mixed`).

Translation candidate uses **one completed sentence** (entire span), not Arabic-only chunks. If enforce could write translations, mixed sentences would be sent **whole**.

Protected tokens (`API` = `ALL_CAPS` → `code-identifier`) skip **layout** remap. They do **not** split translation scope.

### F. AUTO / SUGGEST / IGNORE / WAIT?

| Action | In `DecisionAction` | Produced by decideWriting | Applied in enforce pipeline |
|---|---|---|---|
| AUTO (`layout_fix` / `translation` / `english_correction`) | yes | yes | layout + instant English only |
| SUGGEST (`suggestion`) | yes | yes | **return only — no UI** |
| IGNORE (`noop`) | yes | yes | yes |
| WAIT / SHORTCUT | no WAIT; shortcut is not a decide action | `shortcuts_only` → noop | shortcuts use CommandRouter, not decide |

**STATUS:** confidence classes exist. SUGGEST is **shadow-complete, enforce-incomplete**.

---

# 6. One Writer / Write Gate Audit

## Invariant A — One writer

SOURCE: `writeGate.ts` — “All field mutations should go through `commitWriteTransaction`.”

**Production callers of `commitWriteTransaction`:**

- `pipeline.ts` (enforce)
- `fixCurrentText.ts` / `applyLayoutFix` (layout scheduler + shortcut)
- `CorrectionScheduler` instant spell
- `applyCorrection.ts` `commitMergedCorrection`
- `liveTranslate.ts`
- `TranslationFeature.execute` (shortcut)
- Layout/Translation `InlineSuggestionCard` onApply

**`writeReplacement` production callers:** only `writeGate.ts`. Tests call `writeReplacement` directly.

**Bypass — Speed Box insert**

SOURCE: `extension/src/features/layout/speedBox.ts` `insertResult`

```
setNativeValue(element, `${value.slice(0, from)}${text}${value.slice(to)}`)
element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' }))
```

STATUS: **active bypass**  
RUNTIME: **executed** when user inserts Speed Box output into an input/textarea  
Does **not** go through Write Gate, mutex, cooldown, or `tagTranslated`.

Speed Box’s **own** overlay `<input>` `.value` mutations are not page-field writes.

**Bypass — public `writeReplacement`:** any future/feature code can still import it. Not used by features today except via the gate.

## Invariant B — Competing automatic writers

| Component | Independent decide? | Writes today (enforce on)? | Writes (enforce off / boot race / shadow)? |
|---|---|---|---|
| LayoutScheduler | Own heuristics + classifier | **No** (`shouldRun` false) | **Yes**, independent schedule |
| CorrectionScheduler | Own debounce + eligibility | **No** auto (early return) | **Yes** instant + remote |
| TranslationScheduler | Own 750ms timer + `liveSegmentOnPause` | **No** (`isLiveEnabled` false) | **Yes** |
| EventBus auto | Multiple subscribers | Enforce only | Multiple |
| Legacy loop | The three schedulers **are** the legacy loops | Gated | Active |

They do **not** “merely produce candidates” in enforce. They **idle**. Candidate production is **`collectShadowCandidates`**, a **separate local reimplementation**, not a call into the schedulers.

**Race:** boot window + `internal_shadow` mode.

## Invariant C — One decision per cycle

**Enforce:** yes, one `decideWriting` per `runFieldCycle`.  
**Shortcuts:** no — `CommandOrchestrator.dispatch` → feature `execute` — **no** `decideWriting`.  
**Speed Box:** no.  
**Shadow:** one decide, no write.

STATUS: **implemented for enforce auto**; **not** the only production write path.

## Invariant E — Cooldown

SOURCE: `writeGate.ts` `WRITE_COOLDOWN_MS = 450`; `FieldSession.enterCooldown`

| Question | Answer |
|---|---|
| After successful gate write? | Yes |
| Duration | 450 ms |
| Field-specific? | Yes (per `FieldSession`) |
| Blocks other capabilities? | `decideWriting` noops if `cooldownActive`; coordinator skips if `isInCooldown()` |
| User typing suppressed? | **No.** `bumpGeneration()` **clears cooldown**. Next character starts a new cycle. |
| What cooldown actually blocks | Same-generation follow-up (e.g. keyup Space/Enter within 450ms after a SYSTEM write) and `commitWriteTransaction` if `auto && isInCooldown()` |

## Invariant F — Write origin

SOURCE: `writeOrigin.ts` `withWriteOrigin` / `isControlledWriteActive`; `InputEngine.writeOrigin()`; `shouldIgnoreInputForGeneration`

Controlled DOM writes set depth > 0 → input events treated as **SYSTEM**, generation **not** bumped, enforce/shadow **ignore** SYSTEM.

Origins on writes: `FIX_LAYOUT` / `CORRECT` / `TRANSLATE` (and `'SYSTEM'` fallback).

`translated_en` is a **decision TextOrigin** + `session.tagTranslatedOutput(start,end)` — **in-memory ranges**, not a DOM annotation. Cleared only via `clearTranslatedTags` (not called from pipeline on user edit). **Edits do not invalidate tags.** Ranges can be stale if the user edits in the middle.

`generation` lives on `FieldSession`; `revision` as a named concept **does not exist**.

## Invariant G — Stale async

| Path | Checks | Can stale overwrite? |
|---|---|---|
| Enforce pipeline | generation before decide, before write, `cycleGeneration` on gate | **No async network** in this path today |
| Layout remote (`evaluateRemote`) | generation before/after classify | If enforce off: **protected** |
| `runLiveTranslation` | ticket + generation + slice text (`isStaleTicket`) | If enforce off: **protected** if ticket works |
| `runCorrectionRequest` | debouncer generation + merge relevance | If enforce off: **partial** |
| Enforce translation | N/A (no fetch) | N/A |
| Speed Box insert | none | Overwrites current selection/value |

**RUNTIME (enforce):** stale overwrite of **engine** writes is unlikely because there is no async apply. **Shortcuts still async** and check tickets/generation.

---

# 7. Layout Audit

SOURCE: `heuristics.ts`, `registry.ts` (`mapLayout`), `candidates.ts`, `LayoutClassifier` (legacy)

| Topic | Finding |
|---|---|
| Mapping | Deterministic physical keymap (`mapLayout`) |
| Detection | `localClassificationHint` / `confidentArabicMismatch` + optional remote classifier **in LayoutScheduler only** |
| AI in enforce | **Not used** |
| Confidence | Binary-ish: committable && not short → 0.85 high; short → 0.35 ambiguous |
| Scope | **Token / chunk**, not whole field (unless shortcut field mode) |
| Short tokens | Protected (≤2 letters unless Arabic context) |
| Mixed | Protected chunks skipped if `protectedKind` |
| Technical IDs | `skipReasonForToken` (ALL_CAPS, camelCase, etc.) |

**Intended journey (wrong keyboard → layout only → gate → cooldown):**

- **Enforce + high-confidence local map:** **YES** (token write via gate, 450ms cooldown).  
- **Remote classifier confirmation:** **NO** in enforce.  
- **Grammar after:** blocked if layout candidate exists or `hasLayoutSuspicion`.  
- **Translation after:** blocked if layout wins.

`"hwo"` may **not** enter this journey (see §5.C).

---

# 8. English Assist Audit

| Situation | Enforce auto | Shortcut CORRECT |
|---|---|---|
| Original English + typo in `COMMON_TYPOS` (≥3 letters), no layout suspicion | Instant whole-field replace if `eligibleForAuto` + helpStyle auto | Remote `runCorrectionRequest` |
| Translated English | Noop unless `polishAfterTranslate` | `applyCorrection` still hardcodes `textOrigin: 'original_en'` |
| Suspected layout | No instant (`applyInstantSpellingIfSafe`); decide blocks grammar | `isEligibleForCorrection` may still run — **shortcut can ignore layout-first** |
| Mixed field | `ambiguous_mixed` → no English auto | May still send English-ish segment |
| Arabizi | noop | eligibility heuristics |
| Technical spans | analysis `hasProtected` lowers eligibility | token skip in safety |

`helpStyle === 'suggestions'`: decide returns `suggestion` → **no card in enforce**.

Remote English **never** runs in enforce auto.

Polish-after-translate: **policy flag exists**; enforce correction respects `translated_en` + polish flag; **pipeline never produces translated text**, so polish-after-translate **cannot run after auto translation** in enforce.

---

# 9. Translation Session Audit

SOURCE: `FieldSession` (`translationSessionId`, `translationPaused`, `ensureTranslationSession`, `pauseTranslationOnField`)  
CODE: `pipeline.ts` create/end session; `sessionChip.ts` pause/resume  
STATUS: **partial** (in-memory, not persisted)  
RUNTIME: session id created on enforce cycles when global mode on and field not paused  
UI: chip **visible** when `arabicToEnglishMode` and field focused  
TEST: pause clears session (`unified-assistant.test.ts` only)

| Requirement | Status |
|---|---|
| Global sticky switch | `settings.arabicToEnglishMode` / fallback `translation.liveEnabled`. Persisted via SET_SETTINGS + policy projection. |
| Per-field pause | `translationPaused` on that FieldSession. **Does not** clear global mode. |
| Session persistence | **None.** Reload / new document = new sessions. |
| Field identity | `field-${counter}-${tag}` WeakMap — **not** stable across reload. |
| Session termination | `endTranslationSession` when mode off or paused (pipeline). Explicit cancel = chip pause. |
| Switch fields | Per-element session. Field A pause does not pause B. |
| Switch tabs | Separate content-script worlds. |
| Popup closed | Content script keeps sessions. |
| Arabic detection starts translation | **No** (policy required). |
| Sentence boundary | `lastCompletedSegment` + `requireBoundary: true` (`.!?…؟` or newline). |
| Per character / word | **Not** in current `liveSegmentOnPause` (it **is** `lastCompletedSegment` with boundary). |
| 750ms pause paragraph replace | `currentParagraph` **exists** but **`liveSegmentOnPause` does not call it**. Old whole-paragraph pause path is **not** the live segment function today. |
| Legacy 750ms timer | `TranslationScheduler` still uses 750ms, **disabled in enforce**. |
| `runLiveTranslation` respects pause | **Does not check `isTranslationPaused()`.** Only global policy. Hole if scheduler runs. |

Chip implementation issues (SOURCE: `sessionChip.ts`):

- Hardcoded English: “Pause translation here” / “Resume…” — **ignores** i18n `assistant.pauseField`.  
- `refresh` reconstructs chip with `const session = undefined` and toggles `!paused` locally — **fragile**.  
- `position:fixed` from `getBoundingClientRect`; no resize/scroll update; no ARIA name beyond button text; no RTL; can clip near viewport top.  
- Hidden when mode off.  
- One `#flowlary-translation-chip` in document (focusin rebuilds).

---

# 10. Mixed Language Audit

Examples (analysis vs action):

1. `أرسل لي الـ API key اليوم`  
   - Chunks: Arabic + `API` (protected ALL_CAPS) + `key` (Latin) + Arabic.  
   - `hasAmbiguousMixed` true → no English auto.  
   - Layout skips `API`. `key` might be valid English.  
   - Translation sentence = **entire sentence** (if mode on). Enforce: **no write**. Legacy live: **would translate the whole span**, including `API key`.

2. `أنا عملت deploy لكن فيه error`  
   - Same mixed field-level block. `deploy`/`error` not ALL_CAPS — **not** `code-identifier`. Could be layout-evaluated as Latin tokens.  
   - Translation would include English words if a write existed.

3. `Send me the الـ API key today`  
   - Mixed → no English auto. Layout on Arabic token if mismatch.

4–5. Arabic + technical English / English + Arabic name: treated as **mixed field**, not bilingual chunk pipeline.

**STATUS:** mixed text is **recognized** and mostly **frozen** for English; it is **not** understood as valid bilingual **scoped** translation/correction.

---

# 11. Field State Machine Audit

Intended: `observing | analyzing | suggesting | applying | cooldown`

**Implemented on `FieldSession` (actual):**

- `generation` / `requestSequence` / `activeRequest` (mutex)
- `composing`
- `cooldownUntil`
- `translationSessionId` / `translationPaused`
- `translatedRanges`
- `lastWriter` / `lastInputAt`

**There is no `state: 'observing'` field and no transition table.**  
Invalid transitions are not encoded. Concurrent writes blocked by mutex. Cleanup: `FieldSessionRegistry.delete` exists; focus-out does **not** generally delete sessions (correction teardown hides cards). Stale sessions: WeakMap GC when element gone.

**Do not rename:** the conceptual five states are **not** what the code implements.

---

# 12. Policy / Storage Audit

SOURCE: `writingPolicy.ts`, `StateManager.ts`, `hydrate.ts`, `accountBootstrap.ts`, `background/index.ts` `SET_SETTINGS`

### UserWritingPolicy (actual fields)

`helpStyle`, `assistantEnabled` (from `stateManager.isActive()`), `fixWrongTyping`, `improveEnglish`, `arabicToEnglishMode`, `polishAfterTranslate`, `improveEnglishAfterTranslate` (alias), `operatingState`, `derived`, plus snapshot `liveTranslation`.

**Not on policy:** `excludedHosts` — lives as `settings.excludedDomains`.

### Dual source of truth

| Policy field | Fallback if unset | Legacy flags |
|---|---|---|
| helpStyle | `deriveHelpStyle()` from layout/correction/translation auto | `*.mode` box/direct + auto/live bits |
| fixWrongTyping | `layout.autoEnabled` | `layout.autoEnabled` |
| improveEnglish | `correction.enabled` | `correction.enabled` |
| arabicToEnglishMode | `translation.liveEnabled` | `translation.liveEnabled` |
| polish | `improveEnglishAfterTranslate === true` | settings only |

`applyUserWritingPolicy` **projects** onto feature flags (`projectPolicyOntoFeatures`).

`SET_CORRECTION` / `SET_TRANSLATION` / `SET_LAYOUT` **do not** go through that projection.

**Divergence examples:**

- Settings → Languages → `patchTranslation({ liveEnabled })` while `settings.arabicToEnglishMode` is **already boolean** → `resolveWritingPolicy` **ignores** the live toggle (`optionalBoolean(settings.arabicToEnglishMode, …)` uses the explicit setting).
- Settings → Writing → correction **Direct/Card** (`patchCorrection({ mode })`) while `helpStyle` stays `auto` → enforce uses **helpStyle**, not `correction.mode`.
- First Win “English shortcut only” sets `helpStyle: 'shortcuts_only'` even if layout should stay auto → **layout auto projected off**.

### Live updates

SOURCE: `CONTENT_SCRIPT_POLICY_STORAGE_KEYS` + `chrome.storage.onChanged` → `hydrateStateFromStorage`.

**RUNTIME:** Content script **rehydrates** settings/correction/translation/layout **without tab reload**.

Account-scoped keys that end with `.correction` / `.translation` / `.layout` also rehydrate.

`engineMode` has its own storage listener (debug key only).

---

# 13. Popup Audit

SOURCE: `HomeView.tsx`, `App.tsx`, `en.ts` / `ar.ts`

### CURRENT UI

1. Header: brand, domain pill, theme, account.  
2. Optional First Win **or** Home.  
3. System status + global extension toggle.  
4. Sign-in banner.  
5. **Quick actions (three tools):** Fix Writing / Translate / Fix Layout + shortcuts.  
6. Usage strip.  
7. Section **“What do you want help with?”** + lead: “One writing assistant…”  
8. **Help style** radios: Automatic / Suggestions / Shortcuts only.  
9. **Three FeatureControls:** Fix typing, English assist, Arabic → English.

### TARGET UI (from audit brief)

Writing Assistant on/off; three capabilities; help style; shortcuts; translation global.

**Match:** capabilities + help style + global toggle exist.  
**Miss:** still leads with **three command buttons** named like tools. No operating-state label (Normal / Translation / Manual) on the home surface. Chip pause is **not** in the popup (in-field only).

HomeView still **accepts** `onCorrectionModeChange` / Direct-Card handlers but **does not render** those radios.

---

# 14. Onboarding Audit

### First Win (popup, unsigned or incomplete `firstWin`)

SOURCE: `FirstWinView.tsx`, `App.tsx` `handleFirstWinSave`

Actual questions (EN):

1. Automatically fix typing on the wrong keyboard? Yes/No (default Yes)  
2. Improve English automatically vs shortcut only (default Auto)  
3. Enable Arabic → English in the same field? Yes/No (default No)

Wording matches the intended first-run set.

**Stored:** `patchWritingPolicy({ helpStyle: auto | shortcuts_only, fixWrongTyping, improveEnglish: true, arabicToEnglishMode })` + `markFirstWin`.

**Skip:** `markFirstWin({ completed: true })` **without** policy patch → **memory defaults** (layout auto on, correction enabled direct, translation live off, helpStyle unset → derived **auto**).

**Bug:** English “shortcut only” → **global** `shortcuts_only` (kills layout auto).

### Dashboard OnboardingFlow

SOURCE: `OnboardingFlow.tsx`  
STEPS actually used: `['welcome', 'tools']` (`learning` UI exists but `resolveLightStep` maps it away).

- Welcome: privacy + AI consent.  
- Tools step **title:** “How should Flowlary help?”  
- Nav label key: `onboarding.stepTools` = **“Tools”** (EN + AR `أدوات`).  
- Three questions (checkboxes/segmented) matching the product questions.  
- Skip tools: `persistTools(true)` is a **no-op** — defaults unchanged.

**RUNTIME:** answers call `patchWritingPolicy`. English shortcut + layout on → helpStyle **auto** + `patchCorrection({ mode: 'box' })`. **Enforce ignores box mode** for auto English.

Old vs new users: `helpStyle` unset → derived from legacy flags (`derived: true`). New First Win/onboarding **sets** helpStyle.

**Defaults (code):** layout `autoEnabled: true` mode `direct`; correction `enabled: true` mode `direct` (aggressive, not “light + suggestion”); translation `liveEnabled: false`. Consent default **false** — remote correction shortcuts need consent.

---

# 15. Settings Audit

SOURCE: `SettingsPanel.tsx` tabs: writing / languages / learning / data / privacy

### Intended groups vs actual

| Intended | Actual |
|---|---|
| General | Writing tab: help style + three capability toggles + polish + excluded sites + appearance |
| Incorrect Typing | Folded into writing + **Languages** layouts + **legacy** layout mode elsewhere |
| English Improvement | Writing toggle + **second** “Writing” block: Direct vs Suggestion card + highlights + AI consent |
| Instant Translation | Writing Arabic→English toggle **and** Languages: translation mode Direct/Card + **duplicate live toggle** + language pair |
| Advanced | Not named; highlights, modes, languages, learning, data, privacy are all first-class tabs |

### Mapping (selected)

| UI | Storage | Runtime consumer | Product concept |
|---|---|---|---|
| Help style | `settings.helpStyle` | `resolveHelpStyle` / decideWriting | When to intervene |
| Fix typing toggle | `settings.fixWrongTyping` + projected `layout.autoEnabled` | `layoutAuto` in context | Capability |
| English toggle | `settings.improveEnglish` + `correction.enabled` | `correctionEnabled` | Capability |
| AR→EN toggle (writing) | `settings.arabicToEnglishMode` + projected live | pipeline session + candidates | Translation mode |
| Live toggle (languages) | `translation.liveEnabled` only | Fallback **if** policy unset; ignored if policy set | Duplicate / conflict |
| Correction Direct/Card | `correction.mode` | Legacy scheduler; **not** decideWriting | Implementation detail |
| Translation Direct/Card | `translation.mode` | `liveTranslation` also requires mode===direct; scheduler | Implementation detail |
| Polish | `settings.polishAfterTranslate` | decideWriting | After-translate English |
| Excluded sites | `settings.excludedDomains` | `evaluateFieldSafety` | Safety |
| Highlights | `correction.highlights` | CorrectionCard | English UI |

**Dead / weak in enforce:** Direct/Card, Languages live toggle when policy is set, suggestion cards from engine.

**Runtime flags with weak UI:** `engineMode` (debug only). Chip pause (no settings). `operatingState` (no UI).

---

# 16. Speed Box / Shortcut Audit

SOURCE: `CommandOrchestrator`, `LayoutFeature.execute`, `speedBox.ts`

| Action | Uses decideWriting? | Uses Write Gate? |
|---|---|---|
| Shortcut FIX_LAYOUT / CORRECT / TRANSLATE | **No** | **Yes** (except Speed Box) |
| PIPELINE command | Yes (`runWritingPipeline`) | Yes if replacement exists |
| Speed Box open | No | N/A |
| Speed Box **Insert** into page field | No | **No** |
| Speed Box layout convert in overlay | No | Overlay input only |
| Suggestion accept (cards) | No | Yes |

Speed Box is a **second brain** (own layout convert, own AI debounce for translate/fix) plus a **manual insert** that bypasses the gate.

Shortcuts remain available in `shortcuts_only` (orchestrator does not use `decideWriting` noop). Auto writes blocked by `writeReplacement` `isShortcutsOnly()` when `auto: true`.

---

# 17. Analytics Audit

### Writing analytics (new)

SOURCE: `writingAnalytics.ts`  
In-memory ring buffer (80). **No raw text.** Fields: action, trigger, textOrigin, outcome, reasonCodes, shadowOnly.

`runFieldCycle` records `writing.decision` with outcome **noop or suggestion even when it is about to apply** (outcome `'applied'` only on `writing.write` after gate success). Decision event’s `outcome` for a soon-to-apply layout is incorrectly `'noop'`.

### Learning analytics (legacy)

Layout accepts: `category: 'layout'`.  
Correction accepts: `recordCorrectionAccepted` — **not** tagged `translated_en`. `commitMergedCorrection` sets `textOrigin: 'original_en'` always.

**RUNTIME:** polished translation or shortcut-correct on translated English can be stored as **original English learning**. Layout vs grammar is **separate** if users go through layout learning helper; enforce layout writes **do** set writing-analytics `layout_fix` + `textOrigin` from decision.

No popup visualization of writing analytics.

---

# 18. Test Coverage Audit

### UNIT

| Contract | Coverage |
|---|---|
| decideWriting priority | Partial (`hsjo]lj` layout wins; translation without session) |
| layout before grammar | Partial (same fixture; not `"hwo"`) |
| translation session pause | FieldSession only |
| hybrid pause/resume + chip | **Not covered** |
| cooldown | enter + **cleared by bumpGeneration** — not “blocks second capability” |
| one writer / write gate | Shadow tree must not import writers; **no** test that Speed Box / features only use gate |
| stale async | Older phase tests (layout/translation/correction) — **not** enforce pipeline |
| mixed language | `ambiguous_mixed` noop English |
| short tokens | `td ` not auto layout |
| policy sync | `unified-assistant` mapping test |
| onboarding / popup / chip | **Not** as product-contract tests |
| enforce coordinator | **None** |

### INTEGRATION

Legacy phase tests (correction UI, live translation, layout, popup). They exercise **feature modules**, not “enforce is default and schedulers are dark.”

### BROWSER / UI

No Chrome extension driver test for the 15 manual cases in this audit.

### STATIC ARCHITECTURE

`phase2-shadow-engine.test.ts`: engine folder must not import `writeReplacement` / cards. **Does not** scan `writeGate`, `speedBox`, or `content_script`.

### Major untested behavior

- `startShadowEngine` forcing `enforce`  
- Boot race  
- `runFieldCycle` translation no-op  
- Suggestion helpStyle with no cards  
- First Win helpStyle coupling  
- Policy vs Languages live toggle  
- Chip pause vs `runLiveTranslation`  
- Speed Box insert bypass  

**Tests run for this audit:** 57/57 writing-engine + fieldSession + speedBox unit. **Do not interpret as product-contract green.**

---

# 19. Manual Browser Test Plan

Load the **unpacked built extension** from the current workspace (`npm run build -w @flowlary/extension`). Use a simple `textarea` page (not password). Keep DevTools open on the **page** (content script). Optional: `globalThis.__FLOWLARY_ENGINE_MODE__` to force modes.

Assume after ~1s boot: **enforce on**, schedulers dark, unless you set shadow.

### Test 1 — Normal Arabic

- **Setup:** Translation off. Help style Automatic. Assistant on.  
- **Type:** `مرحبا كيف حالك اليوم` (no sentence punctuation required for this test).  
- **Expected:** No English rewrite. No translation. Layout only if a token looks like mismatch (this sentence should not).  
- **Must not:** Become English.  
- **UI:** Chip hidden.  
- **Mode:** Normal.  
- **Engine:** Cycle runs; decide likely `noop` / no layout candidates.  
- **Write:** None.

### Test 2 — Wrong keyboard

- **Setup:** Same. Known fixture: `hsjo]lj` then Space.  
- **Expected:** Token remaps to Arabic (استخدمت). No grammar.  
- **Must not:** Become an English “word.”  
- **Engine:** `layout_fix`.  
- **Write:** One gate write; ~450ms cooldown (keyup Space may be ignored).

### Test 3 — Short Arabic token

- **Type:** `أنا في البيت`  
- **Expected:** `في` stays.  
- **Must not:** `في` remapped via QWERTY (`td` etc.) without Arabic context rules firing incorrectly on the Arabic letters themselves.

### Test 4 — Mixed language

- **Type:** `أرسل لي الـ API key اليوم`  
- **Expected:** `API` unchanged. No English grammar pass.  
- **Must not:** Translate (mode off). Must not rewrite `API`.  
- **Note:** Enforce will not translate even if mode on until pipeline has a replacement.

### Test 5 — English correction

- **Type:** `I dont know` + space/punctuation.  
- **Expected:** Instant `don't` **if** helpStyle auto and no layout suspicion. **Not** full remote grammar.  
- **Must not:** If you expected ChatGPT-level rewrite — that is **shortcut-only** in enforce.

### Test 6 — Translation mode

- **Setup:** Enable Arabic → English (popup). Focus textarea. Chip should appear.  
- **Type:** `أريد إرسال هذا البريد إلى المشرف غدًا.` (include `؟` or `.` or newline)  
- **Expected (product):** English after sentence boundary.  
- **Expected (current enforce):** Decision may be `translation` or suggestion; **field likely stays Arabic** (no replacement).  
- **Must not:** Translate before boundary.  
- **Record:** If English appears, you are in **legacy scheduler** (enforce off / race / shadow). That is a **mode finding**.

### Test 7 — Translation pause

- **Setup:** Mode on. Chip Pause.  
- **Type Arabic + period.**  
- **Expected:** No translation this field. Global toggle still on. Other field (Test 14) still in mode.  
- **Resume:** Session can be recreated on next cycle. Still **no auto English output** in enforce until pipeline fetches.

### Test 8 — Translation not accidental

- **Setup:** Mode off.  
- **Type:** long Arabic + `.`  
- **Expected:** No translation. Chip hidden.

### Test 9 — Layout vs grammar

- **Type:** `hsjo]lj` (not `hwo`).  
- **Expected:** Layout wins.  
- **Also try:** `hwo ` — **may become `how`**. That is a **known contract fail** if you intended Arabic.

### Test 10 — Stale response

- **Enforce:** Hard to fail (no async apply).  
- **Setup:** Set `__FLOWLARY_ENGINE_MODE__ = 'off'` or `internal_shadow` so live/correction schedulers run. Type Arabic, wait ~200ms, delete/replace quickly.  
- **Expected:** Old translation discarded (`isStaleTicket`).  
- **Must not:** Old English overwrite new Arabic.

### Test 11 — Manual

- **Setup:** Help style Shortcuts only.  
- **Type** `I dont know`  
- **Expected:** No auto write.  
- **Shortcut** Fix Writing.  
- **Expected:** Feature execute + Write Gate (remote if consented). **Not** `decideWriting`.

### Test 12 — Password / OTP

- **Setup:** `<input type="password">` or autocomplete one-time-code.  
- **Type anything.**  
- **Expected:** `evaluateFieldSafety` blocks; no auto write. Shortcuts blocked by orchestrator safety.

### Test 13 — Excluded site

- **Setup:** Dashboard excluded hosts include current hostname.  
- **Expected:** `InputEngine.shouldAssist` false — **no EventBus assist events**; no auto write.

### Test 14 — Multiple fields

- **Setup:** Mode on. Two textareas. Pause A. Type sentence in B and A.  
- **Expected:** Pause is per FieldSession. B still “in translation mode.” Enforce still **won’t insert English**.  
- **Must not:** Pause A turn off global toggle.

### Test 15 — System write loop

- **Setup:** Auto layout on `hsjo]lj `.  
- **Expected:** One remap. SYSTEM input ignored. No immediate second remap.  
- **Must not:** Oscillate.

---

# 20. Wave A/B/C/D Status

The repo’s historical numbering is **Phase 1–32 / WL\*** (marketing, billing, learning). Unified writing is a **parallel** track (`docs/architecture/unified-writing-*.md`, `core/engine`, `core/writeGate`). Those Waves are **not** the same as Phase 22 / WL4.

| Wave | Status | Evidence | Missing |
|---|---|---|---|
| **A — Policy + Write Gate + UX foundation** | **PARTIAL** | `UserWritingPolicy`, projection, popup help style + three capabilities, First Win questions, `commitWriteTransaction`, content-script live hydrate | Single settings IA; no excludedHosts on policy; Speed Box bypass; First Win helpStyle coupling; engineMode comments vs enforce default |
| **B — Enforce layout** | **PARTIAL** | `startEnforceCoordinator`, layout-first `decideWriting`, local remap writes, schedulers gated | Boot race; remote layout unused in enforce; `"hwo"` hole; contenteditable auto off (tier 2) |
| **C — Translation session + English** | **PARTIAL** | Session id + pause + chip; sentence boundary helper; polish flag; instant English; shortcuts | Enforce **cannot apply** translation; no suggestion UI; remote English auto off; pause not in `runLiveTranslation`; tags not invalidated |
| **D — Settings + analytics + acceptance** | **PARTIAL** | writingAnalytics buffer; dual settings still shipped; some unit tests | Honest applied-outcome on decision events; learning origin; contract tests; browser acceptance |

---

# 21. Dead / Legacy / Duplicate Logic

| Item | Where | Active? | Conflict? | Later remove? |
|---|---|---|---|---|
| Layout/Correction/Translation schedulers as auto writers | `features/*/scheduler.ts` | Subscribed; **writes off in enforce** | Duplicate decide/write vs pipeline | Yes, after pipeline owns remote + suggestions |
| `collectShadowCandidates` vs scheduler heuristics | `engine/candidates.ts` vs features | Both exist | Drift (remote only on legacy) | Merge adapters |
| `flag.ts` “Default OFF” vs `setInternalEngineMode('enforce')` | `flag.ts` / `engine/index.ts` | Both in tree | Docs/tests vs production | Align comments + persist policy |
| Shadow coordinator | `engine/coordinator.ts` | Only if `internal_shadow` | Dual auto if shadow + schedulers | Keep for compare or delete |
| `currentParagraph` | `segments.ts` | Unused by live pause | Confusion vs old pause-replace | Or wire deliberately |
| `ENGINE_VERSION = '2.0.0-shadow'` | `types.ts` | Metadata | Enforce is not shadow | Rename when honest |
| Direct/Card settings | SettingsPanel, SET_CORRECTION/TRANSLATION | **Yes, user-visible** | Diverge from helpStyle | Hide or bind |
| Languages live toggle | SettingsPanel | Yes | Diverge from `arabicToEnglishMode` | Bind to policy |
| `onboarding.stepTools` = “Tools” | i18n | Yes | Three-tools mental model | Rename |
| Quick actions Fix Writing / Translate / Fix Layout | HomeView | Yes | Tool chooser | Keep as shortcuts only, relabel |
| Speed Box insert | `speedBox.ts` | Yes | Second writer | Route through gate |
| `writeReplacement` public | `editor.ts` | Used by gate + tests | Bypass risk | Internalize |
| `runLiveTranslation` pause gap | `liveTranslate.ts` | If scheduler on | Pause invariant | Check pause |
| Chip hardcoded EN | `sessionChip.ts` | Yes | i18n unused | Use catalog |
| Phase/WL reports | `docs/audit/*`, `PHASE*.md` | Docs only | Stale “complete” claims | Treat as historical |
| Website writing lab | `website/` | Separate app | Not this EventBus | Out of extension runtime |

---

# 22. Scorecard

Scores are **runtime + contract**, not “file exists.”

| # | Dimension | /100 | Why |
|---|---|---|---|
| 1 | Product contract alignment | 42 | One-assistant copy + dual writers + incomplete enforce loop |
| 2 | Decision Engine implementation | 55 | Real `decideWriting`; incomplete candidates/apply |
| 3 | Intent understanding | 48 | Policy + heuristics; no intent type; `"hwo"` fail |
| 4 | One-writer enforcement | 62 | Gate is the common path; Speed Box + public editor + boot race |
| 5 | Layout correctness | 70 | Strong local lexicon path; short-token rules; remote unused in enforce |
| 6 | Translation session | 45 | Session + chip + explicit mode; **no enforce apply** |
| 7 | English assistance | 40 | Instant map only in auto enforce; remote = shortcut |
| 8 | Mixed-language handling | 38 | Detect/freeze, not chunk act |
| 9 | Async safety | 72 | Good tickets on legacy async; enforce has little async |
| 10 | Settings/policy architecture | 50 | Policy exists; dual writes; First Win coupling |
| 11 | Popup UX | 58 | Capabilities + help style + three tool buttons |
| 12 | Onboarding UX | 62 | Right questions; “Tools” label; skip/defaults OK; helpStyle bug |
| 13 | Settings UX | 45 | Duplicates and implementation modes still exposed |
| 14 | In-field UX | 40 | Chip exists but crude; suggestions dead in enforce |
| 15 | Analytics | 48 | No raw text; wrong decision outcome; learning origin weak |
| 16 | Testing | 40 | Unit islands; zero enforce-pipeline / chip / browser contract |
| 17 | Manual test readiness | 70 | Plan above is executable; expected results must note enforce gaps |

### OVERALL PROJECT READINESS: **51 / 100**

Weighted toward architecture and writer correctness:

`0.15×42 + 0.15×55 + 0.10×62 + 0.10×48 + 0.10×70 + 0.10×45 + 0.08×40 + 0.07×38 + 0.05×72 + 0.05×50 + 0.05×51 (UX mean of 11–14)` ≈ **51**.

This is **not** a launch score. It is “how much of the intended unified assistant is true in the running extension.”

---

# 23. Critical Findings

1. **Default production auto path is enforce (memory), not legacy — after a race.** Comments/tests saying default `off` are **incomplete**.  
2. **Enforce cannot translate.** No candidate `replacement`; no API in the pipeline.  
3. **Enforce cannot show suggestions.** helpStyle `suggestions` ≈ silence.  
4. **Enforce English auto is a typo dictionary**, not the correction service.  
5. **Three schedulers still start** and can write until enforce hydrates, or forever in `internal_shadow`.  
6. **Speed Box insert bypasses the Write Gate.**  
7. **`"hwo"` → `how`** can beat the layout-first product rule.  
8. **First Win “English shortcut only” disables all auto help**, including layout.  
9. **Settings can disagree** (policy AR→EN vs Languages live; helpStyle vs Direct/Card).  
10. **Translation pause is not checked** in `runLiveTranslation`.  
11. **Translated ranges** are not invalidated on edit; correction learning tags `original_en`.  
12. **Chip** is not i18n/a11y/layout-complete; refresh is buggy.  
13. **No tests** for the enforce pipeline that users actually run.

---

# 24. Remaining Work

### P0 — Architecture / correctness blockers

| Problem | Location | Current | Target | Dependency | Size | Blocks production? |
|---|---|---|---|---|---|---|
| Boot race: schedulers write before enforce | `content_script.ts`, `engine/index.ts` | Features start; mode off; then enforce | Enable enforce **before** `feature.start()`, or don’t start schedulers until mode known | None | S | Yes (first-second writes) |
| Translation auto is a no-op in enforce | `candidates.ts`, `pipeline.ts` | Decide without replacement | One async translate through gate + stale checks + tag | Session + sentence | L | Yes if AR→EN is sold |
| Suggestion path dead | `pipeline.ts`, cards | Return `'suggestion'` | Mount one suggestion UI from decision | Cards exist | M | Yes if helpStyle suggestions is shipped |
| Speed Box page insert bypass | `speedBox.ts` `insertResult` | Direct `.value` | `commitWriteTransaction` | Gate | S | Yes for one-writer claim |
| Policy / live / mode divergence | SettingsPanel, First Win, SET_* | Two controls | One policy write path | UX | M | Yes for predictable behavior |

### P1 — Core behavior

| Problem | Location | Current | Target | Dependency | Size | Blocks? |
|---|---|---|---|---|---|---|
| Remote English not in pipeline | `candidates.ts`, correction client | Instant only | Optional high-confidence remote **after** layout, same gate | P0 translation pattern | L | For “English assist” auto |
| `"hwo"` vs layout | `instantSpell.ts`, heuristics | Typo map wins | Layout suspicion / withhold short Latin | Layout lexicon | M | Contract example |
| Mixed chunk translation | `candidates.ts`, segments | Whole sentence | Translate Arabic spans; keep `API`/`deploy` | P0 translate | L | Bilingual promise |
| Invalidate translated tags on edit | `FieldSession`, InputEngine | Stale ranges | Clear/adjust on generation bump | Session | M | Polish correctness |
| `runLiveTranslation` pause | `liveTranslate.ts` | Ignores pause | Honor pause or delete path | P0 race | S | If legacy can run |
| Cooldown vs bumpGeneration | FieldSession | User key clears cooldown | Document or don’t claim “field in cooldown” during typing | Product | S | No |

### P2 — UX alignment

| Problem | Location | Current | Target | Dependency | Size | Blocks? |
|---|---|---|---|---|---|---|
| Three tool buttons as primary | HomeView | Tools | Assistant + shortcuts secondary | Copy | S | Dogfood OK |
| Settings Direct/Card + duplicate live | SettingsPanel | Exposed | Advanced or remove | Policy | M | Confusion |
| Onboarding “Tools” | i18n `stepTools` | Tools | Help / Writing | None | S | No |
| First Win helpStyle | App.tsx | shortcuts_only global | Independent capabilities | Policy | S | Yes for first-run |
| Chip i18n/position/a11y | sessionChip.ts | EN hardcoded | Catalog + follow field | None | M | Translation UX |
| Operating state visible | Popup | Missing | Normal / Translation / Manual | Policy | S | Clarity |

### P3 — Testing

| Problem | Location | Current | Target | Size | Blocks? |
|---|---|---|---|---|---|
| No `runFieldCycle` tests | tests | Absent | Layout write, translation no-op, pause, cooldown, stale gen | M | Yes for regression |
| No enforce-default test | `startShadowEngine` | Tests reset to off | After start, mode enforce | S | Yes |
| No chip / First Win contract | UI tests | Thin popup tests | Pause, helpStyle coupling | M | No |
| No browser suite for Tests 1–15 | e2e | None | Chrome extension | L | Launch |

### P4 — Cleanup / polish

Remove or isolate schedulers after pipeline owns remote; rename ENGINE_VERSION; fix decision analytics outcome; align `flag.ts` comments; retire unused `currentParagraph` or document it; stop calling writing analytics “applied” incorrectly.

---

# 25. Recommended Next Implementation Phase

Do **not** start “Wave A from scratch.” Wave A is already **partially in tree**.

**Tell Cursor to implement next (safest order):**

### Phase N1 — Freeze the runtime you already have (S, 1–2 days)

1. Resolve engine mode **before** `correction.start()` / `layout.start()` / `translation.start()` (or start schedulers only if not enforce).  
2. Add tests: `startShadowEngine` → mode `enforce`; during enforce, scheduler `shouldRun` / `isLiveEnabled` false.  
3. Fix `flag.ts` comments so they match production.  
4. Route Speed Box `insertResult` through `commitWriteTransaction`.  
5. First Win: do **not** map English-shortcut to global `shortcuts_only`.

This makes “what happens on reload” **deterministic** and closes the worst writer holes **without** new AI.

### Phase N2 — Make Translation Mode real in enforce (M–L)

1. After a translation **decision**, fetch once with generation + field + slice hash.  
2. Apply **only** through the Write Gate; `tagTranslatedOutput`.  
3. Honor pause in **every** translate path (`runLiveTranslation` or delete that path).  
4. Keep sentence-boundary-only.  
5. Tests: mode off = no translate; pause A / translate B; stale discard.

Until N2, **do not dogfood Arabic→English as a product**.

### Phase N3 — Suggestions + English without a second brain (M)

1. Pipeline `suggestion` must open **one** card that commits via the gate.  
2. Remote English only as a candidate **after** layout clearance, same cycle rules.  
3. Hide or bind Direct/Card + Languages live toggle to policy.

### Phase N4 — Mixed language + `"hwo"` + analytics/tests (M)

Chunk-scoped translation; withhold instant spell on layout-ambiguous Latin; fix learning `textOrigin`; browser tests 1–15.

---

# 26. Answers to the 20 questions

**Q1.** Still **three capability modules**. Auto writes are **mostly** funneled through one enforce cycle **after** boot. Not yet one assistant.  
**Q2.** **Auto (enforce): yes** for local layout/instant English. **Shortcuts / Speed Box: no.**  
**Q3.** **No.** Speed Box insert does not. Tests can call `writeReplacement`.  
**Q4.** **Yes** during boot race, in `internal_shadow`, and via shortcut vs enforce on the same field. After settle + enforce, **auto** capabilities should not independently write.  
**Q5.** **A real in-memory session object**, not a durable product session.  
**Q6.** **Explicit flag required.** Not accidental from Arabic **in enforce**. Legacy live still requires the flag.  
**Q7.** **Pause flag works** for pipeline session create. Global switch is independent. Chip exists. `runLiveTranslation` **ignores** pause. Session not persisted.  
**Q8.** **Intent-first is documented and only partly coded** (policy + heuristics, not an intent engine).  
**Q9.** **When layout candidate is high-confidence, yes.** `"hwo"` may lose to spelling.  
**Q10.** **Mostly yes** for layout auto (≤2 + context). Instant spell also ≥3.  
**Q11.** **Analyze at chunk level; act at field/sentence level.** Not bilingual chunk writes.  
**Q12.** **In-memory ranges + analytics field.** Fragile; learning often `original_en`.  
**Q13.** **Unlikely in enforce auto** (no async apply). **Possible** on shortcut/legacy if checks fail; Speed Box can overwrite.  
**Q14.** **Mitigated** (SYSTEM origin, instant idempotence). User keystroke **clears cooldown** so a second cycle can run immediately.  
**Q15.** **Both.** Lead copy is one assistant; first chrome is three tools.  
**Q16.** **Questions match; labels and First Win helpStyle do not fully match.**  
**Q17.** **Policy exists; settings still dual.**  
**Q18.** **No** for insert; overlay AI is its own path.  
**Q19.** **Partially.** No raw text; decision outcome wrong; learning can mis-count.  
**Q20.** **About half** of the intended architecture is implemented **and** enforced for **local layout + safety + explicit translation flag**. **Well under half** of translation/English/mixed/suggestion/UX is enforced.

---

# FINAL VERDICT

## PARTIALLY READY — core exists but enforcement/UX gaps remain

**Why not NOT READY:** There is a real `decideWriting`, a real Write Gate, an enforce coordinator on the content-script EventBus, layout-before-grammar, explicit translation policy, field pause flags, safety for password/OTP/excluded hosts, and live policy hydrate. After hydrate, the three schedulers **do not** independently auto-write.

**Why not READY FOR DOGFOODING as a unified bilingual assistant:** Arabic→English **does not apply** in the default enforce loop. Suggestion mode is empty. English auto is a short typo list. Speed Box is a second writer. Boot can still run legacy writers. UI still teaches three tools. Mixed language is frozen, not handled.

**Why not READY:** Contract is not implemented and enforced end-to-end.

**Dogfood that *is* honest today:** wrong-keyboard **high-confidence** tokens (e.g. `hsjo]lj`), safety fields, shortcuts, and “translation switch does not flip on from Arabic alone.”

**Do not dogfood as done:** live sentence translation, suggestion help style, “one writer,” or `"hwo"` as a layout case.
