# WL-4 — Practice Forensic Audit

**Date:** 2026-08-27  
**Mode:** FORENSIC AUDIT ONLY — no production code modified  
**Baseline:** WL-1/2/3 complete, Phase 3D layout learning, Phase 22D Practice implementation

---

## Executive Summary

### A. Is Practice currently functional?

**Yes — PARTIALLY functional.** The Practice system is implemented end-to-end for English writing categories (spelling, grammar, wording). Users can receive recommendations, start sessions, write answers, get AI correction, accept/reject, persist learning events, and complete sessions. However, prompts are mostly **generic writing exercises**, not targeted drills on the user's specific recurring mistake.

### B. Is Practice actually personalized?

**PARTIALLY.** Recommendation is personalized (recurring patterns + recency + WL-3 focus boost). Session **prompts** are only weakly tied to the recommended pattern. PracticePanel does **not** display WL-3 personalization insights — only `GET_PRACTICE_HOME` recommendation.

### C. Does Practice train recurring user errors?

**PARTIALLY.** Recommendation identifies a specific `(category, normalizedOriginal)` pattern, and `buildPracticePrompt()` can use `targetPattern` for a slightly tailored prompt. There is **no exercise that requires fixing the exact token** (e.g. no "write a sentence using 'a lot' correctly" with verification of that token).

### D. Does Practice feed back into Learning?

**Yes.** Practice corrections create `LearningEvent` records with `source: 'practice'` via `recordPracticeDetected/Accepted/Rejected`.

### E. Does Practice affect Progress?

**Yes, with separation caveats.** `practiceSummary` shows weekly session stats. `practiceErrorCount` is tracked separately. Headline `errorCount` and `errorsPer100Words` **include** practice events (not writing-only).

### F. Does Practice respect user focus?

**Yes.** `resolvePracticeFocus()` returns explicit user category when not `'recommended'`. WL-3 `focusAreas` boost recommendation as tie-breaker only.

### G. Does Practice exclude Layout correctly?

**Yes.** `computePracticeRecommendation()` filters `category !== 'layout'`. Session sanitizer accepts only spelling/grammar/wording patterns. No layout in Practice focus picker.

### H. Is Practice account-isolated?

**Yes.** PracticeSessionStore and LearningEventService use account-scoped storage with write guards (Phase 2/32A). Dashboard bootstrap (WL-1) required for practice learning writes.

### I. Does Practice consume Groq?

**Yes.** Each "Check writing" action calls `CORRECT_TEXT` → managed correction API (Groq-backed gateway). Weight: **1 credit** per successful uncached check.

### J. Does Practice waste AI calls?

**LOW waste.** One Groq call per item check (max 5/session). Cache can avoid repeat identical text. No separate prompt/feedback AI calls. Accept/reject is local.

### K. Biggest P1 problem

**No P1 production blocker found.** Strongest product gap is **P2: weak error-specific prompt generation** — Practice behaves like a category-themed writing sandbox rather than targeted recurrence training.

### L. Highest-value enhancement

**Error-specific practice prompts/exercises** tied to `PracticeTargetPattern.normalizedOriginal` (WL-4B), without rewriting the existing session/correction/store architecture.

---

## Git Baseline (audit start)

| Field | Value |
|-------|-------|
| Branch | `main` |
| Commit | `61f349827f111231dd8ebdac1c557478dcb10cb8` |
| Production files modified | **NO** (audit only) |

---

## 1. Practice File Inventory

| File | Purpose |
|------|---------|
| `packages/shared/src/practice.ts` | Session/recommendation types, constants |
| `packages/shared/src/learningEvents.ts` | `source: 'writing' \| 'practice'` |
| `extension/src/storage/learning/practice/recommendation.ts` | `computePracticeRecommendation`, `resolvePracticeFocus` |
| `extension/src/storage/learning/practice/sessions.ts` | `PracticeSessionStore`, account-scoped persistence |
| `extension/src/storage/learning/practice/prompts.ts` | Static/generic prompt pools + weak pattern hints |
| `extension/src/features/learning/recordCorrectionLearning.ts` | `recordPracticeDetected/Accepted/Rejected` |
| `extension/src/dashboard/panels/PracticePanel.tsx` | Full Practice UI |
| `extension/src/dashboard/accountBootstrap.ts` | WL-1 account restore for practice learning writes |
| `extension/src/popup/api.ts` | `fetchPracticeHome`, `savePracticeSession`, `requestPracticeCorrection` |
| `extension/src/background/index.ts` | `GET_PRACTICE_HOME`, `SAVE_PRACTICE_SESSION`, `GET_PROGRESS` |
| `extension/src/background/correct.ts` | `CORRECT_TEXT` handler, entitlement, Groq |
| `extension/src/features/correction/client.ts` | `requestCorrectionRemote(..., mode: 'practice')` |
| `extension/src/storage/learning/personalization.ts` | WL-3 personalization (Progress, not PracticePanel) |
| `extension/src/storage/learning/progress.ts` | `practiceSummary`, `writingErrorCount`, `practiceErrorCount` |
| `tests/unit/storage/practice-recommendation.test.ts` | Recommendation unit tests |
| `tests/integration/phase22d-practice.test.ts` | Integration tests |
| `tests/integration/wl3-personalization.test.ts` | Focus boost + GET_PRACTICE_HOME |
| `PHASE22D_REPORT.md` | Phase 22D implementation report |

**No separate `PracticeEvent` type.** Practice uses `LearningEvent` with `source: 'practice'`.

---

## 2. Phase 22D Recovery

| Phase 22D intent | Current status |
|------------------|----------------|
| Practice dashboard route | ✅ `PracticePanel` in dashboard nav |
| Recommendation from writing events | ✅ `computePracticeRecommendation` |
| Session store local | ✅ Account-scoped `learningSessions` key |
| Practice learning events | ✅ `source: 'practice'` |
| Reuse CORRECT_TEXT pipeline | ✅ `requestPracticeCorrection` → background |
| 5 items per session | ✅ `PRACTICE_ITEMS_PER_SESSION = 5` |
| No TTS/speech/gamification | ✅ Not implemented |
| Abandoned sessions discarded | ✅ Only `finishSession` → `SAVE_PRACTICE_SESSION` |
| Per-change accept/reject | ❌ Accept-all / reject-all only (by design 22D) |

**Post-22D changes affecting Practice:**
- WL-1: Dashboard account bootstrap for practice learning writes
- WL-2: Rate-based trend (Progress only)
- WL-3: `userFocusAreas` boost in recommendation; personalization on GET_PROGRESS
- Phase 3D: Layout excluded from recommendation input

---

## 3. Practice Architecture (Actual)

```
LEARNING DATA (writing events, account-scoped)
      ↓  FILE: learning/events/index.ts — LearningEventService
RECURRING PATTERNS
      ↓  FUNCTION: computeRecurringPatterns() — progress.ts
PRACTICE RECOMMENDATION
      ↓  FUNCTION: computePracticeRecommendation(events, now, profile.focusAreas)
      ↓  FILE: background/index.ts — GET_PRACTICE_HOME
PRACTICE HOME
      ↓  UI: PracticePanel view='home' — fetchPracticeHome()
FOCUS SELECTION
      ↓  FUNCTION: resolvePracticeFocus(choice, recommendation)
      ↓  UI: view='focus' or beginSession('recommended')
SESSION CREATION
      ↓  FUNCTION: beginSession() — in-memory React state + createPracticeSessionId()
PROMPT / TASK
      ↓  FUNCTION: buildPracticePrompt(focus, targetPattern, itemIndex)
      ↓  FILE: prompts.ts — static pools
USER RESPONSE
      ↓  UI: textarea in PracticePanel
CORRECTION
      ↓  requestPracticeCorrection → CORRECT_TEXT → handleCorrectText (Groq)
ACCEPT / REJECT
      ↓  handleAccept / handleReject — accept-all or reject-all
PRACTICE LEARNING EVENT
      ↓  recordPracticeDetected/Accepted/Rejected → LearningEventService
SESSION COMPLETION
      ↓  finishSession → SAVE_PRACTICE_SESSION → PracticeSessionStore
PROGRESS
      ↓  GET_PROGRESS → computeProgressMetrics + practiceSummary
```

---

## 4. Practice Recommendation

**FILE:** `extension/src/storage/learning/practice/recommendation.ts`  
**FUNCTION:** `computePracticeRecommendation(events, now, userFocusAreas)`

| Aspect | Value |
|--------|-------|
| Inputs | All learning events; filters to `source === 'writing'`, `action !== 'rejected'`, `category !== 'layout'` |
| Outputs | `{ state: 'none' \| 'emerging' \| 'ready', focus?, pattern? }` |
| none | 0 writing events |
| emerging | 1–2 writing events |
| ready | ≥3 writing events + recurring/concentration threshold |
| Scoring | `count * 100 + recencyBonus(25 if within 7 days) + userFocusBoost(25)` |
| Ready threshold | Top pattern score ≥ 200 |
| Fallback | `bestCategoryByConcentration` (count ≥ 2) |
| WL-3 boost | ✅ Used via `GET_PRACTICE_HOME` reading `profile.focusAreas` |

**Semantics:** Recommendation is **MIXED** — primarily **category + optional specific pattern** (`PracticeTargetPattern`). Not "most frequent isolated error" — recurrence and concentration dominate.

**Example (from unit test):** 4× spelling `recieve`, 3× scattered grammar → recommends spelling pattern (score 400+ vs grammar concentration).

---

## 5. Focus Selection

**FILE:** `recommendation.ts` — `resolvePracticeFocus()`

| User choice | Result |
|-------------|--------|
| `'recommended'` | Uses `recommendation.focus` + `recommendation.pattern` |
| `'spelling' \| 'grammar' \| 'wording'` | Returns `{ focus: choice }` — **user wins**, no pattern |

**Verified:** Scenario 2 — user chooses grammar, recommendation spelling → Practice uses grammar (`resolvePracticeFocus('grammar', rec)` → `{ focus: 'grammar' }`). Test: `wl3-personalization.test.ts`.

---

## 6. Practice Categories

| Category | Supported | Prompt pool | AI correction | Tested |
|----------|-----------|-------------|---------------|--------|
| spelling | ✅ | SPELLING_PROMPTS | ✅ | ✅ |
| grammar | ✅ | GRAMMAR_PROMPTS | ✅ | ✅ |
| wording | ✅ | WORDING_PROMPTS | ✅ | ✅ |
| layout | ❌ (by design) | N/A | N/A | ✅ excluded |

---

## 7. Layout Boundary

| Gate | Location | Mechanism |
|------|----------|-----------|
| Recommendation input | `recommendation.ts:30` | `event.category !== 'layout'` |
| Focus picker | `PracticePanel.tsx` | Only spelling/grammar/wording/recommended |
| Session pattern sanitize | `sessions.ts:74-76` | Rejects layout targetPattern |
| Personalization | `personalization.ts` | `inputFocusCategory: 'layout'` separate from Practice |

**Status:** PASS — layout cannot enter English Practice.

---

## 8. Practice Session Store

**FILE:** `extension/src/storage/learning/practice/sessions.ts`  
**KEY:** `flowlary.account.<id>.learning.sessions` (account-scoped)  
**Schema:** `PracticeSessionRecord` — id, timestamps, focus, targetPattern, metrics, status  
**Retention:** Max 200 sessions  
**Write guard:** `captureWriteGuard()` + `assertWriteGuard()`  
**Tests:** phase22d SAVE/CLEAR; phase32a account isolation

---

## 9. Session Lifecycle

| State | Implementation |
|-------|----------------|
| UI views | `home \| focus \| session \| complete` (React state only) |
| Session ID | `createPracticeSessionId()` at `beginSession()` |
| Items | 0..4 (`PRACTICE_ITEMS_PER_SESSION = 5`) |
| Per item | write → check → feedback → accept/reject → advance |
| Complete | All 5 items done → `finishSession()` → `status: 'completed'` |
| Abandon | Exit confirm → `view='home'`, **no persist** |
| Reload | **Session lost** — all state in React memory |

---

## 10. Account Isolation

| Test | Evidence |
|------|----------|
| Session A/B | `PracticeSessionStore` account-scoped — phase32a, phase22d |
| Learning events | `LearningEventService` fail-closed + write guard |
| GET_PRACTICE_HOME | Background restores account per message |
| Dashboard writes | WL-1 `bootstrapDashboardAccount()` before practice learning |

**Race:** Background `handleCorrectText` checks `activeAccountContext.matches(accountSnapshot)` → returns `account_changed` on switch.

---

## 11. Prompt Generation

**FILE:** `prompts.ts` — `buildPracticePrompt(focus, pattern?, itemIndex)`

| Mode | Behavior |
|------|----------|
| With pattern | Weak category-specific hint (e.g. "sentence about receiving email" for receive spelling) |
| Without pattern | Rotates static pool by `itemIndex % pool.length` |
| AI-generated prompts | **NO** |
| Error-specific drill | **NO** — no prompt embeds `displayOriginal` as required fix target |

**Verdict:** Mostly **generic category writing tasks**. Pattern metadata influences prompt text minimally.

---

## 12. AI Provider

| Step | Provider | Path |
|------|----------|------|
| Practice correction | Groq (via Flowlary gateway) | `handleCorrectText` → `callManagedCorrectionOnce` |
| Model | Same as writing correction | backend gateway |
| Prompt generation | None (local static) | `prompts.ts` |
| Feedback narrative | None (static UI list of changes) | PracticePanel |

---

## 13. Cost / Credits Table

| Action | Google | Groq | Credits |
|--------|--------|------|---------|
| Start session | 0 | 0 | 0 |
| Prompt display | 0 | 0 | 0 |
| Check writing (per item) | 0 | 1 (if uncached) | 1 |
| Accept/reject | 0 | 0 | 0 |
| Feedback display | 0 | 0 | 0 |
| Complete/save session | 0 | 0 | 0 |

**Max per full session:** Up to 5 Groq calls (one per item checked; items with zero changes skip repeat on advance but still consumed check if run).

**Cache:** Identical text returns cached correction — 0 additional Groq.

**Entitlement:** `canUseFeature('practice')` — requires `practice.full` OR `practice.basic` + credits + `ai.correction` for free tier.

---

## 14. Free vs Pro Practice

| Plan | UI (`fullAccess`) | AI check |
|------|-------------------|----------|
| Free | Teaser shown (`!practice.full`) but **session buttons not disabled** | Allowed if `practice.basic` + credits > 0 |
| Trial/Pro | Full UI | Allowed with credits |

**P2:** Upgrade teaser implies full Practice is Pro-only, but free users with credits can still run sessions via focus picker.

---

## 15. Correction Pipeline

Practice reuses existing correction infrastructure:

```
requestPracticeCorrection()
  → requestCorrectionRemote(..., mode: 'practice')
  → background handleCorrectText()
  → callManagedCorrectionOnce() [same as writing]
  → CorrectionResponse { changes[] }
```

**Not** CorrectionFeature/scheduler/content-script path — dashboard-initiated CORRECT_TEXT.

**Stale safety:** `AbortController` per check; `accountSnapshot` guard in background.

---

## 16. Practice Learning Events

**FILE:** `recordCorrectionLearning.ts`

| Event | When | source | action |
|-------|------|--------|--------|
| detected | After CORRECT_TEXT returns changes | `practice` | `detected` |
| accepted | User clicks accept-all | `practice` | `accepted` |
| rejected | User clicks reject-all | `practice` | `rejected` |

**batchId:** `practice-{sessionId}-{itemIndex}`

**Dedupe:** Same key as writing — `batchId:category:normalizedOriginal:action`

**Test:** phase22d — accept + rerender → 1 unique error.

---

## 17. Practice vs Learning Events

| | LearningEvent | PracticeSessionRecord |
|---|---------------|---------------------|
| Purpose | Mistake signals for analytics/recommendation | Session history metadata |
| Storage | `learning.events` | `learning.sessions` |
| Duplication | Intentional separation — sessions don't store full text | |

Practice events **do** affect headline `errorCount` in progress (all sources). Recommendation **ignores** practice source (writing only) — no feedback loop from practice mistakes into recommendation.

---

## 18. Progress Integration

| Metric | Includes practice? |
|--------|-------------------|
| `errorCount` | ✅ Yes (all non-rejected) |
| `errorsPer100Words` | ✅ Yes (numerator includes practice) |
| `writingErrorCount` | ❌ Writing only |
| `practiceErrorCount` | ✅ Practice only |
| `practiceSummary` | ✅ Weekly sessions/items/patterns |
| `trend` | Uses all events in periods |
| Recommendation | Writing only |

**Gap (P2):** Practice activity visible in summary but does not directly improve writing recommendation (by design — practice mistakes don't count toward writing recurring patterns).

---

## 19. Scoring

**No accuracy score formula.** Session tracks:
- `itemsAttempted`, `itemsCompleted`
- `correctionsDetected/Accepted/Rejected`
- `wordsWritten`

Completion = finish all 5 items (or advance on zero-change checks).

---

## 20. Practice Feedback

| Type | Implementation |
|------|----------------|
| Corrections found | Static list `original → corrected` |
| No corrections | Auto-advance, no message |
| AI narrative | **NO** |
| Personalized coaching | **NO** |

---

## 21. Error Specificity

**Critical finding:**

Learning knows: `"alot" → "a lot"` (via recurring pattern)

Practice with pattern might show:
> "Write a natural sentence where you might need the word \"a lot\"."

It does **NOT**:
- Detect whether user used the word correctly
- Require fixing the specific error token
- Score pattern-specific success

**Verdict:** Practice is **category-targeted writing practice**, not **token-specific recurrence training**.

---

## 22. Personalization Connection

| Layer | Consumed by Practice? |
|-------|----------------------|
| WL-3 `personalization` insights | ❌ Not in PracticePanel |
| WL-3 `systemRecommendedFocus` | ❌ Indirectly via same recommendation engine |
| `GET_PRACTICE_HOME` + focusAreas boost | ✅ |

Practice home shows recommendation pattern text; Progress shows personalization insights separately.

---

## 23. Learning Loop Validation

| Stage | Exists | Correct | Account-scoped | Tested |
|-------|--------|---------|----------------|--------|
| Error (writing) | ✅ | ✅ | ✅ | ✅ |
| LearningEvent (writing) | ✅ | ✅ | ✅ | ✅ |
| Recurrence | ✅ | ✅ | ✅ | ✅ |
| Recommendation | ✅ | ✅ | ✅ | ✅ |
| Practice start | ✅ | ✅ | ✅ | Partial |
| Practice answer | ✅ | ✅ | ✅ | Partial |
| Correction | ✅ | ✅ | ✅ | Partial |
| Practice LearningEvent | ✅ | ✅ | ✅ | ✅ |
| Learning update | ✅ | ✅ | ✅ | ✅ |
| Progress update | ✅ | Partial | ✅ | ✅ |
| Trend update | ✅ | Partial | ✅ | ✅ |
| Personalization update | ✅ | ✅ | ✅ | ✅ |

---

## 24. End-to-End Scenario 1 (Grammar)

| Step | Status | Evidence |
|------|--------|----------|
| 1. Grammar error written | PASS | CorrectionFeature → recordCorrectionAccepted |
| 2. Correction shown | PASS | applyCorrection box/direct |
| 3. User accepts | PASS | recordCorrectionAccepted |
| 4. Learning event | PASS | source=writing |
| 5. Same pattern again | PASS | Second event same normalizedOriginal |
| 6. Recurring pattern | PASS | computeRecurringPatterns count≥2 |
| 7. Recommendation grammar | PASS | If grammar recurring wins scoring |
| 8. Enter Practice | PASS | PracticePanel beginSession |
| 9. Grammar task | PARTIAL | Generic grammar prompt, not "He go→goes" specific |
| 10. User answers | PASS | textarea + checkWriting |
| 11. Corrected | PASS | CORRECT_TEXT |
| 12. Accept/reject | PASS | handleAccept/Reject |
| 13. Practice event | PASS | source=practice |
| 14. Learning updated | PASS | LearningEventService |
| 15. Progress updated | PASS | GET_PROGRESS |
| 16. Dashboard reflects | PASS | practiceSummary + error counts |

---

## 25. End-to-End Scenarios 2–5

| Scenario | Result |
|----------|--------|
| 2: User focus grammar vs rec spelling | **PASS** — resolvePracticeFocus |
| 3: Layout excluded from English Practice | **PASS** — recommendation filter + UI |
| 4: Account switch | **PASS** — scoped storage + guards |
| 5: 0 credits | **FAIL at check** — `usage_exhausted` from entitlement; session UI shows correctionError |

---

## 26. UX States

| State | Exists |
|-------|--------|
| LOADING | ✅ home load |
| EMPTY | ✅ recommendation.state === 'none' |
| READY | ✅ recommendation.state === 'ready' |
| EMERGING | ✅ recommendation.state === 'emerging' |
| ACTIVE (session) | ✅ view === 'session' |
| SUBMITTING | ✅ checking === true |
| FEEDBACK | ✅ correction !== null |
| COMPLETED | ✅ view === 'complete' |
| ERROR | ✅ correctionError |

**Missing:** No explicit session-resume state after reload.

---

## 27. Race / Double Submission

| Risk | Mitigation |
|------|------------|
| Double accept | `actionRecordedRef` |
| Double detect | `detectedRecordedRef` |
| Stale correction | `AbortController` abort on new check |
| Account switch mid-request | `account_changed` in background |
| Double credit | Coalescer + cache by text hash |

---

## 28. Security & Privacy

| Check | Status |
|-------|--------|
| Account server-controlled | ✅ authAccountId + bootstrap |
| Cross-account sessions | Prevented |
| API secrets in extension | Not in Practice code |
| Practice answer stored long-term | **NO** — session record metrics only |
| Answer sent to AI when checked | **YES** — same as correction privacy model |

---

## 29. Product Value Assessment

Practice provides:
1. ✅ Category-aligned writing sandbox with real AI correction
2. ✅ Connection to user's recurring mistake **category**
3. ⚠️ Weak connection to **specific token** recurrence
4. ✅ Learning event recording for practice mistakes
5. ⚠️ No measurable "improvement after practice" claim
6. ✅ Honest empty/emerging states

**Assessment:** Closer to **"structured correction practice"** than **"personalized mistake drill."** Not merely broken — but product differentiation from generic grammar quiz is **moderate**, driven by recommendation linkage rather than exercise design.

---

## 30. Existing Valid Components (DO NOT REWRITE)

- `computePracticeRecommendation` + recurrence scoring
- `resolvePracticeFocus` user-precedence semantics
- `PracticeSessionStore` account-scoped persistence
- `recordPractice*` → LearningEvent pipeline
- CORRECT_TEXT reuse (entitlement + credits + cache)
- Layout exclusion gates
- Dedupe semantics for practice events
- Dashboard account bootstrap (WL-1)
- WL-3 focus-area recommendation boost

---

## 31. Broken Functionality

**None identified as P0/P1 broken** in current tests and code trace.

Minor integration notes (not broken after WL-1):
- Practice learning writes require dashboard account bootstrap ✅ fixed WL-1

---

## 32. Missing Functionality

| Gap | Priority |
|-----|----------|
| Error-specific prompt/exercise generation | P2 |
| Session resume after reload | P2 |
| Practice-specific progress view (writing vs practice split in UI) | P2 |
| Personalization insights in PracticePanel | P3 |
| Per-change accept/reject (vs accept-all) | P3 (deferred 22D) |
| Layout Practice (Phase 3E) | Future |
| Abandoned session persistence | Enhancement |
| Accuracy/scoring formula | Enhancement |

---

## 33. Enhancements (Not Bugs)

- TTS/speech, gamification, AI tutor (explicitly out of 22D scope)
- Better animations
- Writing-only headline error rate (WL-2 P3)
- Narrative coaching copy

---

## 34. Recovery Matrix

| Component | Status | Problem | Priority | Recommended Action |
|-----------|--------|---------|----------|-------------------|
| Recommendation | VALID | — | — | Preserve |
| Focus selection | VALID | — | — | Preserve |
| Session Store | VALID | — | — | Preserve |
| Prompt generation | WEAK | Generic prompts | P2 | WL-4B error-specific prompts |
| Answer correction | VALID | — | — | Preserve |
| Practice events | VALID | — | — | Preserve |
| Learning integration | VALID | Practice doesn't feed recommendation | P2 design | Document or WL-4C policy |
| Progress integration | PARTIAL | Mixed errorCount | P2 | Optional writing-only headline |
| Personalization | PARTIAL | Not shown in Practice UI | P3 | Surface in Practice home |
| Scoring | MISSING | No accuracy metric | P3 | WL-4D if needed |
| Feedback | MINIMAL | Static change list | P3 | WL-4C feedback copy |
| Completion | VALID | — | — | Preserve |
| History | VALID | Session list in store | — | Optional UI history |
| Account isolation | VALID | — | — | Preserve |
| Error handling | ADEQUATE | Generic error strings | P3 | — |
| Cost | CONTROLLED | Up to 5 Groq/session | — | Cache already helps |

---

## 35. Test Coverage

| File | Tests | Proves |
|------|-------|--------|
| `practice-recommendation.test.ts` | 6 | Scoring, focus boost, resolvePracticeFocus |
| `phase22d-practice.test.ts` | 4 | Home, dedupe, session save, history isolation |
| `wl3-personalization.test.ts` | 4 | Focus boost in GET_PRACTICE_HOME, user override |
| `wl1-learning-path-reconnection.test.ts` | 2 | Practice events, layout exclusion |
| `phase32a-account-isolation.test.ts` | — | Account-scoped learning (indirect) |

**Missing tests:** Full PracticePanel E2E, reload behavior, credit exhaustion UI, account switch mid-session, double-submit, prompt specificity.

---

## 36. Regression Results

**90 tests passed, 0 failed** (WL-1, WL-2, WL-3, Phase 3B/3D/22C/22D/32A, practice-recommendation, personalization).

---

## 37. Recommended Implementation Phases

| Phase | Scope |
|-------|-------|
| **WL-4A** | Practice correctness hardening — E2E tests, reload/account-switch/credit edge cases, commercial UX alignment |
| **WL-4B** | Error-specific prompts — use `PracticeTargetPattern` to generate targeted exercises |
| **WL-4C** | Practice feedback UX — deterministic post-item feedback, optional pattern success hint |
| **WL-4D** | Practice scoring/progression — session accuracy, optional writing-only progress display |
| **WL-4E** | Layout Practice (Phase 3E scope) — separate from English Practice |

---

## 38. Files Modified

**NONE** — audit only.

---

## 39. Final Verdict

```
WL-4 FORENSIC AUDIT:
COMPLETE

PRACTICE:
PARTIAL

RECOMMENDATION:
PASS

FOCUS SELECTION:
PASS

SESSION STORAGE:
PASS

ACCOUNT ISOLATION:
PASS

PROMPT GENERATION:
PARTIAL

ANSWER CORRECTION:
PASS

PRACTICE EVENTS:
PASS

LEARNING INTEGRATION:
PASS

PROGRESS INTEGRATION:
PARTIAL

PERSONALIZATION:
PARTIAL

RECURRING ERROR TRAINING:
PARTIAL

USER FOCUS:
PASS

LAYOUT EXCLUSION:
PASS

SCORING:
FAIL

FEEDBACK:
PARTIAL

COMPLETION:
PASS

ERROR HANDLING:
PASS

RACE SAFETY:
PASS

PRIVACY:
PASS

SECURITY:
PASS

GROQ COST:
CONTROLLED

AI WASTE:
LOW

P0:
0

P1:
0

P2:
4

P3:
4

PRODUCTION BLOCKER:
NO

PRACTICE LOOP:
PARTIAL

NEXT IMPLEMENTATION PHASE:
WL-4B
```
