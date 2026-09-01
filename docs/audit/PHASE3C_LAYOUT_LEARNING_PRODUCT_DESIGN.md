# PHASE 3C — Layout Learning Product + Architecture Design Audit

**Date:** 2026-08-27  
**Mode:** FOREnsic product + architecture audit — **no production code changes**  
**Baseline:**  
- `docs/audit/FLOWLARY_COMPLETE_ARCHITECTURE_AUDIT.md`  
- `docs/audit/PHASE3A_CORE_FEATURES_LEARNING_FORENSIC_AUDIT.md`  
- `docs/audit/PHASE3B_CORE_INTEGRATION_HARDENING.md`

**Verification:** No production source files were modified in this phase. Only this document was created.

---

## 1. Executive Summary

**Question:** Should Flowlary learn from keyboard-layout mistakes?

**Answer:** **Yes — but only under strict acceptance semantics and with UI/metric separation.** Layout learning can strengthen Flowlary’s differentiation, but the **current runtime does not represent user acceptance** for most layout fixes. Automatic layout replacement is the dominant path and must **not** become learning events without explicit product approval.

**Recommendation:** **OPTION B — ADD LAYOUT TO LEARNING** with a **narrow Phase 3D scope**:

| Include in Phase 3D | Exclude from Phase 3D |
|---------------------|----------------------|
| Manual `FIX_LAYOUT` command fixes only | Automatic scheduler fixes |
| `action: accepted` only | `detected` / `rejected` (no layout box UI exists) |
| Dual record: History + LearningEvent | Historical `FIX_LAYOUT` backfill |
| Progress `byType.layout` with UI grouping | Full layout Practice (defer Phase 3E) |
| Account-scoped local event write (0 Groq) | Auto-modifying `personalExceptions` from learning |

**Do not** map layout into spelling/grammar/wording. **Do not** learn from automatic corrections until accept/reject UX exists.

**Layout learning value:** MEDIUM today (manual path is minority), HIGH potential after acceptance UX.  
**False-positive risk:** HIGH if auto-applies are included; LOW–MEDIUM for manual-only.  
**Implementation complexity:** MEDIUM.

---

## 2. Current Layout Architecture

### Pipeline (verified)

```
User input (DOM)
  → InputEngine (FieldSession, generation)
  → LayoutScheduler (auto) OR LayoutFeature.execute (manual FIX_LAYOUT) OR SpeedBox (manual remap)
  → planFieldFixes / localClassificationHint / LayoutClassifier
  → mapLayout + canCommitMismatch (lexicon gates)
  → applyLayoutFix → writeReplacement (WriteOrigin FIX_LAYOUT)
  → recordHistory (optional, when historyMode set)
```

### Key files

| Component | File | Function / class |
|-----------|------|------------------|
| Feature entry | `extension/src/features/layout/LayoutFeature.ts` | `execute()` — manual FIX_LAYOUT |
| Auto scheduler | `extension/src/features/layout/scheduler.ts` | `LayoutScheduler.evaluate()` |
| Fix orchestration | `extension/src/features/layout/fixCurrentText.ts` | `fixCurrentText()`, `applyLayoutFix()` |
| Classifier | `extension/src/features/layout/classifier/LayoutClassifier.ts` | `classify()` — local → cache → Groq |
| Background AI | `extension/src/background/classify.ts` | Groq layout classification |
| Speed Box | `extension/src/features/layout/speedBox.ts` | Pure local remap — **no history** |
| Heuristics | `extension/src/features/layout/layouts/heuristics.ts` | `localClassificationHint`, `canCommitMismatch` |
| Mapping | `extension/src/features/layout/layouts/registry.ts` | `mapLayout`, 12 layouts |
| Profile | `extension/src/features/layout/profile/index.ts` | `LayoutProfileState` (exceptions + trust events) |
| Trust (unused runtime) | `extension/src/features/layout/profile/trust.ts` | `applyCorrectionEvent()` — **tests only** |
| History write | `extension/src/storage/history/record.ts` | `recordHistory()` |

### Supported layouts (12)

`en-US-qwerty`, `ar-101`, `ru-standard`, plus world layouts (de, fr, tr, el, es, pt, uk, fa) — `registry.ts`.

### Confidence / local vs AI

- **Local:** `localClassificationHint` non-null → no Groq (`LayoutClassifier.ts:112–129`)
- **Cache hit:** no Groq
- **Groq fallback:** cache miss + no local hint → `/api/ai/layout-classification` (1 credit)
- **Auto-commit gate:** `canCommitMismatch()` lexicon proof (EN/AR/RU conservative); `HIGH_CONFIDENCE_QWERTY_RU = {'ghbdtn'}`

### Account ownership

- History: account-scoped via `HistoryService` + `activeAccountContext` (Phase 3B verified)
- Layout profile (`personalExceptions`, `events`): account-scoped `layout.profile`
- Layout AI cache: account-keyed (Phase 2)
- Content script: account restored before writes (Phase 3B)

---

## 3. Current Layout History

**FILE:** `extension/src/features/layout/fixCurrentText.ts`  
**FUNCTION:** `applyLayoutFix()` lines 115–143

**CURRENT BEHAVIOR:** History recorded only when `options.historyMode` is set:

| Path | historyMode | Evidence |
|------|-------------|----------|
| Scheduler local fix | `'automatic'` | `scheduler.ts:152` |
| Scheduler cache/remote fix | `'automatic'` | `scheduler.ts:214`, `255` |
| Manual `fixCurrentText` / FIX_LAYOUT command | `'manual'` | `fixCurrentText.ts:193`, `252` |
| Speed Box | **none** | No `recordHistory` in `speedBox.ts` |

**History entry shape:**

```typescript
{
  operation: 'FIX_LAYOUT',
  sourceText: fix.word,        // token, e.g. "ghbdtn"
  resultText: fix.corrected,   // e.g. "привет"
  mode: 'manual' | 'automatic',
  metadata?: { sourceLayout, targetLayout }
}
```

**Learning events:** **NOT emitted** — no import of `recordCorrectionLearning` in layout code.

---

## 4. What Constitutes a Layout Error

| Scenario | Learning-worthy? | Rationale |
|----------|------------------|-----------|
| **A.** Wrong keyboard layout (mistake) | **Yes** (if user accepted fix) | Core product case |
| **B.** Intentional foreign-language string | **No** | Valid user intent; exceptions exist for this |
| **C.** False-positive detection | **No** | Must not train progress/practice |
| **D.** Manual FIX_LAYOUT command | **Yes** | Explicit user action = acceptance |
| **E.** Ignored suggestion | **N/A today** | No layout suggestion UI — auto-apply or nothing |
| **F.** Automatic scheduler apply | **No** (recommended) | No explicit acceptance; high false-positive risk |
| **G.** User revert | **No** | Revert = negative signal; trust system has `reverted` but **not wired** |
| **H.** Repeated same mistake | **Yes** (if accepted events only) | Enables recurring-pattern value |

**NOT every `FIX_LAYOUT` history row is learning-worthy.** Majority are `mode: 'automatic'` without user confirmation.

---

## 5. Acceptance Semantics

### Current system states

| State | Represented? | Where |
|-------|--------------|-------|
| Detected | **No** (layout) | No layout correction card |
| Suggested | **No** | No preview-before-apply for auto path |
| Accepted | **Partial** | Manual command ≈ accept; auto-apply ≈ implicit |
| Rejected | **No** | No dismiss UI |
| Ignored | **Partial** | Trust model: `CorrectionEventKind: 'ignored'` — **not wired to runtime** |
| Auto-applied | **Yes** | `historyMode: 'automatic'` |
| Reverted | **Partial** | Trust model: `'reverted'` — **not wired** (`trust.ts`; only `trust.test.ts`) |

**Evidence — trust not wired:**

```
grep applyCorrectionEvent → only tests/unit/layout/trust.test.ts
```

### Recommended primary semantic (Phase 3D)

**Record layout learning only on explicit user-initiated fix:**

- Manual `FIX_LAYOUT` command (`historyMode: 'manual'`)
- Future: explicit accept button if layout preview UI is added

**Do not record on:**

- `historyMode: 'automatic'`
- Speed Box remaps
- Classifier-only detection without apply

**Align with correction taxonomy:** Use `action: 'accepted'` only (like direct-mode AI correction). No `detected` until layout box mode exists.

---

## 6. False Positive Analysis

| Case | Safe to learn? | Mitigation today |
|------|----------------|------------------|
| Quoted example `"ghbdtn"` | **No** | Manual-only gate; user chose to fix |
| Intentional other language | **No** | `personalExceptions`; `isExceptedToken` |
| URL/code/token | **Partial** | `isSafeToken`, `isInsideMarkdownCode` |
| Mixed-language field | **Risky** | Context heuristics; lexicon gates |
| Transliteration | **Risky** | May look like layout mismatch |
| Auto-applied wrong fix | **No** | Exclude automatic historyMode |
| User would revert | **No** | No revert hook today |

**FALSE POSITIVE RISK:** **HIGH** if all FIX_LAYOUT → learning. **LOW–MEDIUM** for manual-only policy.

---

## 7. Learning Event Design

**FILE:** `packages/shared/src/learningEvents.ts`

**Current schema — sufficient fields for layout without new columns:**

```typescript
type LearningEvent = {
  id, version, timestamp, batchId,
  source: 'writing' | 'practice',
  category: LearningEventCategory,  // currently = ChangeType
  original, corrected,
  normalizedOriginal, normalizedCorrected,
  action: 'detected' | 'accepted' | 'rejected',
  sampleWordCount, sampleHash
}
```

**Missing for layout — category value only:**

- `isLearningEventCategory()` accepts only `'spelling' | 'grammar' | 'wording'` (line 55–57)
- Must add `'layout'` to `ChangeType` and validator

**Optional (not required for MVP):**

- `LearningEventSource: 'layout'` — would clarify analytics but not required if `category === 'layout'`
- Layout pair metadata (`sourceLayout`, `targetLayout`) — available in History metadata; could use `batchId` prefix `layout:manual:{requestId}` without schema change

**Validation constraints:**

- `isValidLearningChange(original, corrected)` — works for token pairs
- `changePresentInWritingSample(sample, original)` — requires `sample.includes(original)`; use field text or token-containing slice as `sampleText`

---

## 8. ChangeType Analysis

**FILE:** `packages/shared/src/correction/index.ts:16`

```typescript
export type ChangeType = 'spelling' | 'grammar' | 'wording'
```

**Adding `'layout'` is technically feasible** but requires dependency updates:

| Location | Impact |
|----------|--------|
| `packages/shared/src/learningEvents.ts` | `isLearningEventCategory` |
| `packages/shared/src/learning.ts` | `LEARNING_FOCUS_AREAS` — **separate decision** (layout may be excluded from onboarding focus) |
| `extension/src/storage/learning/progress.ts` | `countErrorsByType` hard-coded `{ spelling, grammar, wording }` lines 115–118 |
| `extension/src/storage/learning/progress.ts` | `byTypePercent` hard-coded lines 243–246 |
| `extension/src/dashboard/panels/ProgressPanel.tsx` | `(['spelling', 'grammar', 'wording'] as const)` line 127 |
| `extension/src/dashboard/panels/PracticePanel.tsx` | Focus picker, Groq-based practice |
| `extension/src/storage/learning/practice/prompts.ts` | Category-specific prompt pools |
| `packages/shared/src/practice.ts` | `PracticeFocus`, `sanitizePracticeSession` focus validation |
| `extension/src/storage/learning/practice/sessions.ts` | Focus enum validation lines 57–63 |
| `extension/src/popup/i18n/en.ts` | `learning.focus.*` labels |
| `extension/src/storage/learning/events/validation.ts` | `sanitizeLearningEvent` via `isLearningEventCategory` |
| Import/export | Events with unknown category **dropped** on import sanitize |

**AI correction path:** Groq prompt lists spelling/grammar/wording only — **layout must NOT flow through `CorrectionResponse.changes`** to avoid prompt pollution.

**Dependency map conclusion:** ~15 files; no exhaustiveness compiler for TS unions — manual audit required.

---

## 9. LearningEventCategory Analysis

**FILE:** `packages/shared/src/learningEvents.ts:18`

```typescript
export type LearningEventCategory = ChangeType
```

**Recommendation:** **`layout` as a new category** — do not map to spelling.

| Alternative | Semantic consequence | Verdict |
|-------------|---------------------|---------|
| Map to `spelling` | Conflates language errors with input mechanics | **Reject** |
| Map to `wording` | Misleading for keyboard errors | **Reject** |
| New `layout` category | Clear semantics, filterable | **Accept** |

---

## 10. History vs Learning

| Store | Purpose | Layout today | Proposed |
|-------|---------|--------------|----------|
| **History** | Activity log: what Flowlary did | All applied FIX_LAYOUT (auto + manual) | **Unchanged** — full audit trail |
| **Learning** | Mistakes to improve / practice | None | Manual accepted fixes only |

**Dual recording is appropriate:** History answers “what happened?” Learning answers “what mistake pattern should we track?”

**Avoid duplicate semantics:** Same fix may appear in both stores with different filters (history includes auto; learning excludes auto).

---

## 11. Proposed Event Shape

**Example:** User runs manual FIX_LAYOUT on token `ghbdtn` → `привет` in field `"hello ghbdtn world"`.

**Proposed Phase 3D event (fits current schema + new category):**

```typescript
{
  id: "<uuid>",
  version: 1,
  timestamp: 1730000000000,
  batchId: "layout-manual-<fieldId>-<requestId>",
  source: "writing",
  category: "layout",
  original: "ghbdtn",
  corrected: "привет",
  normalizedOriginal: "ghbdtn",
  normalizedCorrected: "привет",
  action: "accepted",
  sampleWordCount: 3,
  sampleHash: "<hash of sample text>"
}
```

**Emission point (future):** `applyLayoutFix()` when `historyMode === 'manual'` only, via new `recordLayoutLearningAccepted()` helper — parallel to `recordCorrectionAccepted`, not through Groq correction pipeline.

**NOT proposed:** `changeType = FIX_LAYOUT` — FIX_LAYOUT is `HistoryOperation`, not `ChangeType`.

---

## 12. Rejected Corrections

**Current:** Layout has **no reject path** in UI.

**Recommendation:** When reject UX is added (future), emit `action: 'rejected'` — excluded from `errorCount` (consistent with `progress.ts` lines 74–75).

**Today:** Neither history nor learning for rejected layout (nothing to record).

---

## 13. Automatic Corrections

**FILE:** `extension/src/features/layout/scheduler.ts`  
**CURRENT:** Auto-applies with `historyMode: 'automatic'`.

**Should automatic correction generate LearningEvent?**

**NO** — unless product explicitly equates auto-replace with user acceptance.

**Reasons:**

1. No opt-out at moment of apply
2. False positives become “learned mistakes”
3. Contradicts correction box semantics (detected → accept/reject)
4. Trust/revert system exists but is **not connected** — cannot detect user disagreement

**Future path:** If layout preview + accept/reject is built, auto-detected + user-accepted could emit learning; auto-applied without UI remains history-only.

---

## 14. Unique Error Identity

**Current learning dedupe:**

**FILE:** `packages/shared/src/learningEvents.ts:71–73`

```
key = batchId : category : normalizedOriginal
```

- `normalizedOriginal` = trim, collapse whitespace, lowercase
- Rejected events excluded from error count
- Accepted wins over detected for same key

**Layout recommendation:**

| Identity unit | Recommendation |
|---------------|----------------|
| Raw token `ghbdtn` | **Yes** — use as `original` |
| Layout pair `ghbdtn` → `привет` | Store in `corrected`; same key if same normalized original |
| `ghbdtn` vs `ghbdtn!` | **Different tokens** — different fixes at word level (`FieldFix.word`) |
| Case | Normalized away for Latin; Cyrillic case preserved in display fields |

**Repeated mistake:** Same `normalizedOriginal` + `category: layout` across batches increments recurring pattern count — same as spelling.

---

## 15. Progress Metrics

**FILE:** `extension/src/storage/learning/progress.ts`

**Current `errorCount`:** Unique non-rejected keys across all categories.

**Before (example):**

| Category | Unique errors |
|----------|---------------|
| spelling | 20 |
| grammar | 10 |
| wording | 5 |
| **Total errorCount** | **35** |

**After (with 7 manual layout events):**

| Category | Unique errors |
|----------|---------------|
| spelling | 20 |
| grammar | 10 |
| wording | 5 |
| layout | 7 |
| **Total errorCount** | **42** |

**`errorsPer100Words`:** Denominator is writing sample word counts from learning samples — layout events would need sensible `sampleWordCount` from field context or layout events **excluded from denominator** (recommended: include field word count for manual fix context).

**Metric contamination risk:** Layout errors mixed with writing errors inflates “errors per 100 words” for users who type multilingually. **Mitigation:** UI grouping (Section 29) + optional `writingErrorCount` vs `layoutErrorCount` split in progress (future field — not in schema today; can compute from category filter).

---

## 16. Dashboard Impact

| Surface | Hard-coded? | Future change |
|---------|-------------|---------------|
| `ProgressPanel.tsx:127` | Yes — `['spelling','grammar','wording']` | Add `'layout'` or INPUT group |
| `ProgressPanel` category labels | `learning.focus.${category}` | Add `learning.focus.layout` i18n |
| `PracticePanel.tsx:73` | Default focus `'grammar'` | Layout practice N/A in 3D |
| `LearningSettingsSection.tsx` | `LEARNING_FOCUS_AREAS` | **Do not** add layout to onboarding focus without UX design |
| `OnboardingFlow.tsx` | focus area checkboxes | Unchanged initially |
| `uniqueErrors` label (Phase 3B) | Shows `errorCount` | May include layout if events added |

**Without changes:** Layout events would be **counted in errorCount** but **invisible in byType chart** (hard-coded trinity) — **bug if category added without UI update**.

---

## 17. Practice Impact

**FILE:** `extension/src/storage/learning/practice/recommendation.ts`

Practice selects from `LearningEvent` where `source === 'writing'` and `action !== 'rejected'`, groups by `category` + `normalizedOriginal`.

**If layout events added:**

- Recurring layout patterns **would surface** in recommendation math automatically
- **But** `PracticePanel` uses `requestPracticeCorrection` → Groq English correction — **wrong interaction for layout**

**Phase 3D:** Exclude layout from practice focus picker; filter `category !== 'layout'` in recommendation until Phase 3E.

---

## 18. Layout Practice Design (Future — Phase 3E)

**Smallest useful interaction:**

> Show mistyped token → user types intended text in target script/layout.

Example prompt: “You typed `ghbdtn` with the wrong keyboard layout. Type what you meant.”

**Not:** English grammar correction of a sentence containing the error.

**Scoring:** Compare normalized user input to `displayCorrected` — local string match, **0 Groq**.

**Defer full Practice integration** until manual learning events prove recurring patterns exist in real usage.

---

## 19. Personalization Value

**Real (with manual-only events):**

- Recurring token patterns (`ghbdtn` × N)
- Category trend for layout vs writing
- Dashboard recurring mistakes section

**Not real today:**

- Trust/exception auto-update from learning (not wired)
- Adaptive layout detection from learning history
- “AI learning” — deterministic aggregation only

**Value level:** MEDIUM now; HIGH if accept/reject UX captures auto-fix feedback later.

---

## 20. User Value

### History-only journey

User fixes layout → sees Activity → no Progress/Practice benefit → repeated mistakes invisible in learning dashboards.

### History + Learning journey (proposed)

User manually fixes layout → Progress shows layout mistake count → recurring pattern visible → (future) targeted layout practice → fewer repeated wrong-layout tokens.

**Time saved:** Indirect — through awareness, not automatic adaptation.  
**Differentiation:** Layout is Flowlary-specific; writing assistants do not track this.

---

## 21. Product Differentiation

Flowlary’s promise: **recurring input/writing mistakes → measurable improvement.**

Layout mistakes fit for bilingual / multi-script users. Learning layout **supports** positioning **if** acceptance semantics are honest.

**Do not claim** “AI learns your keyboard” — aggregation only.

---

## 22. Cost Impact

| Operation | Groq cost |
|-----------|-----------|
| Layout local fix | 0 |
| Layout classifier fallback | 1 credit (unchanged) |
| **LearningEvent write** | **0** — local chrome.storage |
| Practice (future layout drill) | 0 if local compare |

**Learning event creation must not call Groq.** Emit from `applyLayoutFix` side effect only.

---

## 23. Privacy

Same as existing learning events:

- Account-scoped storage
- Original/corrected text stored locally
- Export includes `learningEvents` (`export.ts:57`)
- Clear on user data reset
- No new telemetry proposed

Layout tokens may be **more sensitive** (passwords typed on wrong layout) — same history privacy rules apply; respect `canRecordHistory` / field safety gates.

---

## 24. Account Isolation

Future layout learning events use same path as correction learning:

- `recordLearningEvents` → `activeAccountContext` guard
- Account-scoped `learning.events` key
- Phase 3B content-script bootstrap preserves context

**A→B switch:** Events isolated per account (verified pattern from Phase 3B tests).

---

## 25. Personal Exceptions vs Learning

| Concept | Purpose | Storage |
|---------|---------|---------|
| `personalExceptions` | Tokens layout system must never remap | `layout.profile.personalExceptions` |
| Layout learning | Mistakes user made and fixed | `learning.events` |

**Must remain separate.**

**Learning must NOT auto-modify `personalExceptions`** without explicit user action (e.g. “Ignore this word” → exception list).

Trust system (`ignored` → addException) exists in `trust.ts` but is **not wired** — do not conflate with learning ingestion.

---

## 26. Import / Export

**Export:** Includes raw learning events array — new `layout` category exports transparently.

**Import:** `sanitizeLearningEvent` drops unknown categories — **must update validator before layout events round-trip**.

**Schema version:** Consider bumping `LEARNING_EVENT_STORE_VERSION` or export schema note — not strictly required if category is additive and validators updated.

---

## 27. Migration

**Do NOT backfill** existing FIX_LAYOUT history into learning.

| Reason | Evidence |
|--------|----------|
| Missing acceptance | Most entries `mode: 'automatic'` |
| Unknown user intent | Auto-applied without confirm |
| False positives indistinguishable | No reject/revert in history |

**Forward-only:** Manual FIX_LAYOUT from Phase 3D deploy date onward.

---

## 28. Metric Contamination

**Risk:** Users with heavy auto-layout see history activity but learning metrics stay low (manual-only policy) — **consistent if UI explains**.

**Risk:** If auto-applies added to learning, error rates spike without reflecting “writing quality.”

**Recommendation:** Display **Writing errors** (spelling/grammar/wording) and **Input / layout errors** separately in Progress UI.

---

## 29. Category Grouping

**Recommend UI grouping:**

```
WRITING
  spelling · grammar · wording

INPUT
  layout
```

**Why:** Different mental models — language proficiency vs keyboard/input configuration. Prevents users interpreting layout fixes as “bad English.”

Optional: exclude layout from `errorsPer100Words` headline or add footnote.

---

## 30. Success Metrics (post-implementation)

Measurable without fake benchmarks:

1. Count of manual layout learning events per active account per week
2. Recurring layout pattern count (same `normalizedOriginal`, count ≥ 2)
3. Manual FIX_LAYOUT usage rate vs automatic-only users
4. Repeat rate: same layout token fixed again within 30 days (should decrease)
5. Practice completion for layout drills (Phase 3E)
6. Zero Groq calls attributable to learning event writes

---

## 31. Future Implementation Plan (Phase 3D — DO NOT EXECUTE)

### STEP 1: Schema
- **Files:** `packages/shared/src/correction/index.ts`, `packages/shared/src/learningEvents.ts`
- **Change:** Add `'layout'` to `ChangeType`; update `isLearningEventCategory()`
- **Risk:** Import drops legacy if validator not updated

### STEP 2: ChangeType
- **Files:** As above + shared tests
- **Risk:** AI correction TYPE_MAP must not map unknown to layout

### STEP 3: LearningEventCategory
- **Files:** Same; keep `LEARNING_FOCUS_AREAS` unchanged initially

### STEP 4: Layout accepted-event emission
- **Files:** New `recordLayoutLearning.ts`; `fixCurrentText.ts` `applyLayoutFix()`
- **Change:** When `historyMode === 'manual'`, call recorder with token pair + sample text
- **Risk:** Must not fire on automatic path

### STEP 5: Progress aggregation
- **Files:** `progress.ts` — add `layout: 0` to counts and byTypePercent
- **Risk:** Percent rounding must handle 4 categories

### STEP 6: Dashboard
- **Files:** `ProgressPanel.tsx`, `en.ts` (+ locale merge), optional INPUT group UI
- **Risk:** Missing i18n shows raw key

### STEP 7: Practice
- **Phase 3E** — filter layout from Groq practice; build layout drill separately

### STEP 8: Import/export
- **Files:** `validation.ts`, import merge logic
- **Risk:** Old exports without layout still valid

### STEP 9: Tests
- See Section 32

### STEP 10: Migration
- **Forward-only**; no backfill script

---

## 32. Future Test Plan

1. Manual FIX_LAYOUT → learning event `category: layout`, `action: accepted`
2. Automatic scheduler fix → history yes, learning no
3. Instant typo → no layout event
4. Local layout → 0 credits (unchanged)
5. Groq classifier → unchanged billing
6. Account A manual fix → not visible to B
7. Account switch mid-fix → no cross-account write
8. Duplicate manual fix same token → dedupe by batchId rules
9. Repeated token across batches → recurring pattern count ≥ 2
10. Progress `byType.layout` increments
11. Dashboard shows layout label
12. Practice ignores layout in Phase 3D
13. Import/export round-trip with layout event
14. Historical FIX_LAYOUT not backfilled
15. Malformed layout category rejected on import

---

## 33. History-only Alternative (Strongest Case)

**Arguments for OPTION A:**

1. **Semantics:** Most fixes are automatic — history captures them; learning without acceptance lies about user intent.
2. **Scope:** Flowlary learning profile is English writing (`DEFAULT_LEARNING_LANGUAGE = 'en'`) — layout is input mechanics.
3. **False positives:** Layout detection is heuristic + optional Groq — teaching system from detections is risky.
4. **Practice mismatch:** Current Practice is English Groq correction — layout does not fit without new mode.
5. **Complexity:** 15+ files for category addition; metric UX needs careful splitting.
6. **Maintenance:** Trust/exception system partially built but unwired — fix that before second personalization channel.
7. **Simplicity:** History + Activity already shows FIX_LAYOUT with manual/automatic mode.

**History-only is defensible** if product prioritizes writing-quality learning over keyboard-quality learning.

---

## 34. Final Product Recommendation

**OPTION B — ADD LAYOUT TO LEARNING**

**With mandatory constraints:**

1. **Manual acceptance only** (`historyMode: 'manual'`) in Phase 3D
2. **No automatic apply → learning**
3. **No Speed Box → learning**
4. **No historical backfill**
5. **Separate UI grouping** (Writing vs Input)
6. **Practice deferred** to Phase 3E
7. **Do not map to spelling/grammar/wording**

**Why not OPTION A:** Flowlary’s differentiated value includes keyboard layout correction; users who repeatedly manual-fix layout mistakes receive no progress signal today — missed product story.

**Why not OPTION C alone:** Architecture is sufficiently understood; deferral only justified if product rejects manual-fix learning value — audit shows implementable path with bounded risk.

---

## Evidence Index (selected)

| Claim | File | Function | Evidence |
|-------|------|----------|----------|
| History on auto apply | `scheduler.ts:152` | `applyLocalFixes` | `historyMode: 'automatic'` |
| History on manual | `fixCurrentText.ts:193` | `fixCurrentText` | `historyMode: 'manual'` |
| No learning from layout | layout feature tree | — | No `recordCorrection*` imports |
| Category validator | `learningEvents.ts:55-57` | `isLearningEventCategory` | 3 values only |
| Progress byType hard-coded | `progress.ts:115-118` | `countErrorsByType` | spelling/grammar/wording |
| Trust unwired | repo grep | `applyCorrectionEvent` | tests only |
| Speed Box no history | `speedBox.ts` | — | no recordHistory |
| Dedupe key | `learningEvents.ts:71-73` | `learningEventDedupeKey` | batchId:category:normalizedOriginal |

---

## Files Modified (Phase 3C)

```
docs/audit/PHASE3C_LAYOUT_LEARNING_PRODUCT_DESIGN.md  (created)
```

**Production code modified:** **NO**

---

## Final Verdict

```
PHASE 3C STATUS:
COMPLETE

CURRENT LAYOUT:
HISTORY ONLY

LAYOUT LEARNING VALUE:
MEDIUM

FALSE POSITIVE RISK:
HIGH

IMPLEMENTATION COMPLEXITY:
MEDIUM

PRODUCT DIFFERENTIATION:
HIGH

COST IMPACT:
NONE

PRIVACY IMPACT:
LOW

METRIC CONTAMINATION RISK:
MEDIUM

RECOMMENDATION:
ADD LAYOUT TO LEARNING

PRODUCTION CHANGES:
NO

P0:
0

P1:
3

P2:
4

P3:
2

NEXT PHASE:
PHASE 3D
```

### Finding counts (design phase)

| Severity | Count | Examples |
|----------|-------|----------|
| P1 | 3 | Auto-apply must not learn; byType UI must update; practice mismatch if layout included prematurely |
| P2 | 4 | i18n; import validator; progress percent split; trust system unwired |
| P3 | 2 | Optional `source: layout`; optional layout in onboarding focus |

---

*End of Phase 3C audit.*
