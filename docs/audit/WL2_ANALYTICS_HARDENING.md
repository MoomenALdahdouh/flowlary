# WL-2 — Learning Analytics Hardening

**Date:** 2026-08-27  
**Mode:** FORENSIC AUDIT + MINIMAL IMPLEMENTATION  
**Baseline:** WL-1 complete (141 tests), Phase 3D layout learning, Phase 22C progress engine

---

## Executive Summary

WL-2 audited the existing Flowlary Writing Learning analytics stack end-to-end. **No new analytics system was created.** The authoritative calculation layer remains `extension/src/storage/learning/progress.ts` → `GET_PROGRESS` → `ProgressPanel`.

**Two evidence-based defects were fixed:**

1. **P1 — Trend calculation vs UI labels mismatch:** i18n labels claimed "Errors per 100 words decreased/increased" but `computeTrend()` compared raw **error counts** between 7-day periods. Fixed by making trend **rate-based** using period-specific word counts from `store.samples`.

2. **P2 — Category percentages diluted across groups:** `byTypePercent` used all errors (including layout) as denominator for writing category rows. Fixed by adding `byTypePercentWriting` and `byTypePercentInput` with group-specific denominators.

All other core metrics (errorCount, wordsWritten, errorsPer100Words, recurring patterns, empty/insufficient states) were verified correct. No Groq calls added.

---

## 1. Current Analytics Architecture

```
LearningEvent storage (account-scoped)
        ↓
computeProgressMetrics(store, sessionStore)   ← SINGLE SOURCE OF TRUTH
        ↓
background GET_PROGRESS
        ↓
ProgressPanel / ProgressTeaser (presentation only)
```

No duplicate calculation in UI components. Charts are list-based (no separate chart engine).

---

## 2. Metric Source-of-Truth Map

| Metric | Source Function | Source Data | Formula | UI Consumer |
|--------|-----------------|-------------|---------|-------------|
| Total errors (headline) | `countUniqueLearningErrors` | All non-rejected events | Dedupe by `batchId:category:normalizedOriginal`; detected+accepted → once | `ProgressPanel` "Unique errors" |
| Words written | `sumUniqueWordsWritten` | `store.samples` | Sum unique `sampleHash` word counts | Summary card |
| Errors / 100 words | `computeProgressMetrics` | errorCount, wordsWritten | `(errorCount / wordsWritten) * 100` when `wordsWritten ≥ 50` | Summary card |
| Spelling/Grammar/Wording/Layout counts | `countErrorsByType` | Deduped events | Per-category count | By-type lists |
| Writing category % | `computeGroupTypePercent` | byType, writing categories | `category / writingTotal * 100` | Writing group |
| Input category % | `computeGroupTypePercent` | byType, input categories | `category / inputTotal * 100` | Input group |
| Recurring patterns | `computeRecurringPatterns` | Deduped events | `(category, normalizedOriginal)` count ≥ 2 | Recurring section |
| Trend | `computeTrend` | Period events + period samples | Rate delta between 7d windows | Improvement section |
| Recent mistakes | `computeProgressMetrics` | Raw events (view slice) | First 8 non-rejected; no separate count | Recent section |
| Practice summary | `computePracticeSummary` | PracticeSessionStore | Session aggregates | Practice-this-week section |

---

## 3. Required Metric Table

| Metric | Source | Formula | Correct? | UI Label | Change |
|--------|--------|---------|----------|----------|--------|
| Error count | `countUniqueLearningErrors` | Unique non-rejected deduped errors | YES | "Unique errors" | None |
| Words written | `sumUniqueWordsWritten` | Unique sampleHash word sums | YES | "Words written" | None |
| Errors / 100 words | `computeProgressMetrics` | `(errorCount / wordsWritten) * 100` | YES | "Errors / 100 words" | None |
| Spelling | `countErrorsByType` | Deduped per category | YES | `learning.focus.spelling` | None |
| Grammar | `countErrorsByType` | Deduped per category | YES | `learning.focus.grammar` | None |
| Wording | `countErrorsByType` | Deduped per category | YES | `learning.focus.wording` | None |
| Layout | `countErrorsByType` | Deduped per category | YES | `learning.focus.layout` | None |
| Category % (writing) | `byTypePercentWriting` | Within writing denominator | YES (fixed) | Inline `%` | **Fixed WL-2** |
| Category % (input) | `byTypePercentInput` | Within input denominator | YES (fixed) | Inline `%` | **Fixed WL-2** |
| Recurring errors | `computeRecurringPatterns` | count ≥ 2 | YES | "Recurring patterns" | None |
| Trend | `computeTrend` | Period rate delta | YES (fixed) | "Improvement" + i18n trend strings | **Fixed WL-2** |

---

## 4. Error Count Audit

**Documented semantics:** Unique non-rejected errors; detected+accepted deduped; rejected excluded.

**Verified in code:** `countUniqueLearningErrors()` lines 73–88.

**Tests:** detected+accepted → 1; rejected excluded; WL-2 unit test.

**Problem:** NO — semantics match documentation.

---

## 5. Word Count Audit

**Source:** `store.samples` — one record per unique `sampleHash` from correction batches.

**Contributors:**
- Writing correction batches: YES (via sampleText on record)
- Practice batches: YES (same storage)
- Layout manual fixes: YES (when sampleText provided)
- Duplicate same-hash samples: NO (deduped)

**Minimum threshold:** `MIN_WORDS_FOR_ERROR_RATE = 50` (`packages/shared/src/learningEvents.ts`)

**Problem:** NO

---

## 6. Errors Per 100 Words Audit

**Formula:** `(errorCount / wordsWritten) * 100`, rounded to 1 decimal.

**Shown when:** `state === 'ready'` (`wordsWritten ≥ 50`)

**Edge cases verified:**
| Case | errorsPer100Words | state |
|------|-------------------|-------|
| 0 words, 0 errors | null | empty |
| 5 words, 1 error | null | insufficient_words |
| 50 words, 0 errors | 0 | ready |
| 1000 words, 2 errors | 0.2 | ready |

**Problem:** NO — "—" shown in UI when null; distinct from 0.0.

---

## 7. Category Analytics Audit

Writing (spelling/grammar/wording) and Input (layout) are grouped in UI.

**Before WL-2:** Layout errors diluted writing category percentages (e.g. 2 spelling + 1 layout → spelling showed 67% instead of 100% of writing errors).

**After WL-2:** Group-specific denominators.

**Note (P3 deferred):** Headline `errorsPer100Words` still uses total `errorCount` including layout errors in numerator. Phase 3C flagged optional `writingErrorCount` split — not changed in WL-2.

---

## 8. Headline Statistics Audit

| Card | Meaning | Accurate? |
|------|---------|-----------|
| Words written | Unique sample word total | YES |
| Unique errors | All-category deduped errors | YES (label matches) |
| Errors / 100 words | Total error rate | YES (see P3 note on layout mix) |

No duplicate headline cards. No fake "score" metric.

---

## 9. Trend Audit

### Before WL-2

```typescript
delta = ((currentErrors - previousErrors) / previousErrors) * 100
```

UI labels (`en.ts`):
- "Errors per 100 words decreased {percent}%..."
- "Errors per 100 words increased {percent}%..."

**PHASE22C_REPORT** documented count-based trend; **i18n labels** documented rate-based trend. **Mismatch = P1 bug.**

### Trend Decision Table

| Question | Finding |
|----------|---------|
| Current trend basis (pre-fix) | Raw error count delta between 7-day periods |
| Count or rate | Count (implementation) vs Rate (UI labels) |
| Product intent | "Language improvement" / "Improvement" section implies writing quality |
| Is current behavior misleading? | **YES** — labels describe rate; calculation used count |
| Evidence | `en.ts` trendImproved/trendIncreased; WL-1 audit P2-2 |
| Change required? | **YES** |
| New formula | `((currentRate - previousRate) / previousRate) * 100` where `rate = errors / periodWords * 100` |
| Insufficient-data rule | Requires `MIN_ERRORS_FOR_TREND` (3) in each period AND `MIN_WORDS_FOR_ERROR_RATE` (50) words in each period; zero previous rate → insufficient unless both zero (flat) |

### After WL-2

```typescript
currentRate = (currentErrors / currentWords) * 100
previousRate = (previousErrors / previousWords) * 100
delta = ((currentRate - previousRate) / previousRate) * 100
```

Period words from `sumUniqueWordsInPeriod(store.samples, periodStart, periodEnd)`.

### Before/After Example

**Scenario:** Period A: 100 words, 5 errors (5%). Period B: 500 words, 10 errors (2%).

| | Before | After |
|---|--------|-------|
| Calculation | 5 → 10 errors = +100% "increased" | 5% → 2% = −60% "improved" |
| UI claim | "Errors per 100 words increased" | "Errors per 100 words decreased" |
| Correct? | NO (misleading) | YES |

---

## 10. Empty State Audit

`state === 'empty'` when no events AND no words.

UI shows "Your progress is building" — not 0% rate, not "improving".

**Problem:** NO

---

## 11. Insufficient Data Audit

| State | Condition | UI |
|-------|-----------|-----|
| empty | 0 words, 0 errors | Building placeholder |
| insufficient_words | events or words but `< 50` words | Summary shown; rate = "—"; message about collecting data |
| ready | `≥ 50` words | Full metrics |

Trend also returns `not_enough_data` when period thresholds unmet.

**Problem:** NO

---

## 12. Rounding Audit

| Metric | Rounding |
|--------|----------|
| errorsPer100Words | 1 decimal (`Math.round(x * 1000) / 10`) |
| byTypePercent | Integer percent |
| trend.percent | Integer (`Math.round(Math.abs(delta))`) |
| Counts | Integer (no rounding) |

Rounding at calculation layer; UI uses `.toFixed(1)` for rate display only.

---

## 13. Chart / Data Audit

No chart library. Lists only (by-type, recurring, recent). Data from single `ProgressMetrics` object. No stale duplicate paths.

**Problem:** N/A — PASS

---

## 14. Account Isolation Audit

All metrics computed from account-scoped `GET_PROGRESS` reads. WL-2 integration test verifies A/B separation.

**Problem:** NO

---

## 15. Privacy & Cost

- No new data fields
- No telemetry
- Local-only computation
- **Groq cost: ZERO additional calls**

---

## 16. Bugs Found

| ID | Severity | Issue | Fix |
|----|----------|-------|-----|
| WL2-P1 | P1 | Trend used error count; UI claimed error rate | Rate-based `computeTrend` |
| WL2-P2 | P2 | Writing category % diluted by layout | Group-specific percentages |
| WL2-P3 | P3 | Headline rate includes layout in numerator | Documented for future |
| WL2-P3 | P3 | `byTypePercent` (global) still computed but unused in UI | Retained for API compat |

---

## 17. Fixes Made

| File | Change |
|------|--------|
| `extension/src/storage/learning/progress.ts` | Rate-based trend; `sumUniqueWordsInPeriod`; `byTypePercentWriting/Input` |
| `extension/src/dashboard/panels/ProgressPanel.tsx` | Use group-specific percentages |
| `tests/unit/storage/progress.test.ts` | +7 analytics tests |
| `tests/integration/wl2-analytics-hardening.test.ts` | **NEW** — 4 integration tests |

---

## 18. Files Intentionally Untouched

- LearningEvent schema / service
- Recommendation engine / scoring
- Practice engine
- Correction pipeline
- Layout learning (Phase 3D)
- i18n trend strings (already rate-accurate; no change needed)
- Entitlement / credits / providers

---

## 19. Deferred Work

| Phase | Scope |
|-------|-------|
| **WL-3** | focusAreas personalization, narrative feedback |
| **WL-4** | Practice redesign, layout practice |
| **WL-5** | HistoryDiff, activity UX |
| **P3** | Optional headline split: writing error rate vs layout |

---

## 20. Tests Added

**Unit (`progress.test.ts`):** rejected exclusion, empty state, zero-error ready state, group percentages, rate trend with volume change, period word sums, insufficient trend.

**Integration (`wl2-analytics-hardening.test.ts`):** account isolation, insufficient words, layout group percentages, rate trend scenario.

---

## 21. Regression Results

| Suite | Result |
|-------|--------|
| WL-2 tests | 22 pass |
| WL-1 | 16 pass |
| Phase 3B | 20 pass |
| Phase 3D | 10 pass |
| Phase 22C | 6 pass |
| Phase 22D | 4 pass |
| Phase 32A | 14 pass |
| **Total targeted** | **92 pass, 0 fail** |

---

## 22. Final Verdict

```
WL-2 STATUS:
COMPLETE

ERROR COUNT:
PASS

WORD COUNT:
PASS

ERROR RATE:
PASS

CATEGORY ANALYTICS:
PASS

HEADLINE METRICS:
PASS

TREND:
PASS

EMPTY STATE:
PASS

INSUFFICIENT DATA:
PASS

ROUNDING:
PASS

CHART DATA:
PASS

ACCOUNT ISOLATION:
PASS

PRIVACY:
PASS

GROQ COST:
ZERO

WL-1 REGRESSION:
PASS

PHASE 3D REGRESSION:
PASS

TESTS:
92 passed
0 failed

P0:
0

P1:
1 (fixed)

P2:
1 (fixed)

P3:
2

PRODUCTION BLOCKER:
NO

NEXT PHASE:
WL-3
```

---

## Evidence Table

### Trend fix

| Field | Value |
|-------|-------|
| FILE | `extension/src/storage/learning/progress.ts` |
| FUNCTION | `computeTrend()` |
| CHANGE | Compare period error rates using `sumUniqueWordsInPeriod` |
| WHY | UI labels describe rate; count-based trend was misleading when writing volume changed |
| TEST | `progress.test.ts` rate trend; `wl2-analytics-hardening.test.ts` |
| COST | 0 Groq |

### Category percentage fix

| Field | Value |
|-------|-------|
| FILE | `extension/src/storage/learning/progress.ts`, `ProgressPanel.tsx` |
| FUNCTION | `computeGroupTypePercent`, `byTypePercentWriting/Input` |
| CHANGE | Separate denominators for Writing vs Input groups |
| WHY | Layout errors must not dilute writing category percentages |
| TEST | `progress.test.ts` group percentages; WL-2 integration |
| COST | 0 Groq |
