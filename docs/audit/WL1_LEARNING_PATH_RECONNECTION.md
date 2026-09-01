# WL-1 — Learning Path Reconnection + End-to-End Hardening

**Date:** 2026-08-27  
**Mode:** IMPLEMENTATION + FORENSIC VERIFICATION  
**Baseline audits:** Phase 3A/3B/3C/3D, Writing Learning Legacy Recovery Audit

---

## Executive Summary

WL-1 verified the existing Flowlary Writing Learning stack end-to-end against the live content-script correction path. **No learning domain rewrite was required.** The correction → learning → account storage → progress → recommendation → practice chain is intact for content-script writing corrections.

**One P1 defect found and fixed:** Dashboard `PracticePanel` wrote practice learning events directly in the dashboard extension-page context without restoring `activeAccountContext`. Events silently dropped (`recordLearningEvents` fail-closed returns `0`). Fixed by adding `bootstrapDashboardAccount()` before React render.

All other paths verified as working per prior Phase 3B/22C/22D/32A hardening.

---

## 1. Current Runtime Trace

### Content-script writing correction path

```
content_script.ts
  bootstrapContentScriptAccount()
    runStorageMigration()
    restoreActiveAccountFromSession()
    hydrateStateFromStorage()
    hydrateLayoutFeatureFromStorage()
    correction.clearFieldStates()
    ensureHistoryInitialized()
    initializeFlowlaryCache()
    installContentScriptAccountListener()
  correction.start() → CorrectionScheduler

CorrectionScheduler.onInput → onDebounced
  applyCorrection.runCorrectionRequest()
    requestCorrectionRemote() [Groq via background]
    deliverCorrectionResult()
      [box mode]  recordCorrectionDetected()  → action: detected
      [direct mode] commitMergedCorrection() → recordCorrectionAccepted() → action: accepted
    acceptCorrectionSuggestion() → recordCorrectionAccepted()
    dismissCorrectionSuggestion() → recordCorrectionRejected()

recordCorrectionLearning.ts → recordLearningEvents()
  LearningEventService.record() [account-scoped, write guard]
  chrome.storage: flowlary.account.<id>.learning.events
```

### Progress read path

```
ProgressPanel → fetchProgress() → background GET_PROGRESS
  startupBackground() → restoreActiveAccountFromSession()
  ensureLearningEventsInitialized()
  getLearningEventService().getStore()
  getPracticeSessionStore().list()
  computeProgressMetrics()
```

### Practice path

```
PracticePanel (dashboard)
  fetchPracticeHome() → GET_PRACTICE_HOME [background, account-scoped read]
  checkWriting() → requestPracticeCorrection() [AI call]
  recordPracticeDetected/Accepted/Rejected() [LOCAL write — requires account bootstrap]
  finishSession() → savePracticeSession() → SAVE_PRACTICE_SESSION [background]
```

### Layout learning path (Phase 3D — unchanged)

```
fixCurrentText.applyLayoutFix()
  writeReplacement() succeeds
  recordHistory()
  if historyMode === 'manual' && sampleText && learningBatchId
    recordLayoutLearningAccepted() → category: layout, action: accepted
Automatic scheduler: history only, no learning
Speed Box: no history, no learning
```

---

## 2. Content-Script Account Bootstrap

**File:** `extension/src/content/accountBootstrap.ts`  
**Function:** `bootstrapContentScriptAccount()`

Verified order:
1. `runStorageMigration()`
2. `restoreActiveAccountFromSession()` — sets `activeAccountContext`
3. `hydrateStateFromStorage()`
4. Layout profile hydration (signed-in) or reset (signed-out)
5. `correction.clearFieldStates()`
6. `ensureHistoryInitialized()`
7. `initializeFlowlaryCache()`
8. `installContentScriptAccountListener()` — watches `authAccountId`

Called in `content_script.ts` **before** `engine.start()` / feature start.

**Evidence:** Phase 3B tests TEST A–H; WL-1 tests A, B, I, J.

---

## 3. Correction → Learning Path

**File:** `extension/src/features/learning/recordCorrectionLearning.ts`

| Trigger | Action | Source |
|---------|--------|--------|
| Box mode card shown | `detected` | `writing` |
| User applies suggestion | `accepted` | `writing` |
| User dismisses suggestion | `rejected` | `writing` |
| Direct mode auto-commit | `accepted` only | `writing` |
| AI failure / noop / stale | none | — |
| Empty changes array | none | — |

Dedupe: `batchId:category:normalizedOriginal:action` — detected+accepted counts once in progress.

**Evidence:** WL-1 tests A, C, D, E, F, N; Phase 22C tests.

---

## 4. Layout → Learning Path

Phase 3D policy preserved. Manual FIX_LAYOUT only.

**Evidence:** Phase 3D tests (10); WL-1 test G; layout excluded from practice recommendation.

---

## 5. Learning Storage Path

**Account-scoped keys:**
- `flowlary.account.<id>.learning.events`
- `flowlary.account.<id>.learning.sessions`
- `flowlary.account.<id>.learning.profile`

**Fail-closed:** `recordLearningEvents()` returns `0` when `!activeAccountContext.getAccountId()`.

**Write guard:** `captureWriteGuard()` + `assertWriteGuard()` prevents cross-account writes on account switch mid-write.

**Evidence:** Phase 32A tests; WL-1 tests B, I.

---

## 6. Progress Read Path

**File:** `extension/src/storage/learning/progress.ts`

Formulas (unchanged):
- `errorCount` = unique non-rejected errors (detected+accepted deduped)
- `errorsPer100Words` = `(errorCount / wordsWritten) * 100` when `wordsWritten >= MIN_WORDS_FOR_ERROR_RATE`
- `byType` includes spelling, grammar, wording, layout
- `computeRecurringPatterns()` — count >= 2 on `(category, normalizedOriginal)`

**Evidence:** WL-1 tests J, L, N; unit progress tests.

---

## 7. Practice Session Path

**Read:** Background `GET_PRACTICE_HOME` / `GET_PROGRESS` — account-scoped ✓  
**Session save:** Background `SAVE_PRACTICE_SESSION` — account-scoped ✓  
**Learning writes:** Dashboard-local — **was broken, now fixed** (see §14)

Recommendation policy (unchanged):
- `source === 'writing'`
- `action !== 'rejected'`
- `category !== 'layout'`

**Evidence:** Phase 22D tests; WL-1 tests K, L, M, practice exclusion test.

---

## 8. Account Switch Behavior

Content script listener on `authAccountId`:
- Logout → `detachActiveAccount()`, reset layout, clear correction field states
- Login/switch → full re-bootstrap

Background: `ACCOUNT_LOGIN` / `ACCOUNT_LOGOUT` messages update context.

On switch:
- AI cache cleared
- Coalescers reset
- Account-bound service singletons reset
- Generation guard invalidates in-flight writes

**Evidence:** Phase 3B TEST F; Phase 32A; WL-1 tests I.

---

## 9. Race Safety

| Scenario | Result |
|----------|--------|
| Account A write starts, switch to B before persist | Guard rejects → `added = 0` |
| Stale debouncer generation | Correction discarded, no learning |
| Stale card invalidation (box mode) | Card hidden; prior `detected` remains (known P2, not WL-1 scope) |

---

## 10. Privacy

Learning events store: original, corrected, normalized fields, sample hash/word count, category, action, batch, timestamp. No full page text, no API keys, no provider metadata. Account-scoped local storage only.

---

## 11. Cost

WL-1 introduces **zero additional Groq calls**. Learning recording, progress, recurring patterns, and recommendation are all local.

---

## 12. Test Matrix

| ID | Scenario | Result |
|----|----------|--------|
| A | Signed-in correction → learning | PASS |
| B | Signed-out → no learning write | PASS |
| C | Accepted → accepted event | PASS |
| D | Rejected → rejected event | PASS |
| E | Direct mode → accepted only | PASS |
| F | No-op correction → no event | PASS |
| G | Manual layout → layout event | PASS |
| H | Automatic layout → no learning | PASS (Phase 3D) |
| I | Account switch → no leakage | PASS |
| J | Progress reads correct account | PASS |
| K | Practice sessions correct account | PASS |
| L | Recurring → recommendation | PASS |
| M | Practice completion → events persist | PASS |
| N | Detected+accepted dedupe | PASS |
| O | Phase 1 regression | PASS |
| P | Phase 2 regression | PASS |
| Q | Phase 3B regression | PASS |
| R | Phase 3D regression | PASS |

**Test file:** `tests/integration/wl1-learning-path-reconnection.test.ts` (16 tests)

---

## 13. Bugs Found

### P1-1: Dashboard practice learning writes dropped (FIXED)

| Field | Value |
|-------|-------|
| FILE | `extension/src/dashboard/main.tsx`, `PracticePanel.tsx` |
| FUNCTION | `recordPracticeDetected/Accepted/Rejected` |
| CHANGE | Dashboard never restored `activeAccountContext` before practice learning writes |
| WHY | `recordLearningEvents` fail-closed returns 0 without account |
| TEST | WL-1 test M (dashboard bootstrap vs no bootstrap) |
| ACCOUNT IMPACT | Practice learning events never persisted in production dashboard |
| COST | 0 Groq |

**Fix:** Added `extension/src/dashboard/accountBootstrap.ts` + bootstrap before React render in `dashboard/main.tsx`.

### P2-1: Stale box-mode card invalidation leaves `detected` events (DOCUMENTED)

When correction goes stale, card is hidden without `recordCorrectionRejected`. Prior `detected` events count toward progress. Product enhancement — not WL-1 scope.

### P2-2: Orchestrator CORRECT + box mode has noop card handlers (DOCUMENTED)

Keyboard CORRECT command path records `detected` but card accept/dismiss is noop. Direct mode unaffected.

### WL-3 FOLLOW-UP: `focusAreas` not wired to recommendations

Onboarding collects focus preferences but recommendation engine does not filter by them.

### WL-2 FOLLOW-UP: Trend uses error count delta, not error rate

Current trend algorithm compares period error counts. Screenshot-era "rising error rate" narrative not implemented.

---

## 14. Fixes Made

| File | Change |
|------|--------|
| `extension/src/dashboard/accountBootstrap.ts` | **NEW** — dashboard account bootstrap + auth listener |
| `extension/src/dashboard/main.tsx` | Await bootstrap before React render |
| `tests/integration/wl1-learning-path-reconnection.test.ts` | **NEW** — 16 end-to-end tests |

---

## 15. Files Intentionally Untouched

- Learning event schema / validation
- Progress engine formulas
- Practice recommendation scoring
- Recurring pattern engine
- CorrectionFeature / CorrectionScheduler / applyCorrection
- AiGateway / translation router / Groq provider
- Layout learning (Phase 3D)
- Entitlement / credits / account auth model
- ProgressPanel / PracticePanel UI (except bootstrap dependency)

---

## 16. Remaining WL-2 / WL-3 / WL-4 / WL-5 Work

| Phase | Scope |
|-------|-------|
| **WL-2** | Analytics polish — error-rate trend, metric labeling, headline stat split |
| **WL-3** | Personalized feedback — focusAreas wiring, narrative recommendations |
| **WL-4** | Practice enhancements — deeper session UX, layout practice (Phase 3E overlap) |
| **WL-5** | Activity UX — HistoryDiff coloring, legacy-style history visualization |

---

## 17. Evidence Table (Major Claims)

### Correction → Learning (content script)

| Field | Value |
|-------|-------|
| FILE | `extension/src/features/correction/applyCorrection.ts` |
| FUNCTION | `deliverCorrectionResult`, `acceptCorrectionSuggestion`, `dismissCorrectionSuggestion` |
| CHANGE | Box/direct learning emission per current semantics |
| WHY | Phase 22C product policy |
| TEST | WL-1 A/C/D/E/N; Phase 22C |
| ACCOUNT IMPACT | Uses content bootstrap `activeAccountContext` |
| COST | 0 additional Groq |

### Dashboard practice reconnect

| Field | Value |
|-------|-------|
| FILE | `extension/src/dashboard/accountBootstrap.ts` |
| FUNCTION | `bootstrapDashboardAccount()` |
| CHANGE | Restore account before PracticePanel learning writes |
| WHY | Fail-closed storage requires active account |
| TEST | WL-1 M |
| ACCOUNT IMPACT | Practice events now persist under signed-in account |
| COST | 0 Groq |

### Recurring → Recommendation

| Field | Value |
|-------|-------|
| FILE | `extension/src/storage/learning/practice/recommendation.ts` |
| FUNCTION | `computePracticeRecommendation()` |
| CHANGE | None — verified working |
| TEST | WL-1 L; Phase 22D |
| COST | 0 Groq |

---

## 18. Final Verdict

```
WL-1 STATUS:
COMPLETE

CORRECTION → LEARNING:
PASS

LAYOUT → LEARNING:
PASS

LEARNING STORAGE:
PASS

PROGRESS:
PASS

PRACTICE:
PASS

RECURRING PATTERNS:
PASS

RECOMMENDATION:
PASS

ACCOUNT ISOLATION:
PASS

ACCOUNT SWITCH SAFETY:
PASS

PRIVACY:
PASS

GROQ COST IMPACT:
ZERO

PHASE 1 REGRESSION:
PASS

PHASE 2 REGRESSION:
PASS

PHASE 3D REGRESSION:
PASS

TESTS:
141 passed
0 failed

P0:
0

P1:
1 (fixed)

P2:
2

P3:
1

PRODUCTION BLOCKER:
NO

NEXT PHASE:
WL-2
```

---

## Git Baseline (start of WL-1)

- **Branch:** main  
- **Commit:** 61f349827f111231dd8ebdac1c557478dcb10cb8  
- **Status:** Large uncommitted working tree (pre-existing); WL-1 adds 3 files + 1 modification

**Production changes in WL-1:** Dashboard account bootstrap only. No deployment, no migration, no env changes.
