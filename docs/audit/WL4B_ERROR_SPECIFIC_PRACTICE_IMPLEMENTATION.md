# WL-4B — Error-Specific Practice Implementation

**Date:** 2026-08-27  
**Baseline:** WL-4A complete  
**Mode:** Minimal product enhancement — deterministic targeting, no AI exercise generation

---

## Executive Summary

WL-4B transforms Practice from category-level exercises into **evidence-backed error-specific practice** when recurring patterns qualify (`count >= 2`). The Learning Engine remains the source of truth; Practice consumes `computeRecurringPatterns()` output via `listPracticeRecurringTargets()`.

**Key decision:** Exercise generation is **deterministic** (no additional Groq calls). Structured AI output validation is implemented for future optional use, but WL-4B does not invoke Groq for exercise creation.

**Result:** Recurring patterns like `recieved → received` or `He go → He goes` produce targeted writing prompts. Insufficient or ambiguous evidence falls back to generic category practice unchanged.

---

## Git Baseline

| Field | Value |
|-------|-------|
| Branch | `main` |
| Commit | `61f349827f111231dd8ebdac1c557478dcb10cb8` |

---

## Before / After

| Capability | Before WL-4B | After WL-4B |
|---|---|---|
| Category recommendation | ✅ | ✅ (unchanged) |
| Recurring pattern detection | ✅ (recommendation only) | ✅ (also session targeting) |
| Pattern-specific target | ⚠️ weak hints | ✅ deterministic targeted exercises |
| Generic fallback | ✅ | ✅ (preserved) |
| User focus | ✅ category wins | ✅ category wins + best pattern in category |
| AI exercise generation | ❌ | ❌ (deferred — deterministic used) |
| AI validation | ❌ | ✅ validator ready for future |
| Account isolation | ✅ | ✅ |
| Practice learning | ✅ | ✅ (unchanged schema) |
| Layout exclusion | ✅ | ✅ |
| Groq cost | ~5 correction checks/session | **Same** — 0 extra calls |

---

## Current Practice Target Architecture

**PracticeTargetPattern** (unchanged):
- `category`, `normalizedOriginal`, `displayOriginal`, `displayCorrected`, `count`
- Sourced from `computeRecurringPatterns()` → `listPracticeRecurringTargets()`
- Threshold: `count >= 2` (`PRACTICE_TARGET_MIN_COUNT`)

**New: PracticeExerciseSpec** (`packages/shared/src/practice.ts`):
- Targeted: `exerciseType`, `targetPatternId`, `prompt`, `learningObjective`, `expectedSkill`
- Generic: `free_writing` + category prompt

**Target identity:** `practiceTargetPatternId()` = `{category}:{normalizedOriginal}`

---

## Target Selection Pipeline

```
userChoice
  → resolvePracticeFocus() [category authority]
  → selectPracticeSessionTarget()
  → eligible recurring patterns in category (count >= 2, safe token)
  → strongest by count
  → buildPracticeExercise()
  → PracticePanel
```

**Explicit user category:** User choice wins; best recurring pattern **within that category** is selected (not recommendation category).

**Recommended:** Uses recommendation pattern when eligible; else best in recommended category.

---

## Eligibility & Safety

| Rule | Value |
|------|-------|
| Min recurrence | 2 (matches `computeRecurringPatterns`) |
| Categories | spelling, grammar, wording only |
| Layout | Excluded |
| Ambiguous short tokens | Rejected if `normalizedOriginal.length < 3` |
| Insufficient evidence | Generic fallback |

---

## Exercise Generation

**FILE:** `extension/src/storage/learning/practice/exercise.ts`

Deterministic exercise types (rotated by `itemIndex`):
- `use_correct_form`
- `complete_the_sentence`
- `rewrite_naturally`
- `correct_the_sentence`

Category-specific prompt templates reference `displayOriginal → displayCorrected` without exposing full history.

**No Groq call** for exercise generation.

---

## AI Provider Usage

WL-4B does **not** add Groq exercise generation. Rationale:
- Cost limit: max 5 correction checks/session must not increase
- Deterministic prompts satisfy error-specific requirement safely
- `validatePracticeAiExerciseOutput()` ready for optional future WL phase

---

## Account Isolation

- `recurringTargets` computed from account-scoped learning events per `GET_PRACTICE_HOME`
- Integration test: Account A patterns not visible to Account B
- WL-4A correction/cache guards unchanged

---

## Learning Event Integration

Unchanged schema. Practice events still use:
- `source: 'practice'`
- `batchId: practice-{sessionId}-{itemIndex}`
- `normalizedOriginal` from correction changes

Session record preserves `targetPattern` for future WL-4D analytics.

---

## UI Changes (Minimal)

- Session view shows: *"Based on a recurring {category} pattern in your recent writing (seen {count} times)."*
- Targeted prompts reference the pattern pair in exercise text
- No scoring, tutor, or chat UI

---

## Code-Derived Examples

### CASE 1 — Spelling

| | |
|---|---|
| Category | spelling |
| Pattern | `recieved → received` (count 3) |
| Before | "Write a short message about your plans for tomorrow." |
| After | "Write a sentence that correctly uses \"received\". Do not write \"recieved\"." |

### CASE 2 — Grammar

| | |
|---|---|
| Category | grammar |
| Pattern | `he go → He goes` (count 2) |
| Before | "Describe what you did yesterday." |
| After | "Write 2–3 sentences about your day. Use correct grammar for the pattern \"He go\" → \"He goes\"." |

### CASE 3 — Wording (fallback)

| | |
|---|---|
| Category | wording |
| Pattern | count 1 only |
| Before | Generic wording prompt |
| After | **Same generic fallback** — specificity not earned |

---

## Product Validation

| Question | Answer |
|----------|--------|
| A. Trains recurring errors specifically? | **Yes** when count ≥ 2 and pattern safe |
| B. Falls back safely? | **Yes** |
| C. User focus wins? | **Yes** — explicit category authoritative |
| D. Recommendation works? | **Yes** — unchanged engine |
| E. Layout excluded? | **Yes** |
| F. Feeds Learning? | **Yes** — unchanged |
| G. Account isolation? | **Yes** |
| H. WL-4A credit safety? | **Yes** |
| I. Additional Groq calls? | **0** |
| J. Malformed AI breaks Practice? | **N/A** — no AI generation; validator tested |
| K. Cross-account leak? | **No** |

---

## Tests Added

| File | Tests |
|------|-------|
| `tests/unit/storage/practice-target-selection.test.ts` | 6 |
| `tests/unit/storage/practice-exercise.test.ts` | 5 |
| `tests/integration/wl4b-error-specific-practice.test.ts` | 5 |

---

## Regression

**122 tests passed** including WL-4A, WL-1/2/3, Phase 3B/3D/22C/22D/32A.

---

## Files Modified

| File | Change |
|------|--------|
| `packages/shared/src/practice.ts` | `PracticeExerciseSpec`, types, constants |
| `extension/src/storage/learning/practice/targetSelection.ts` | **NEW** — target listing & selection |
| `extension/src/storage/learning/practice/exercise.ts` | **NEW** — deterministic exercises + AI validator |
| `extension/src/storage/learning/practice/prompts.ts` | Re-export from exercise |
| `extension/src/background/index.ts` | `recurringTargets` in GET_PRACTICE_HOME |
| `extension/src/messaging/types.ts` | Extended `PracticeHomeResponse` |
| `extension/src/dashboard/panels/PracticePanel.tsx` | Target selection + transparency UI |
| `extension/src/popup/i18n/en.ts` | Targeted practice strings |

---

## Files Intentionally Untouched

- `computePracticeRecommendation()` scoring
- `computeRecurringPatterns()` engine
- `recordPractice*` / LearningEvent schema
- Progress formulas (WL-2)
- Personalization (WL-3)
- CORRECT_TEXT / Groq correction path
- Layout system

---

## Remaining Limitations

- No AI-generated exercise variants (future optional)
- No per-item accuracy scoring (WL-4D)
- No AI feedback/explanation (WL-4C)
- Session-level target (same pattern all 5 items, prompt variants rotate)
- Very short/ambiguous tokens fall back to generic

---

## WL-4C Readiness

**YES** — targeted practice identity preserved; feedback layer can attach to existing correction UI.

---

## Final Verdict

```
WL-4B STATUS:
COMPLETE

ERROR-SPECIFIC PRACTICE:
PASS

RECURRING PATTERN TARGETING:
PASS

TARGET SELECTION:
PASS

USER FOCUS:
PASS

GENERIC FALLBACK:
PASS

AI OUTPUT VALIDATION:
PASS

ACCOUNT ISOLATION:
PASS

ACCOUNT SWITCH SAFETY:
PASS

LEARNING INTEGRATION:
PASS

PROGRESS REGRESSION:
PASS

LAYOUT EXCLUSION:
PASS

WL-4A REGRESSION:
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
0

P3:
1

PRODUCTION BLOCKER:
NO

WL-4C READY:
YES

NEXT PHASE:
WL-4C
```
