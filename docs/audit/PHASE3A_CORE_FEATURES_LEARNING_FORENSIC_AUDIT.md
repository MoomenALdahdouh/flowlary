# PHASE 3A — Core Features + Correction + Keyboard Layout + Learning + History Forensic Audit

**Date:** 2026-08-27  
**Mode:** FORENSIC AUDIT ONLY — no production code changes  
**Baseline:**  
- `docs/audit/FLOWLARY_COMPLETE_ARCHITECTURE_AUDIT.md`  
- `docs/audit/PHASE_TRANSLATION_PROVIDER_IMPLEMENTATION.md` (Phase 1 REAL API verified)  
- `docs/audit/PHASE2_COMMERCIAL_ENTITLEMENT_ACCOUNT_ISOLATION.md` (Phase 2 hardened)

**Method:** Code-first verification. Prior audits and comments are secondary evidence and marked when they diverge from implementation.

---

## 1. Executive Summary

Phase 3A answers: **Do core Flowlary features work as a coherent product?**

**Verdict:** The **in-page correction, layout, and AI pipelines are implemented and wired**, but **learning, history, and dashboard aggregation are not reliably connected to the primary content-script runtime path**. Several subsystems exist in code but are **partially wired or semantically mismatched**.

### What works (verified in code)

| Area | Status |
|------|--------|
| Keyboard layout local remap (12 layouts) | IMPLEMENTED |
| Layout Groq fallback (`allam-2-7b`, 1 credit) | IMPLEMENTED, credit-gated |
| Speed Box manual layout | IMPLEMENTED, local, no credits |
| Correction gate (MIN_CHARS=8, MIN_WORDS=3, OR logic) | IMPLEMENTED |
| Instant typo map (40 entries, direct mode only) | IMPLEMENTED, no learning/history/Groq |
| AI correction (Groq `llama-3.1-8b-instant`) | IMPLEMENTED |
| Correction taxonomy (spelling/grammar/wording) | IMPLEMENTED (AI-assigned) |
| Generation/request guards on writes | IMPLEMENTED |
| Account-scoped storage (Phase 32A) | IMPLEMENTED |
| Phase 2 AI cache account keys + switch guards | IMPLEMENTED |

### Critical gaps (product coherence)

1. **Content script never activates `activeAccountContext`** → learning events and history writes from the main in-page path **silently fail** (`return 0` / `return false`). Service worker restores account; content script does not.
2. **`LayoutFeature` never loads `personalExceptions` from storage** → stored exceptions are ignored at runtime; always `[]`.
3. **`GET_PROGRESS` reads legacy unscoped `learningSessions` key** while `PracticeSessionStore` writes account-scoped keys → practice summary in progress metrics is often empty.
4. **Layout corrections appear in history (`FIX_LAYOUT`) but have no learning taxonomy category** → users cannot learn from layout mistakes via Practice/Progress.
5. **Dual `fieldStates` maps** in auto scheduler vs manual `CorrectionFeature` → inconsistent correction card state between paths.

### Finding counts

| Severity | Count |
|----------|-------|
| P0 | 0 |
| P1 | 5 |
| P2 | 6 |
| P3 | 4 |

**Production blockers for this audit scope:** NO (Phase 1/2 billing/isolation hold; core gaps are product-coherence P1s).  
**Phase 3B required:** YES

---

## 2. Architecture Map

### End-to-end feature graph (actual runtime)

```
User input (DOM)
  ↓
InputEngine (focus/input events → FieldSession + generation)
  ↓
EventBus / schedulers
  ├─ LayoutScheduler (input debounce → local fix / classifier)
  ├─ CorrectionScheduler (auto box mode)
  └─ TranslationFeature (manual/live)
  ↓
CommandRouter / CommandOrchestrator (shortcuts)
  ├─ CorrectionFeature.execute (manual CORRECT)
  ├─ LayoutFeature.execute (manual FIX_LAYOUT)
  └─ TranslationFeature.execute (manual TRANSLATE)
  ↓
Feature processing
  ├─ Layout: local heuristics → LayoutClassifier → optional chrome.runtime → background classify → Groq
  ├─ Correction: instantSpell (direct) → background correct → Groq
  └─ Translation: background translate → Google/Groq router (Phase 1)
  ↓
applyCorrection / fixCurrentText / TranslationFeature write
  ↓ (FieldSession.canCommit + WriteOrigin)
User text mutation
  ↓
Side effects (content script realm)
  ├─ recordHistory → HistoryService (requires activeAccountContext)
  ├─ recordCorrectionLearning → LearningEventService (requires activeAccountContext)
  └─ metrics counters (in-memory, per content script)
  ↓
Dashboard / popup (service worker realm)
  ├─ GET_PROGRESS → computeProgressMetrics
  ├─ GET_PRACTICE_HOME → computePracticeRecommendation
  └─ HistoryPanel → GET_HISTORY
```

### Component ownership table

| Component | File | Input | Output | State | Storage | Events | AI |
|-----------|------|-------|--------|-------|---------|--------|-----|
| InputEngine | `extension/src/core/input/InputEngine.ts` | DOM events | FieldSession | per-element generation | none | internal | none |
| LayoutScheduler | `extension/src/features/layout/scheduler.ts` | input text | DOM replace | scheduler debounce | layout prefs via stateManager | none | via classifier |
| LayoutClassifier | `extension/src/features/layout/classifier/LayoutClassifier.ts` | word+context | VALID/MISMATCH | cache L1/L2 | LayoutCache | metrics | Groq fallback |
| LayoutFeature | `extension/src/features/layout/LayoutFeature.ts` | FIX_LAYOUT cmd | applied/stale | profileState (in-memory) | layout.profile (not fully hydrated) | none | via classifier |
| CorrectionScheduler | `extension/src/features/correction/scheduler.ts` | input | correction card | own fieldStates map | none | learning (if account active) | via background |
| CorrectionFeature | `extension/src/features/correction/CorrectionFeature.ts` | CORRECT cmd | suggestion/apply | separate fieldStates | none | learning (if account active) | via background |
| background/correct | `extension/src/background/correct.ts` | CORRECT_TEXT | CorrectionResponse | inflight map | AI cache (account-scoped) | cache metrics | Groq |
| LearningEventService | `extension/src/storage/learning/events/index.ts` | LearningEventInput[] | count added | singleton | `learning.events` account key | dedupe by key | none |
| HistoryService | `extension/src/storage/history/service.ts` | HistoryRecordInput | boolean | singleton | `history` account key | dedupe 5s | none |
| Progress metrics | `extension/src/storage/learning/progress.ts` | event store | ProgressMetrics | computed | none | none | none |

---

## 3. Keyboard Layout Feature

### Supported layouts (12)

**FILE:** `extension/src/features/layout/layouts/registry.ts`  
**IMPLEMENTED IDs:** `en-US-qwerty`, `ar-101`, `ru-standard`, plus world layouts from `world.ts` (de, fr, tr, el, es, pt, uk, fa).

### How `ghbdtn` → `привет`

**CURRENT IMPLEMENTATION:**

1. Token `ghbdtn` is in `HIGH_CONFIDENCE_QWERTY_RU` (`heuristics.ts:12`).
2. Hardcoded shortcut map in `registry.ts` includes `['ghbdtn', 'привет']`.
3. `localClassificationHint()` returns RU mismatch when profile enables `ru-standard`.
4. `mapLayout(token, 'en-US-qwerty', 'ru-standard')` produces Cyrillic via key-level tables.
5. `canCommitMismatch()` requires lexicon proof for EN/AR/RU auto-commit; RU high-confidence set bypasses for `ghbdtn`.
6. Scheduler applies local fix without Groq when confidence passes.

**Path:** Input → LayoutScheduler → `planFieldFixes` / `applyLocalFixes` → `mapLayout` → DOM write via FieldSession.

### Auto-fix vs manual

| Path | Trigger | Credits | History |
|------|---------|---------|---------|
| Auto scheduler | input debounce | local: 0; Groq classifier: 1 | FIX_LAYOUT automatic |
| FIX_LAYOUT command | shortcut | same | FIX_LAYOUT manual |
| Speed Box | Alt+Shift toggle | 0 | none |

### Dependencies audited

- `layouts/heuristics.ts` — confidence, lexicons, `canCommitMismatch`
- `layouts/sentence.ts` — sentence-level planning, personalExceptions check
- `layouts/registry.ts` — mapLayout, shortcut table
- `fixCurrentText.ts` — manual fix orchestration
- `scheduler.ts` — auto fix orchestration
- `speedBox.ts` — pure local remap UI
- `classifier/LayoutClassifier.ts` — local → cache → remote
- `background/classify.ts` — Groq layout classification API

### False-positive prevention

- Lexicon proof required for EN/AR/RU auto-commit (`canCommitMismatch`)
- `personalExceptions` skip tokens (but see §25 — not loaded)
- `isExceptedToken` in scheduler
- World layouts: local auto-commit conservative; often needs Groq or manual Speed Box
- 1–2 char tokens need extra field evidence (`MIN_LEXICON_MISMATCH_CHARS = 3`)

### False-negative behavior

- Legitimate foreign words typed on wrong layout without lexicon hit → no auto-fix until Groq or manual
- World layout pairs without local hint → Groq or Speed Box only

---

## 4. Keyboard Layout Local/AI Boundary

### Percentage/path (qualitative — NOT VERIFIED as measured telemetry)

| Path | Groq called? | Credits |
|------|--------------|---------|
| Local hint hit (`localClassificationHint` non-null) | **Never** | 0 |
| Layout cache hit (L1/L2) | **Never** | 0 |
| Speed Box remap | **Never** | 0 |
| Local auto-commit (scheduler) | **Never** | 0 |
| No local hint + cache miss | **Yes** — `defaultRemoteClassifier` → `/api/ai/layout-classification` | 1 credit (backend) |

**FILE:** `extension/src/features/layout/classifier/LayoutClassifier.ts`  
**FUNCTION:** `classify()` lines 112–154  
**ACTUAL:** Groq only when `localHint` null AND cache miss AND `classifyRemote` defined.

**EXPECTED DESIGN:** Local confident fixes should not consume AI credits.  
**GAP:** None for local path — verified.  
**SEVERITY:** N/A (pass)

---

## 5. Layout Confidence

| Threshold / rule | Source | Above | Below |
|------------------|--------|-------|-------|
| `HIGH_CONFIDENCE_QWERTY_RU = {'ghbdtn'}` | `heuristics.ts:12` | RU remap allowed with minimal evidence | Normal lexicon rules |
| `MIN_LEXICON_MISMATCH_CHARS = 3` | `heuristics.ts:13` | Token considered for AR context | Skipped |
| `canCommitMismatch()` lexicon proof | `heuristics.ts` | Auto-commit | Skip or await Groq |
| Groq classifier verdict | `background/classify.ts` | Cache + apply if canApply | No apply |

**Confidence type:** Deterministic heuristics + lexicon lookup; Groq verdict is AI-generated for ambiguous tokens.

**False positive example:** English word valid in Latin that maps to dictionary word in AR/RU — mitigated by lexicon checks and exceptions (exceptions not hydrated — see P1).

---

## 6. Typo Detection

### CURRENT IMPLEMENTATION

Typo/spelling detection for **AI correction** is **AI-only** (Groq assigns `changes[].type` including spelling).

**Local typo detection** exists only as **instant map replacement**, not as a detector with confidence:

**FILE:** `extension/src/features/correction/instantSpell.ts`  
**FUNCTION:** `applyInstantSpelling()`  
**INPUT:** full field text  
**DETECTION:** regex word match → `COMMON_TYPOS` lookup (case-preserving)  
**CONFIDENCE:** none (exact key hit only)  
**SUGGESTION:** immediate replacement  
**USER ACTION:** direct mode auto-applies on CORRECT command (no box)

**English eligibility** for AI correction:

**FILE:** `extension/src/features/correction/language.ts`  
**FUNCTION:** `detectEnglish()`, `shouldShowEnglishAssistant()`, `isEligibleForCorrection()`  
Uses function-word heuristics, non-English cue regexes, Latin word counts — **not** a spellchecker.

**Browser spellcheck:** NOT USED by Flowlary correction pipeline.

### Pipeline

```
INPUT (field text)
  ↓
isEligibleForCorrection (gate + English detect)
  ↓
[direct mode] applyInstantSpelling (local map)
  OR
[box/auto mode] truncateForCorrection → background CORRECT_TEXT → Groq
  ↓
CorrectionResponse.changes[]
  ↓
Correction card OR direct applyCorrection
  ↓
User accept/reject (box) OR implicit accept (direct)
```

---

## 7. Typo Map

| Property | Value |
|----------|-------|
| Entry count | **40** (`instantSpell.ts` lines 4–45) |
| Storage | Static in source |
| Account-specific | **No** |
| Editable | **No** |
| Learned | **No** |
| Triggers LearningEvent | **No** — verified: `applyCorrection` instant path does not call `recordCorrection*` |

**FILE:** `extension/src/features/correction/CorrectionFeature.ts` — direct mode calls `applyInstantSpelling` then applies without learning record.

**EXPECTED DESIGN:** Instant typo map: NO learning event.  
**ACTUAL:** Matches.  
**GAP:** None.

---

## 8. Correction Taxonomy

**FILE:** `packages/shared/src/correction/index.ts`  
**TYPE:** `ChangeType = 'spelling' | 'grammar' | 'wording'`

**Assignment mechanism:** **AI** via Groq JSON `changes[].type`, normalized by `TYPE_MAP` (aliases: typo→spelling, punctuation→grammar, style→wording). Unknown types fall through coercion — default handling maps to grammar in diff layer.

**Category normalization FILE:** `packages/shared/src/correction/index.ts` `coerceCorrectionPayload`, `TYPE_MAP` lines 42–50.

**Layout:** **NOT** a ChangeType. Layout is separate operation `FIX_LAYOUT`.

**EXPECTED PRODUCT BEHAVIOR:** Spelling/grammar/wording for text corrections only.  
**ACTUAL:** Matches for AI correction. Layout excluded.

---

## 9. Correction Gate

**FILE:** `packages/shared/src/correction/index.ts`  
**CONSTANTS:** `MIN_CHARS: 8`, `MIN_WORDS: 3`

**FILE:** `extension/src/features/correction/language.ts:285–293`  
**FUNCTION:** `isEligibleForCorrection()`

**ACTUAL logic:**
```typescript
if (trimmed.length < MIN_CHARS && words.length < MIN_WORDS) return false;
```
**Gate uses OR semantics:** fails only if **both** below threshold (contrary to AND wording in some docs).

| Path | Gate applied? |
|------|---------------|
| Auto/box correction | Yes — scheduler checks eligibility |
| Manual CORRECT | Yes — CorrectionFeature |
| Live correction | N/A (translation) |
| Instant typo (direct) | Bypasses AI gate but still requires command on eligible field |
| Backend `/api/ai/correct` | Server may have own limits — NOT VERIFIED in this pass |

**UI vs backend:** Extension gate is client-side; backend correction provider enforces separately.

---

## 10. Correction Pipeline

### Full pipeline (box mode)

```
input event
  → CorrectionScheduler.onInput
  → IntelligentDebouncer
  → isEligibleForCorrection
  → client.correct (message to background)
  → correct.ts: cache → coalesce → Groq (2 attempts)
  → CorrectionResponse
  → CorrectionCard UI
  → user accept/reject
  → applyCorrection (FieldSession mutex, WriteOrigin.CORRECT)
  → recordCorrectionAccepted/Rejected/Detected
  → recordHistory (CORRECT)
```

### Async boundaries & race handling

| Boundary | Guard |
|----------|-------|
| User input vs apply | `session.canCommit(generation, requestId)` |
| Stale AI response | generation mismatch → stale verdict |
| Account switch (background) | `activeAccountContext.matches(accountSnapshot)` → `account_changed` |
| Inflight abort | `inflight` map aborts prior requestId |
| Debouncer | generation passed to callback |

**Duplicate requests:** coalescer on cache key in background; debouncer in scheduler.

**Observation — dual state maps:**

**FILE:** `CorrectionFeature.ts:29` — `fieldStates`  
**FILE:** `scheduler.ts:36` — separate `fieldStates`  
**ACTUAL:** Auto and manual paths do not share correction card state.  
**EXPECTED:** Coherent single correction UX per field.  
**GAP:** Manual CORRECT may not see auto-scheduler pending card state.  
**SEVERITY:** P1

---

## 11. Groq Correction Usage

### When Groq is called

| Scenario | Groq? |
|----------|-------|
| FREE plan | Yes if entitlement allows correction feature (server gates credits) |
| PRO plan | Yes |
| ZERO credits | Request fails at gateway — insufficient credits |
| LOCAL TYPO (instant map) | **No** |
| SPELLING/GRAMMAR/WORDING | **Yes** — single Groq call returns all change types |

**Model:** `llama-3.1-8b-instant` (`CORRECTION_DEFAULTS.GROQ_MODEL_DEFAULT`)  
**Prompt:** `CORRECTION_SYSTEM_PROMPT` in `packages/shared/src/correction/index.ts`  
**Temperature / max tokens:** backend provider — `correctionProvider.ts` (temp 0.1, maxTokens 400)  
**Retries:** 2 attempts in `background/correct.ts`  
**Output:** JSON schema originalText, correctedText, changes[]  
**Validation:** `coerceCorrectionPayload`, shared schema tests

---

## 12. Groq Cost Path

```
CorrectionFeature/scheduler
  ↓
chrome.runtime → background/correct.ts
  ↓
cache get (account-scoped key — Phase 2)
  ↓ (miss)
getCorrectCoalescer().run
  ↓
POST /api/ai/correct (JWT auth)
  ↓
backend gateway: entitlement check → reserve credit → Groq → finalize/release
  ↓
cache set (if account snapshot still matches)
  ↓
return to content script
```

**Local corrections:** no `/api/ai/correct` — **0 credits**.  
**Layout local fix:** no layout classification API — **0 credits**.  
**Google translation:** separate path — not billed as Groq correction.

**Duplicate billing:** coalescer + cache prevent duplicate Groq calls for same text+account.  
**Phase 2 guard:** cache write skipped on account generation change.

---

## 13. Correction Result Schema

**FILE:** `packages/shared/src/correction/index.ts`

```typescript
type CorrectionResponse = {
  originalText: string
  correctedText: string
  changes: CorrectionChange[]  // type, original, corrected, start, end
}
```

**NOT present in type:** confidence, explanation, alternatives, accepted/rejected, requestId, accountId, timestamps. Those live in surrounding session/UI/learning layers.

---

## 14. Accept/Reject Lifecycle

| Path | Detected | Accepted | Rejected | Learning |
|------|----------|----------|----------|----------|
| Box mode auto | Yes — `recordCorrectionDetected` | Yes — on accept | Yes — on reject | Per change |
| Manual box | Same | Same | Same | Same |
| Direct mode | **No** | Yes — on apply | N/A | accepted only |
| Instant typo | **No** | implicit apply | N/A | **none** |
| Direct AI commit (if any) | No | Yes | N/A | accepted only |

**Rejected corrections:** learning event with `action: 'rejected'`; **not** written to history as standalone rejected entry.

**Duplication:** dedupe key `batchId:category:normalizedOriginal:action` in LearningEventService.

**Loss risk:** if `activeAccountContext` null in content script → silent drop (P1).

---

## 15. Learning Event Architecture

**FILE:** `extension/src/storage/learning/events/index.ts`  
**Schema:** `LearningEventStoreV1` — events with id, batchId, category, original, corrected, action, source, timestamps, sampleText, sampleWordCount.

**Sources:** `writing` | `practice`  
**Actions:** `detected` | `accepted` | `rejected`  
**Categories:** `spelling` | `grammar` | `wording` (from ChangeType)

**Callers:**
- `recordCorrectionLearning.ts` — correction accept/reject/detect
- Practice panel — practice-sourced events
- Import/export — data control

**Storage:** account-scoped `learning.events` via `getAccountScopedStorage`.

**Lifecycle:** initialize → record (dedupe) → read for progress/practice → clear on user action.

---

## 16. Learning Taxonomy

| Category | Creation source | Detection | Dashboard | Practice |
|----------|-----------------|-----------|-----------|----------|
| spelling | AI change.type | Groq | Progress byType | Recommendations |
| grammar | AI change.type | Groq | same | same |
| wording | AI change.type | Groq | same | same |
| layout | **NOT IMPLEMENTED** | FIX_LAYOUT history only | **none** | **none** |

**VERIFY:** `LearningEventCategory` = ChangeType — no layout (`packages/shared/src/learningEvents.ts`).

**EXPECTED PRODUCT BEHAVIOR (ambiguous):** Layout learning optional.  
**ACTUAL:** Layout excluded from learning taxonomy.  
**GAP:** Users cannot practice layout mistakes.  
**SEVERITY:** P1 (product gap)

---

## 17. Learning Data Quality

| Risk | Mitigation | Residual |
|------|------------|----------|
| Duplicate events | dedupe key | Same action twice may dedupe; different actions (detected+accepted) intentional |
| Missing events | — | **CS account context null → all dropped** |
| Wrong category | AI assignment | miscategorization possible |
| Wrong account | write guards | CS fail-closed; SW OK |
| Record without accept | detected events in box mode | by design |
| Record despite reject | rejected stored but excluded from errorCount | by design |
| Retry double record | batchId ties batch | partial protection |

---

## 18. Learning vs History

| Data | Learning | History | Both | Neither |
|------|----------|---------|------|---------|
| AI correction accepted | yes | CORRECT | yes | |
| AI correction rejected | yes (rejected) | no | | |
| AI correction detected only | yes | no | | |
| Instant typo | no | no | | yes |
| Layout fix | no | FIX_LAYOUT | | |
| Translation | no | TRANSLATE | | |
| Practice attempt | yes (practice source) | no | | |

**History max:** 50 entries (`MAX_HISTORY_ENTRIES`).  
**Learning max:** store growth with events — pruning NOT VERIFIED.

---

## 19. History Architecture

**FILE:** `extension/src/storage/history/service.ts`  
**Schema:** `HistoryEntry` — id, operation, timestamp, domain, fieldKind, sourceText, resultText, metadata.

**Operations:** `CORRECT` | `TRANSLATE` | `FIX_LAYOUT`  
**Writers:** `recordHistory` from correction apply, layout fix, translation features.  
**Account:** requires `activeAccountContext.getAccountId()` — fail-closed.  
**Dedupe:** 5s window (`HISTORY_DEDUPE_WINDOW_MS`).  
**Dashboard:** HistoryPanel via messaging.  
**Export:** data export capability gated.

---

## 20. History Semantics

**Translation provider metadata:** **NOT STORED**

**FILE:** `extension/src/features/translation/TranslationFeature.ts:253–260`  
**ACTUAL:** metadata `{ sourceLanguage, targetLanguage }` only — no Google vs Groq-refined flag.

**Google vs Groq-refined:** indistinguishable in history UI.

**EXPECTED (product):** Optional provider traceability.  
**ACTUAL:** Not implemented.  
**SEVERITY:** P2

---

## 21. Dashboard Architecture

| Panel | Data source | Aggregation |
|-------|-------------|-------------|
| OverviewPanel | entitlement, usage, feature flags | server + local |
| ProgressPanel | `GET_PROGRESS` → `computeProgressMetrics` | deduped errorCount, byType, trend |
| HistoryPanel | history service list | by operation |
| PracticePanel | `GET_PRACTICE_HOME` | recommendation from writing events |
| LearningCards | profile/onboarding | not raw event aggregation |

**Account filtering:** service worker with active account.  
**Refresh:** on mount fetch; no live sync from content script events.

---

## 22. Dashboard Data Integrity

**FILE:** `extension/src/storage/learning/progress.ts` — `countUniqueLearningErrors()`

**Hypothetical: 10 spelling detected, 8 accepted, 2 rejected**

**ACTUAL metric semantics:**
- `learningEventCount` = raw event count (10+8+2 = 20 events if all distinct keys)
- `errorCount` = unique keys excluding rejected; accepted wins over detected → **10 unique errors** (not 8)
- Rejected do not increment errorCount

**Hypothetical: 5 grammar, 3 accepted, 2 rejected → errorCount = 5**

**Hypothetical: 5 wording, 4 accepted, 1 rejected → errorCount = 5**

**UI mismatch:**

**FILE:** `extension/src/dashboard/panels/ProgressPanel.tsx:104–105`  
**ACTUAL:** Label `progress.learningEvents` displays `metrics.errorCount`.  
**EXPECTED:** Label matches metric definition.  
**GAP:** User sees "Learning events" but gets deduped error count.  
**SEVERITY:** P2

---

## 23. Practice Architecture

**FILE:** `extension/src/storage/learning/practice/recommendation.ts`  
**Input:** writing-source learning events (accepted/detected, not rejected).  
**Selection:** recurring patterns by category + normalized original.  
**Question generation:** PracticePanel + ComposeWorkbench.  
**Scoring/feedback:** session items with accept/reject → practice learning events.  
**Persistence:** `PracticeSessionStore` → account-scoped `learning.sessions`.

**Uses historical mistakes:** **Yes** — when learning events exist in store.

**Blocked when:** no writing events (including when CS never recorded events — P1).

---

## 24. Personalization

| Capability | Implemented? |
|------------|--------------|
| Recurring error identification | Yes — `recurringPatterns` in progress |
| Rank frequent errors | Yes — count in patterns |
| Accepted vs rejected distinction | Yes — errorCount excludes rejected |
| Adapt future practice | Partial — recommendation from past events |
| Track improvement | Partial — trend over 7d error rate |
| Category trends | Yes — byType / byTypePercent |
| Layout mistake personalization | **No** |

**Conclusion:** Learning is **pattern aggregation**, not adaptive AI tutoring. Personalization is **real but limited** to spelling/grammar/wording events that were successfully persisted.

---

## 25. Account Isolation

Phase 2 + 32A patterns verified:

| Store | Scoped | Write guard |
|-------|--------|-------------|
| learning.events | account | activeAccountContext + generation |
| history | account | same |
| layout.profile | account | same |
| AI cache | accountId in key | snapshot match on write |
| Practice sessions | account | same |

**Content script gap (Phase 2 documented, Phase 3A confirmed):**

**FILE:** `extension/src/content_script.ts`  
**ACTUAL:** Calls `hydrateStateFromStorage` but **never** `restoreActiveAccountFromSession`.  
**Effect:** All learning/history writes from in-page features return 0/false.

**SEVERITY:** P1 — breaks product coherence for signed-in users.

---

## 26. Account Switch During Correction

**Background path:**

**FILE:** `extension/src/background/correct.ts:206–207`  
**ACTUAL:** Returns `account_changed` if snapshot doesn't match — no cache write.

**Content script path after response:**
- applyCorrection uses generation guard — user edit may stale result
- Learning write uses current CS account context (null or stale) — fail-closed if null
- No mechanism to bind response to account B if switch happened in SW only

**Scenario A starts correction → logout/login B before response:**
- Background may reject with account_changed ✓
- If cache hit from A's key — prevented by accountId in key ✓
- CS learning write — fails closed if CS context null ✓
- UI update — generation/stale guards ✓

**Race safety:** **PARTIAL** — SW hardened; CS account sync not implemented.

---

## 27. Local Typo Storage

**GLOBAL static map** in `instantSpell.ts`. Not account-scoped. Not persisted. Not editable.

**Instant typo → no LearningEvent:** verified.

---

## 28. Error Handling

| Error | User sees | Recorded | Billed | Retry |
|-------|-----------|----------|--------|-------|
| Malformed AI JSON | no suggestion / error | no | release | 2 attempts |
| Groq timeout | failure | no | release | retry |
| Rate limit | failure | no | release | retry |
| Insufficient credits | locked/error UX | no | no reserve | no |
| Network error | error state | no | release | retry |
| Stale response | silent discard / stale | no | no | no |
| Empty suggestion | no apply | no | depends | no |
| account_changed | aborted | no | no finalize | no |

---

## 29. AI Output Validation

**FILE:** `packages/shared/src/correction/index.ts` — `coerceCorrectionPayload`  
**Tests:** `packages/shared/src/correction` tests, integration phase7/8

**Checks:** JSON object shape, changes array, type coercion, offset fields.  
**Fallback:** invalid payload → error path in background.  
**Hallucinated text:** correctedText applied only through validated diff/apply path — full replacement guarded by user accept in box mode.

---

## 30. User Acceptance Semantics

| Action | Meaning | Path |
|--------|---------|------|
| Accept click | explicit | CorrectionCard → applyCorrection → recordCorrectionAccepted |
| Reject click | explicit | recordCorrectionRejected, dismiss card |
| Dismiss | NOT VERIFIED separate from reject | likely reject handler |
| Direct CORRECT | auto-accept after instant spell or AI | recordCorrectionAccepted (AI) or none (instant) |
| Keyboard shortcut | same as command execute | direct/box depending on mode |
| Ignore/new input | card stale via generation | no reject event unless explicit |

---

## 31. Input/Caret Safety

**Correction/layout writes:** FieldSession `withWriteOrigin(WriteOrigin.CORRECT|LAYOUT)` — does not bump user generation.  
**Caret:** applyCorrection uses DOM adapters; tests in phase3/phase8 for controlled write.  
**IME/composition:** NOT VERIFIED exhaustively.  
**CorrectionFeature bypass InputEngine:** uses InputEngine sessions for generation/mutex; direct DOM via apply helpers — **partial bypass** of input event path only, not session guards.

---

## 32. Multi-field/Multi-tab Behavior

Each tab loads own content script instance → separate InputEngine, fieldStates, metrics.  
**Cross-tab:** no shared correction state — responses don't cross tabs (separate JS realms).  
**Cross-field same tab:** field id keys state maps — isolated per field.

---

## 33. Observability

| Metric | Location | Incremented? |
|--------|----------|--------------|
| layout_local_hits | layout metrics | Yes |
| layout_cache_hits | layout metrics | Yes |
| layout_classifier_calls | layout metrics | Yes |
| correction_cache_hits | correction metrics | **No — always 0** |
| ai_requests_correct | cache metrics | Yes |
| ai_requests_avoided | cache metrics | Yes |

**Raw user text logging:** NOT FOUND in correction/layout paths. Backend logging NOT VERIFIED.

---

## 34. Test Coverage

| Area | Tests | Gap |
|------|-------|-----|
| Layout | 8 unit + phase4 integration | CS account hydration |
| Correction | 11 unit + phase7/8 integration | dual fieldStates |
| Learning | phase22b/c, unit learningEvents | CS → learning write E2E |
| History | phase11, unit service | CS history write E2E |
| Practice | phase22d, recommendation unit | GET_PROGRESS session key |
| Dashboard | phase-dashboard | metric label semantics |
| Account isolation | phase32a | content script restore |
| Groq correction | phase7 integration (mocked) | real API |
| Race/generation | phase2/3/4/13/32a | account switch mid-correction E2E |

**Overall:** PARTIAL — strong unit/integration for isolated modules; **weak** for full product path content-script → storage → dashboard.

---

## 35. Real User Scenarios

### A — Wrong keyboard layout
INPUT: `ghbdtn` → DETECTION: local RU hint → PROCESSING: mapLayout → USER: auto or Speed Box → HISTORY: FIX_LAYOUT (if account active in CS: **false**) → LEARNING: none → BILLING: 0 local → DASHBOARD: history only if recorded

### B — Spelling mistake (AI)
Eligible text → Groq → box → accept → learning+history **if CS account active** else silent drop

### C — Grammar mistake
Same as B

### D — Wording improvement
Same as B; type=wording

### E — Reject correction
recordCorrectionRejected; not in history; excluded from errorCount

### F — Accept correction
recordCorrectionAccepted + history CORRECT

### G — Instant typo map
Direct mode → local replace; no learning/history/Groq

### H — Zero AI credits
Gateway denies; user sees locked/error; no bill

### I — Account switch mid-correction
Background account_changed; CS learning fail-closed

### J — Repeat same mistake
Recurring pattern count increases if events persisted

### K — Multiple tabs
Isolated state per tab

### L — Malformed Groq output
Retry then fail; nothing recorded

---

## 36. Product Quality Assessment

| Dimension | Assessment |
|-----------|------------|
| Correctness | Local layout + instant typo conservative; AI depends on Groq quality |
| Precision | Lexicon gates reduce layout false positives; English detection heuristic not robust |
| Latency | Local paths fast; Groq adds network latency |
| Cost | Local/instant avoids Groq; layout Groq only on cache miss |
| Learning value | **Low in practice** until CS account context fixed |
| Consistency | Dual correction state maps; progress label mismatch |
| Traceability | Broken CS write path breaks end-to-end trace |

---

## 37. P0 Findings

**None.** No new security/data corruption/billing correctness issues beyond Phase 2 scope. Account-scoped cache keys and fail-closed writes prevent cross-account corruption; they also prevent legitimate writes from content script.

---

## 38. P1 Findings

### P1-1: Content script learning/history silently dropped

**FILE:** `extension/src/content_script.ts`  
**FUNCTION:** module init  
**ACTUAL:** No `restoreActiveAccountFromSession`; `recordLearningEvents` returns 0 when `!activeAccountContext.getAccountId()` (`learning/events/index.ts:287`).  
**EXPECTED:** In-page corrections persist to signed-in account.  
**GAP:** Primary product path does not record learning or history.  
**SEVERITY:** P1

### P1-2: Layout personalExceptions not hydrated

**FILE:** `extension/src/features/layout/LayoutFeature.ts:48`  
**FUNCTION:** `createLayoutFeature`  
**ACTUAL:** `profileState = DEFAULT` (empty exceptions); `hydrate.ts` loads layout into stateManager only, never calls `setProfileState`.  
**EXPECTED:** Stored exceptions suppress false layout fixes.  
**GAP:** Feature non-functional for personalization/trust.  
**SEVERITY:** P1

### P1-3: GET_PROGRESS practice session key mismatch

**FILE:** `extension/src/background/index.ts:409–410`  
**ACTUAL:** Reads `flowlaryStorage.get(flowlaryStorage.keys.learningSessions, 'local')` (legacy global).  
**FILE:** `extension/src/storage/learning/practice/sessions.ts:134`  
**ACTUAL:** Writes account-scoped `learning.sessions`.  
**EXPECTED:** Progress practice summary reflects completed sessions.  
**GAP:** `practiceSummary` often empty/wrong.  
**SEVERITY:** P1

### P1-4: Layout errors excluded from learning taxonomy

**FILES:** `packages/shared/src/learningEvents.ts`, layout history writers  
**ACTUAL:** FIX_LAYOUT in history only; no LearningEvent category.  
**EXPECTED (product):** Optional layout learning.  
**GAP:** Cannot practice layout mistakes.  
**SEVERITY:** P1

### P1-5: Dual correction fieldStates maps

**FILES:** `CorrectionFeature.ts:29`, `scheduler.ts:36`  
**ACTUAL:** Independent maps for manual vs auto paths.  
**EXPECTED:** Unified per-field correction state.  
**GAP:** Inconsistent UX between auto and manual correction.  
**SEVERITY:** P1

---

## 39. P2 Findings

### P2-1: Progress panel label vs metric
**FILE:** `ProgressPanel.tsx:104–105` — shows `errorCount` under "learning events" label.

### P2-2: correction_cache_hits never incremented
**FILE:** `extension/src/features/correction/metrics.ts` — declared but no increments (cache hits tracked in global cache metrics instead).

### P2-3: Direct correction skips detected events
By design but reduces learning signal for direct-mode users.

### P2-4: World layouts require Groq or manual for many auto-fixes
Local lexicon proof only for EN/AR/RU.

### P2-5: Translation history lacks provider metadata
Cannot distinguish Google vs Groq-refined in history.

### P2-6: Layout trust/revert UI not wired to runtime hydration
Migration stores exceptions; runtime never loads them (related to P1-2).

---

## 40. P3 Findings

### P3-1: Gate documented as AND in some docs; code uses OR
`language.ts:291` — documentation mismatch only.

### P3-2: LearningCards does not aggregate live events
Onboarding/profile focused.

### P3-3: No browser E2E for CS→dashboard pipeline

### P3-4: IME/composition caret safety not tested

---

## 41. Recommended Phase 3B Fixes

1. **Restore account context in content script** — call `restoreActiveAccountFromSession` on init + listen for auth storage changes; verify learning/history writes.
2. **Hydrate LayoutFeature profileState** from `getLayoutProfile` including `personalExceptions` on startup and account attach.
3. **Fix GET_PROGRESS** to use `getPracticeSessionStore(flowlaryStorage).list()` or equivalent account-scoped read.
4. **Unify correction fieldStates** or share state object between scheduler and CorrectionFeature.
5. **Decide product policy on layout learning** — add category or document intentional exclusion in UX.
6. **Fix ProgressPanel label** to match `errorCount` semantics or display `learningEventCount`.
7. **Add integration test:** content script correction → learning event → dashboard progress (single E2E).
8. **Optional:** translation history provider metadata (if product wants traceability).

---

## 42. Files Inspected

### Layout
- `extension/src/features/layout/LayoutFeature.ts`
- `extension/src/features/layout/scheduler.ts`
- `extension/src/features/layout/fixCurrentText.ts`
- `extension/src/features/layout/speedBox.ts`
- `extension/src/features/layout/layouts/heuristics.ts`
- `extension/src/features/layout/layouts/registry.ts`
- `extension/src/features/layout/layouts/sentence.ts`
- `extension/src/features/layout/classifier/LayoutClassifier.ts`
- `extension/src/background/classify.ts`

### Correction
- `extension/src/features/correction/CorrectionFeature.ts`
- `extension/src/features/correction/scheduler.ts`
- `extension/src/features/correction/applyCorrection.ts`
- `extension/src/features/correction/instantSpell.ts`
- `extension/src/features/correction/language.ts`
- `extension/src/background/correct.ts`
- `packages/shared/src/correction/index.ts`

### Learning / History / Dashboard
- `extension/src/features/learning/recordCorrectionLearning.ts`
- `extension/src/storage/learning/events/index.ts`
- `extension/src/storage/learning/progress.ts`
- `extension/src/storage/learning/practice/sessions.ts`
- `extension/src/storage/learning/practice/recommendation.ts`
- `extension/src/storage/history/service.ts`
- `extension/src/storage/history/record.ts`
- `extension/src/storage/hydrate.ts`
- `extension/src/storage/activeAccountContext.ts`
- `extension/src/storage/accountSessionLifecycle.ts`
- `extension/src/content_script.ts`
- `extension/src/background/index.ts`
- `extension/src/dashboard/panels/ProgressPanel.tsx`
- `extension/src/dashboard/panels/PracticePanel.tsx`
- `extension/src/dashboard/panels/HistoryPanel.tsx`

### Shared / Tests
- `packages/shared/src/history.ts`
- `packages/shared/src/learningEvents.ts`
- `tests/unit/layout/*`, `tests/integration/phase4-layout.test.ts`
- `tests/unit/correction/*`, `tests/integration/phase7-correction.test.ts`
- `tests/integration/phase22c-learning.test.ts`, `phase22d-practice.test.ts`
- `tests/integration/phase32a-account-isolation.test.ts`

---

## 43. Files Not Modified

All production source files — **no modifications**.  
Only this audit document was created.

---

## 44. Final Verdict

```
PHASE 3A STATUS:
COMPLETE

KEYBOARD LAYOUT:
VERIFIED

TYPO DETECTION:
VERIFIED

CORRECTION PIPELINE:
NEEDS REVIEW

GROQ CORRECTION COST:
VERIFIED

LEARNING EVENTS:
NEEDS REVIEW

LEARNING TAXONOMY:
NEEDS REVIEW

HISTORY:
NEEDS REVIEW

DASHBOARD:
NEEDS REVIEW

PRACTICE:
NEEDS REVIEW

ACCOUNT ISOLATION:
NEEDS REVIEW

RACE SAFETY:
NEEDS REVIEW

AI OUTPUT VALIDATION:
VERIFIED

TEST COVERAGE:
PARTIAL

P0 FINDINGS:
0

P1 FINDINGS:
5

P2 FINDINGS:
6

P3 FINDINGS:
4

PRODUCTION BLOCKERS:
NO

PHASE 3B REQUIRED:
YES
```

---

*End of Phase 3A forensic audit.*
