# WL-3 — Writing Learning Personalization

**Date:** 2026-08-27  
**Mode:** FORENSIC AUDIT + MINIMAL IMPLEMENTATION  
**Baseline:** WL-1 (path reconnection), WL-2 (analytics hardening), Phase 3D (layout learning)

---

## Executive Summary

WL-3 connected the **existing** LearningProfile `focusAreas` and progress analytics to deterministic personalization — without rewriting Learning, Practice, or recommendation architecture.

**Before WL-3:**
- `focusAreas` existed in profile storage and onboarding/settings UI
- `computePracticeRecommendation()` ignored user focus areas
- ProgressPanel showed metrics but no personalized narrative
- No system vs user focus distinction in dashboard

**After WL-3:**
- `computeLearningPersonalization()` derives insights from progress + profile + recommendation
- `GET_PROGRESS` returns `personalization` block (account-scoped)
- `computePracticeRecommendation()` accepts optional `userFocusAreas` as tie-breaker (+25)
- ProgressPanel shows deterministic "Your focus" insights (i18n, no AI)
- User manual focus preserved; explicit Practice choice still overrides recommendation

**Zero Groq/Google calls added.**

---

## 1. Current Personalization Architecture

```
LearningEvents (account-scoped)
        ↓
computeProgressMetrics()          ← WL-2 authoritative analytics
        ↓
computePracticeRecommendation(events, now, profile.focusAreas)
        ↓
computeLearningPersonalization(metrics, profile, events, recommendation)
        ↓
GET_PROGRESS → ProgressPanel "Your focus" section
```

Practice path unchanged except recommendation reads profile focus areas:

```
GET_PRACTICE_HOME → computePracticeRecommendation(..., profile.focusAreas)
PracticePanel → resolvePracticeFocus(userChoice, recommendation)
  userChoice !== 'recommended' → user wins
```

---

## 2. Focus Area Audit

| Aspect | Finding |
|--------|---------|
| Schema | `LearningProfile.focusAreas: LearningFocus[]` |
| Valid values | `spelling`, `grammar`, `wording` (NOT layout) |
| Defaults | `['grammar', 'spelling']` |
| Storage | Account-scoped `flowlary.account.<id>.learning.profile` |
| UI | OnboardingFlow, LearningSettingsSection |
| Pre-WL-3 consumers | formatLearningSummary, background status only |
| Post-WL-3 consumers | personalization, practice recommendation boost |

**Layout:** Learning category exists (Phase 3D) but is NOT a `LearningFocus` / not in `LEARNING_FOCUS_AREAS`.

---

## 3. Signal Table

| Signal | Source | Available | Reliable | Used | Reason |
|--------|--------|-----------|----------|------|--------|
| Error count | `countUniqueLearningErrors` | Yes | Yes | Indirect | Via byType/recurring |
| Category count | `countErrorsByType` | Yes | Yes | Yes | Prioritization base |
| Recurrence | `computeRecurringPatterns` | Yes | Yes | Yes | Strongest evidence |
| Recency | Event timestamps | Yes | Yes | Yes | 7-day window bonus |
| Trend | `metrics.trend` (WL-2) | Yes | Yes | Yes | Insight only |
| Words written | `sumUniqueWordsWritten` | Yes | Yes | Yes | Sufficiency gate |
| Error rate | `errorsPer100Words` | Yes | Yes | No | Deferred P3 headline split |
| Practice performance | PracticeSessionStore | Partial | Limited | No | Not reliable enough for WL-3 |
| User focus | `LearningProfile.focusAreas` | Yes | Yes | Yes | Preserved + tie-break |

---

## 4. Personalization Matrix

| Situation | Expected behavior |
|-----------|-------------------|
| No data | `state: no_data`, building profile message, no system focus |
| Insufficient data | `state: insufficient`, no system focus, user focus shown if set |
| One isolated error | Insufficient — no false system recommendation |
| Repeated error | Recurring pattern insight + system focus when recommendation ready |
| Repeated category | Category prioritized by recurrence score |
| Improving category | Trend insight only when WL-2 trend sufficient |
| Worsening category | Trend insight only when WL-2 trend sufficient |
| User-selected focus | Shown in insights; profile never overwritten |
| Automatic recommendation | `systemRecommendedFocus` from practice recommendation |
| Layout focus | `inputFocusCategory: layout` when layout errors ≥ 2; NOT English Practice |
| Account switch | Profile + events account-scoped; no cross-account personalization |

---

## 5. Prioritization Logic

**Writing category scores** (deterministic):

```
base = byType[category] * 10
+ recurring: count * 100 + recencyBonus (25 if within 7 days)
+ userFocusBoost (25 if category in profile.focusAreas)
```

Recurrence beats raw frequency. User focus is tie-breaker, not override of strong recurrence evidence.

**Practice recommendation boost:** Same +25 on recurring pattern score when category ∈ `focusAreas`.

---

## 6. Manual vs Automatic Focus

| Type | Source | Mutability |
|------|--------|------------|
| USER_SELECTED | `LearningProfile.focusAreas` | User edits in settings/onboarding |
| SYSTEM_RECOMMENDED | `computePracticeRecommendation` | Read-only computed |

User choice wins in Practice when `focusChoice !== 'recommended'` (Phase 22D semantics preserved).

System never writes to `LearningProfile` in WL-3.

---

## 7. Personalized Feedback

Deterministic i18n insights (`personalization.*`):

- Building profile (insufficient data)
- User focus areas
- System suggested focus
- Recurring pattern
- Trend improved/increased (from WL-2 trend)
- Input layout focus (not Practice)

No LLM. No judgmental copy.

---

## 8. Bugs Found / Fixed

| ID | Issue | Fix |
|----|-------|-----|
| WL3-P1 | `focusAreas` ignored by recommendation | Pass `profile.focusAreas` to `computePracticeRecommendation` |
| WL3-P1 | No personalization output | New `computeLearningPersonalization` + GET_PROGRESS attachment |
| WL3-P2 | No dashboard feedback | ProgressPanel "Your focus" section |

---

## 9. Files Changed

| File | Change |
|------|--------|
| `packages/shared/src/learning.ts` | Personalization types + `MIN_WRITING_EVENTS_FOR_PERSONALIZATION` |
| `extension/src/storage/learning/personalization.ts` | **NEW** — compute + attach |
| `extension/src/storage/learning/practice/recommendation.ts` | Optional `userFocusAreas` boost |
| `extension/src/storage/learning/progress.ts` | Optional `personalization` on ProgressMetrics |
| `extension/src/background/index.ts` | GET_PROGRESS/CLEAR/GET_PRACTICE_HOME wiring |
| `extension/src/storage/index.ts` | Exports |
| `extension/src/dashboard/panels/ProgressPanel.tsx` | Insights UI |
| `extension/src/popup/i18n/en.ts` | Personalization strings |
| `tests/unit/storage/personalization.test.ts` | **NEW** |
| `tests/integration/wl3-personalization.test.ts` | **NEW** |
| `tests/unit/storage/practice-recommendation.test.ts` | Focus tie-break test |

---

## 10. Files Intentionally Untouched

- LearningEvent schema/service
- Progress formulas (WL-2)
- Practice engine/scoring/UI structure
- Layout learning (Phase 3D)
- Groq/Google providers
- Entitlement/credits

---

## 11. Deferred

| Phase | Scope |
|-------|-------|
| **WL-4** | Practice enhancements, layout practice |
| **WL-5** | HistoryDiff, activity UX |
| **P3** | Writing-only headline error rate split |

---

## 12. Regression Results

| Suite | Result |
|-------|--------|
| WL-3 unit + integration | 16 pass |
| WL-1 | 16 pass |
| WL-2 | 22 pass |
| Phase 3B/3D/22C/22D/32A | 36 pass |
| **Total targeted** | **90 pass, 0 fail** |

---

## 13. Final Verdict

```
WL-3 STATUS:
COMPLETE

FOCUS AREAS:
PASS

PERSONALIZATION:
PASS

PRIORITIZATION:
PASS

RECURRING ERROR SIGNAL:
PASS

TREND SIGNAL:
PASS

DATA SUFFICIENCY:
PASS

MANUAL FOCUS:
PASS

AUTOMATIC FOCUS:
PASS

PERSONALIZED FEEDBACK:
PASS

LAYOUT BOUNDARY:
PASS

PRACTICE BOUNDARY:
PASS

ACCOUNT ISOLATION:
PASS

ACCOUNT SWITCH SAFETY:
PASS

PRIVACY:
PASS

GROQ COST:
ZERO

GOOGLE COST:
ZERO

WL-1 REGRESSION:
PASS

WL-2 REGRESSION:
PASS

PHASE 3D REGRESSION:
PASS

TESTS:
90 passed
0 failed

P0:
0

P1:
2 (fixed)

P2:
0

P3:
1

PRODUCTION BLOCKER:
NO

NEXT PHASE:
WL-4
```

---

## Evidence

| Field | Value |
|-------|-------|
| FILE | `extension/src/storage/learning/personalization.ts` |
| FUNCTION | `computeLearningPersonalization()` |
| CHANGE | Deterministic personalization from existing signals |
| WHY | WL-3 scope — connect focusAreas + analytics to feedback |
| TEST | `wl3-personalization.test.ts`, `personalization.test.ts` |
| COST | 0 Groq |

| Field | Value |
|-------|-------|
| FILE | `extension/src/storage/learning/practice/recommendation.ts` |
| FUNCTION | `computePracticeRecommendation(..., userFocusAreas)` |
| CHANGE | +25 tie-break boost for profile focus areas |
| WHY | Connect user preferences without overriding recurrence |
| TEST | `practice-recommendation.test.ts`, `wl3-personalization.test.ts` |
| COST | 0 Groq |
