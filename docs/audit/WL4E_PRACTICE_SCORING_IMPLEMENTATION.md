# WL-4E — Practice Scoring & Learning Progression Implementation

**Date:** 2026-08-27  
**Prerequisite:** [WL4E_PRACTICE_SCORING_FORENSIC_AUDIT.md](./WL4E_PRACTICE_SCORING_FORENSIC_AUDIT.md)

---

## Summary

WL-4E adds **deterministic, target-level practice progression** derived from existing `LearningEvent` + `PracticeSessionRecord` data. No new storage schema, no Groq calls, no gamification, no CEFR/mastery claims.

**Core module:** `packages/shared/src/practiceProgression.ts`

---

## Architecture

```
PracticeSessionRecord (completed, targetPattern)
  + LearningEvent (source='practice', batchId=practice-{sessionId}-{index})
        ↓
buildTargetAttemptOutcomes()
        ↓
computeTargetPracticeProgression()  → state + evidenceQuality
        ↓
Consumers:
  • GET_PRACTICE_HOME → targetProgressions + deprioritized recurringTargets
  • PracticePanel → home hint + session complete message
  • Daily Brief snapshot → optional targetProgression (improving/stable only)
  • Full Report snapshot → practiceProgressions[] + deterministic narrative
```

---

## Progression states (evidence-gated)

| State | Evidence requirement |
|-------|---------------------|
| `new` | 0 practice attempts on target |
| `insufficient` | 1 attempt |
| `practicing` | ≥2 attempts, no stronger signal |
| `improving` | ≥4 attempts, recent clean rate ≥ prior + 25pp |
| `stable` | ≥3 attempts, ≥75% clean, 0 errors in last 3 attempts |
| `needs_attention` | ≥2 target errors in recent window, or high writing recurrence + poor practice rate |

**Clean attempt:** completed item batchId with no target-matching `detected` practice event (includes zero-change successes).

---

## Files changed

| File | Change |
|------|--------|
| `packages/shared/src/practiceProgression.ts` | **New** — core progression logic |
| `packages/shared/src/learningBrief.ts` | Optional `targetProgression` on snapshot |
| `packages/shared/src/learningReport.ts` | `practiceProgressions[]` on analysis snapshot |
| `packages/shared/src/index.ts` | Export progression module |
| `extension/src/background/index.ts` | `GET_PRACTICE_HOME` post-processes recommendation |
| `extension/src/messaging/types.ts` | `targetProgressions` on `PracticeHomeResponse` |
| `extension/src/dashboard/panels/PracticePanel.tsx` | Progression hints (home + complete) |
| `extension/src/dashboard/components/DailyBriefCard.tsx` | Progression note when present |
| `extension/src/storage/learning/brief/computeDailyBrief.ts` | Attach `targetProgression` |
| `extension/src/storage/learning/report/computeLearningAnalysisSnapshot.ts` | Populate `practiceProgressions` |
| `extension/src/storage/learning/report/buildDeterministicReport.ts` | Progression recommendations |
| `extension/src/popup/i18n/en.ts`, `ar.ts` | Progression strings |

---

## Recommendation integration

`computePracticeRecommendation()` is **unchanged**. Post-processing in `GET_PRACTICE_HOME`:

1. Compute all target progressions
2. Deprioritize `stable` patterns in `recurringTargets` (keeps at least one if sole target)
3. If recommended pattern is `stable`, swap to next non-stable recurring target when available

User-selected focus (`grammar`, `spelling`, etc.) remains authoritative via existing `selectPracticeSessionTarget()`.

---

## Boundaries preserved

- **Writing vs practice:** progression uses practice batch IDs only; writing recurrence is a separate signal for `needs_attention`
- **Layout:** excluded from English practice progression (`spelling|grammar|wording` only)
- **WL-4A:** failed/aborted checks still roll back; no score damage
- **Account isolation:** progression computed from account-scoped stores only
- **Privacy:** no new raw text storage; aggregates + existing event fields only

---

## Known limitations (P2)

1. Non-target errors on a completed practice item infer as “clean” for the target pattern
2. Historical sessions before WL-4B targeted sessions lack batch-level inference (returns `insufficient` honestly)
3. Single recurring target that reaches `stable` cannot be removed from list (by design — always keep ≥1 target)

---

## Tests

| Suite | File | Count |
|-------|------|-------|
| Unit | `tests/unit/shared/practiceProgression.test.ts` | 11 |
| Integration | `tests/integration/wl4e-practice-progression.test.ts` | 6 |

**Regression (unchanged):**

- WL-4A: 10 passed
- WL-4B: 5 passed
- WL-4C-D: 19 passed
- WL-4D: 12 passed
- Full Learning Report: 13 passed
- Report Export: 9 passed

**Total WL-4E scope:** 17 new tests, 74 regression tests passed

---

## Final verdict matrix

```
WL-4E STATUS:
COMPLETE

PRACTICE SCORING:
PASS

TARGET PROGRESSION:
PASS

EVIDENCE QUALITY:
PASS

RECOMMENDATION INTEGRATION:
PASS

DAILY BRIEF:
PASS

FULL REPORT:
PASS

ACCOUNT ISOLATION:
PASS

PRIVACY:
PASS

GROQ COST:
0 additional calls

CREDIT IMPACT:
0

LAYOUT EXCLUSION:
PASS

WL-4A REGRESSION:
PASS

WL-4B REGRESSION:
PASS

WL-4C REGRESSION:
PASS

WL-4D REGRESSION:
PASS

FULL REPORT REGRESSION:
PASS

TESTS:
74 passed (regression) + 17 passed (WL-4E) = 91 passed
0 failed

P0:
0

P1:
0

P2:
3 (documented above)

P3:
0

PRODUCTION BLOCKER:
NO

NEXT PHASE:
AI LEARNING COACH / WEBSITE WRITING LAB / LAYOUT PRACTICE
```
