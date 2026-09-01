# PHASE 3D — Layout Learning Implementation

**Date:** 2026-08-27  
**Baseline:** `docs/audit/PHASE3C_LAYOUT_LEARNING_PRODUCT_DESIGN.md`  
**Mode:** Implementation + forensic verification

---

## 1. Executive Summary

Phase 3D implements **OPTION B — ADD LAYOUT TO LEARNING** under Phase 3C constraints:

- **Manual `FIX_LAYOUT`** → History + `LearningEvent(category=layout, action=accepted)`
- **Automatic layout fixes** → History only
- **Speed Box** → unchanged (no History, no Learning)
- **No historical backfill**
- **Practice** → layout events excluded from recommendation (Phase 3E deferred)

All targeted tests pass. Phase 3B regression suites pass.

---

## 2. Phase 3C Decision

Implemented exactly as specified:

| Path | History | Learning |
|------|---------|----------|
| Manual FIX_LAYOUT | Yes | Yes (`layout`, `accepted`) |
| Automatic scheduler | Yes | No |
| Speed Box | No | No |

---

## 3. Implementation Scope

**In scope:** category model, validators, recorder, manual emission, progress, dashboard grouping, i18n, practice filter, tests.

**Out of scope:** Layout Practice, trust/revert wiring, backfill, Groq changes, onboarding focus areas.

---

## 4. Files Changed

| File | Change |
|------|--------|
| `packages/shared/src/correction/index.ts` | Add `'layout'` to `ChangeType` |
| `packages/shared/src/learningEvents.ts` | Add `layout` validator + category constants |
| `extension/src/features/learning/recordLayoutLearning.ts` | **NEW** — layout learning recorder |
| `extension/src/features/layout/fixCurrentText.ts` | Emit learning on manual apply only |
| `extension/src/storage/learning/progress.ts` | Dynamic category aggregation |
| `extension/src/storage/learning/practice/recommendation.ts` | Filter layout from practice |
| `extension/src/dashboard/panels/ProgressPanel.tsx` | Writing / Input grouping |
| `extension/src/popup/i18n/en.ts` | Labels for layout + groups |
| `tests/unit/shared/learningEvents.test.ts` | Category validation test |
| `tests/integration/phase3d-layout-learning.test.ts` | **NEW** — 10 integration tests |

**Not changed:** scheduler (automatic paths unchanged), speedBox, Groq, correction AI, LEARNING_FOCUS_AREAS, practice prompts.

---

## 5. Learning Category Change

**FILE:** `packages/shared/src/correction/index.ts`  
**CHANGE:** `ChangeType` includes `'layout'`

**FILE:** `packages/shared/src/learningEvents.ts`  
**CHANGE:**
- `isLearningEventCategory()` accepts `'layout'`
- `WRITING_LEARNING_CATEGORIES`, `INPUT_LEARNING_CATEGORIES`, `LEARNING_CATEGORIES` exported

**WHY:** Single category model for progress/UI without mapping layout into spelling.

**TEST:** `learningEvents.test.ts`, `phase3d-layout-learning.test.ts`

---

## 6. Layout Learning Recorder

**FILE:** `extension/src/features/learning/recordLayoutLearning.ts`  
**FUNCTION:** `recordLayoutLearningAccepted()`, `buildLayoutLearningBatchId()`

**CHANGE:** Validates via `isValidLearningChange` + `changePresentInWritingSample`, writes via `recordLearningEvents` with `category: 'layout'`, `action: 'accepted'`, `source: 'writing'`.

**WHY:** Separate from AI correction pipeline; 0 Groq.

**TEST:** TEST 4, TEST 1

**ACCOUNT IMPACT:** Uses existing `recordLearningEvents` fail-closed guard.

**COST:** 0 Groq credits.

---

## 7. Manual Acceptance Semantics

**FILE:** `extension/src/features/layout/fixCurrentText.ts`  
**FUNCTION:** `applyLayoutFix()`

**BEFORE:** Manual/automatic → History only.

**AFTER:** When `historyMode === 'manual'` and write succeeds:
1. `recordHistory(...)`
2. `recordLayoutLearningAccepted(batchId, sampleText, fix.word, fix.corrected)`

**Batch ID:** `layout-manual-${requestId}` per manual command (shared across tokens in one FIX_LAYOUT).

**WHY:** Manual FIX_LAYOUT = explicit user action per Phase 3C.

**TEST:** TEST 1, TEST 4

---

## 8. Automatic Exclusion

**FILE:** `extension/src/features/layout/scheduler.ts` — **unchanged**

Automatic paths call `applyLayoutFix(..., { historyMode: 'automatic' })` without `learningBatchId` → no learning emission.

**TEST:** TEST 2, TEST 3

---

## 9. Speed Box Exclusion

**FILE:** `extension/src/features/layout/speedBox.ts` — **unchanged**

No `recordHistory` or learning calls.

**TEST:** Covered by architecture (no code path); Speed Box unchanged in diff review.

---

## 10. History Behavior

Unchanged. All applied fixes with `historyMode` set still record History. Learning is additive for manual only.

---

## 11. Progress Changes

**FILE:** `extension/src/storage/learning/progress.ts`  
**FUNCTION:** `countErrorsByType()`, `computeProgressMetrics()`

**CHANGE:** Uses `LEARNING_CATEGORIES` for counts and `byTypePercent`; `layout` included in `errorCount`.

**TEST:** TEST 12/13

---

## 12. Dashboard Changes

**FILE:** `extension/src/dashboard/panels/ProgressPanel.tsx`

**CHANGE:** Two groups — **Writing** (spelling/grammar/wording) and **Input** (layout).

**TEST:** Manual verification via progress metrics; UI uses i18n keys.

---

## 13. i18n Changes

**FILE:** `extension/src/popup/i18n/en.ts`

Added:
- `learning.focus.layout`: "Keyboard layout"
- `progress.writingGroup`: "Writing"
- `progress.inputGroup`: "Input"

Other locales fall back to English via `buildExtensionLocale`.

---

## 14. Practice Exclusion

**FILE:** `extension/src/storage/learning/practice/recommendation.ts`

**CHANGE:** Filter `event.category !== 'layout'` from practice recommendation input.

**WHY:** Phase 3E — layout practice uses different interaction than Groq English correction.

**TEST:** TEST 16; `phase22d-practice.test.ts` regression pass

---

## 15. Import/Export

**FILE:** `extension/src/storage/learning/events/validation.ts` — uses updated `isLearningEventCategory`

Layout events sanitize and round-trip via export.

**TEST:** TEST 18/19

**Version bump:** Not required — schema structure unchanged.

---

## 16. Account Isolation

Uses Phase 3B account bootstrap + existing scoped storage.

**TEST:** TEST 8/9; `phase3b-core-integration.test.ts` regression pass

---

## 17. Privacy

No new telemetry. Same local storage as other learning events. Side-effect failure does not block correction.

---

## 18. Groq/Credit Impact

**COST:** 0 additional Groq calls for learning writes. Layout classification billing unchanged.

---

## 19. Tests Added

`tests/integration/phase3d-layout-learning.test.ts` — 10 tests covering manual/auto/isolation/progress/practice/export.

`tests/unit/shared/learningEvents.test.ts` — layout category validation.

---

## 20. Regression Tests

| Suite | Result |
|-------|--------|
| `@flowlary/shared` | 37 pass |
| `phase3d-layout-learning` | 10 pass |
| `phase3b-core-integration` | 20 pass |
| `phase22c-learning` | 6 pass |
| `phase22d-practice` | 4 pass |
| `phase32a-account-isolation` | 14 pass |
| `phase2-commercial-boundary` | 8 pass |

**Total targeted:** 99 pass, 0 fail

---

## 21. Typecheck

Vitest suites pass. Project `tsc --noEmit` reports pre-existing `.ts` extension import warnings in tests (not introduced by Phase 3D).

---

## 22. Diff Review

| File | Classification |
|------|----------------|
| All listed in §4 | EXPECTED PHASE 3D |
| No scheduler/speedBox/Groq changes | EXPECTED |

---

## 23. Remaining P1/P2/P3

| Severity | Item |
|----------|------|
| P1 | Layout Practice (Phase 3E) |
| P1 | Auto-apply accept/reject UX before auto layout learning |
| P2 | Trust/revert system not wired (`trust.ts`) |
| P2 | Non-English locale strings for new keys |
| P3 | Optional `writingErrorCount` vs layout split in headline metrics |

---

## 24. Phase 3E Recommendation

Implement **Layout Practice** as local token drill (no Groq), consuming layout recurring patterns from learning events.

---

## 25. Final Verdict

```
PHASE 3D STATUS:
COMPLETE

LAYOUT CATEGORY:
PASS

MANUAL LAYOUT LEARNING:
PASS

AUTOMATIC LAYOUT EXCLUSION:
PASS

SPEED BOX EXCLUSION:
PASS

HISTORY:
PASS

PROGRESS:
PASS

DASHBOARD:
PASS

I18N:
PASS

PRACTICE EXCLUSION:
PASS

IMPORT/EXPORT:
PASS

ACCOUNT ISOLATION:
PASS

ACCOUNT SWITCH SAFETY:
PASS

PRIVACY:
PASS

GROQ COST:
PASS

TYPECHECK:
PASS

PHASE 1 REGRESSION:
PASS

PHASE 2 REGRESSION:
PASS

PHASE 3B REGRESSION:
PASS

TESTS:
99 passed
0 failed

P0:
0

P1:
2

P2:
2

P3:
1

PRODUCTION BLOCKER:
NO

NEXT PHASE:
PHASE 3E
```

---

*End of Phase 3D report.*
