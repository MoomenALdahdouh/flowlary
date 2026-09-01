# Full Learning Report — Forensic Audit & Implementation

**Date:** 2026-08-27  
**Phase:** Full Learning Report (post WL-4D)  
**Schema:** `FULL_REPORT_SCHEMA_VERSION = 1`

---

## 1. Executive summary

The Full Learning Report transforms existing structured learning evidence into a learner-facing educational analysis. It reuses the Learning Engine (no second analytics engine), builds a deterministic `LearningAnalysisSnapshot`, optionally enhances narration via Groq for Pro/Trial, and renders a dedicated dashboard panel.

**Architecture:**

```
LearningEvent
  → computeProgressMetrics()
  → attachPersonalizationToProgress()
  → computePracticeRecommendation() / selectPracticeSessionTarget()
  → computeLearningAnalysisSnapshot()
  → buildDeterministicFullReportNarrative()
  → [optional Pro Groq narration + validateLearningReportNarration]
  → resolveFullLearningReport() [quota + cache]
  → LearningReportPanel (dashboard #report)
```

---

## 2. Existing evidence sources (forensic audit)

| Source | Location | Used for |
|--------|----------|----------|
| `LearningEvent` | `packages/shared/src/learningEvents.ts` | Writing/practice events |
| `computeProgressMetrics()` | `extension/src/storage/learning/progress.ts` | Words, errors, categories, trends input |
| `computeRecurringPatterns()` | same | Recurring mistake patterns |
| `computeTrend()` | same | WL-2 rate-based improvement (writing-only) |
| `attachPersonalizationToProgress()` | `extension/src/storage/learning/personalization.ts` | Focus, prioritized categories |
| `computePracticeRecommendation()` | `extension/src/storage/learning/practice/recommendation.ts` | Practice plan |
| `selectPracticeSessionTarget()` | `extension/src/storage/learning/practice/targetSelection.ts` | Pattern targets |
| `resolveExplanation()` | `packages/shared/src/explanation/trustedRules/resolver.ts` | Trusted/pair explanations on patterns |
| Daily Brief snapshot | `extension/src/storage/learning/brief/` | Shared engine path; separate UI/quota |

**Not used / excluded:**

- Layout events → `layoutInputCount` metadata only; never English weakness
- Translation source events → excluded from writing filters
- Raw page content, browsing history, keyboard history

**Unavailable evidence (documented honestly):**

- CEFR level — not computed; AI validator rejects CEFR claims
- Mastery / XP / streaks — deferred to Practice Scoring phase
- Per-rule grammar names unless trusted rule library matches

---

## 3. LearningAnalysisSnapshot

**File:** `packages/shared/src/learningReport.ts`  
**Builder:** `extension/src/storage/learning/report/computeLearningAnalysisSnapshot.ts`

Fields are traceable to existing engine outputs:

- `activity` — from `computeProgressMetrics()` (writing-only event count via `filterWritingPracticeEvents`)
- `categoryMetrics` / `categoryPercentWriting` — `byType` / `byTypePercentWriting`
- `recurringPatterns` — `computeRecurringPatterns()` + `resolveExplanation()` per pattern
- `trend` — `computeTrend()` on writing events (WL-2 rate logic)
- `focusCategory`, `prioritizedCategories` — WL-3 personalization
- `practicePlan` — WL-4B recommendation + targets
- `evidenceQuality` — `no_data` | `insufficient` | `partial` | `ready` (conservative thresholds)

`evidenceVersion` — deterministic hash (`buildFullReportEvidenceVersion`) for cache identity.

---

## 4. Report period

Uses existing `PROGRESS_TREND_PERIOD_MS` (7 days) as `periodDays`. Trend compares two comparable 7-day windows via WL-2 `computeTrend()` — no invented periods.

---

## 5. Evidence rules

| Quality | Condition |
|---------|-----------|
| `no_data` | Zero writing learning events |
| `insufficient` | Progress/personalization insufficient states |
| `partial` | `< 50` words or `< 3` writing events |
| `ready` | Otherwise |

Strong conclusions require recurring patterns (≥2) and sufficient word volume (`MIN_WORDS_FOR_ERROR_RATE = 50` for rates).

---

## 6. Strength logic

Conservative only:

- `no_recurring_observed` — category with ≤1 errors and no recurring pattern
- `lowest_category_share` — lowest `byTypePercentWriting` share (< 20%)

Never infers strength from absence of data alone when evidence is `no_data` / `insufficient`.

---

## 7. Focus logic

Priority order matches Daily Brief / WL-3:

1. `personalization.systemRecommendedFocus`
2. `personalization.prioritizedCategories`
3. `profile.focusAreas`

User preference does not override recurring evidence in snapshot ranking (`prioritizedCategories` from engine).

---

## 8. Recurring patterns

- Source: `computeRecurringPatterns(writingEvents, 8)`
- Threshold: count ≥ 2 (engine default)
- Each pattern includes `targetPatternId` for WL-4B practice
- Optional `explanation` from `resolveExplanation()` — trusted rule or pair-level fallback only

---

## 9. Trend logic

Writing-only `computeTrend()` — respects error **rate** not raw counts. Deterministic narrative only claims improvement when `trend.label === 'improved'`.

---

## 10. Explanation integration

WL-4C `resolveExplanation()` on synthetic correction change per pattern. No invented rule names. Grammar without trusted match stays uncertain/pair-level.

---

## 11. Practice integration

`practicePlan.recommendedAction` from WL-4B `selectPracticeSessionTarget()`. UI `[Practice this]` navigates to Practice home (same P2 as Daily Brief — no auto-targeted session).

---

## 12. AI architecture

```
LearningAnalysisSnapshot
  → buildGroqReportPayload() [minimal structured evidence]
  → POST /api/ai/learning-report-narrate [Pro/Trial only]
  → validateLearningReportNarration() [client authoritative]
  → merge or deterministic fallback
```

Groq is **narrator only** — never analytics, rule detection, or evidence generation.

---

## 13. Groq input (privacy)

Sent to backend (Pro narration only):

- Period days, evidence quality
- Aggregated word/event/error counts and error rate
- Category counts (spelling/grammar/wording)
- Recurring pattern pairs + counts (no full sentences)
- Trend label/percent, focus, practice action kind

**Not sent:** account identifiers in payload body, full samples, translation/layout history, browsing data, secrets.

---

## 14. AI output schema

```json
{
  "overview": "...",
  "strengths": [],
  "focusAreas": [],
  "improvements": [],
  "recommendations": [],
  "nextSteps": []
}
```

---

## 15. AI validation

**File:** `packages/shared/src/learningReportValidation.ts`

Rejects: CEFR, unsupported categories, invented patterns, improvement without trend, strong claims on insufficient evidence.

Backend performs basic shape + CEFR check; client performs full snapshot validation.

---

## 16. Deterministic fallback

**File:** `extension/src/storage/learning/report/buildDeterministicReport.ts`

Always produced. Used when: unsigned/out, Groq failure, validation failure, Free tier, daily limit without cache.

Localized via `resolveMessage()` (no React dependency in service worker path).

---

## 17. Daily quota

- `FULL_REPORT_MAX_GENERATIONS_PER_DAY = 1`
- Separate from Daily Brief (`3/day`) and correction credits
- Backend narration does **not** call `reserveManagedUsage()` — no correction credit consumption
- Same `evidenceVersion + locale + schemaVersion` → cache hit, quota unchanged

---

## 18. Cache

Account-scoped key: `learning.reportQuota` (`FullReportQuotaV1`)

Cache identity: `evidenceVersion:locale:FULL_REPORT_SCHEMA_VERSION`

---

## 19. Evidence version

`buildFullReportEvidenceVersion()` hashes snapshot fields that affect report meaning (patterns, trend, focus, activity totals).

---

## 20. Localization

- UI strings: `learningReport.*` in `en.ts`, `ar.ts` (others fall back to English)
- English examples remain English in all locales
- Deterministic narrative uses `resolveMessage(locale)`

---

## 21. Account isolation

- Quota + cached report stored under `flowlary.account.<id>.learning.reportQuota`
- Generation checks `activeAccountContext` before applying Groq results
- Signed-out → `state: 'signed_out'`, no personalized report

---

## 22. Privacy & security

- No client-controlled account ID for data load — uses `readAccountSession()` + scoped storage
- No Groq API key in extension
- Minimal structured evidence to Groq only on Pro narration path

---

## 23. UI

- **Panel:** `extension/src/dashboard/panels/LearningReportPanel.tsx`
- **Nav:** Dashboard `#report` (`nav.report`)
- **Export:** button disabled (placeholder for REPORT EXPORT phase)
- Distinct from `DailyBriefCard` on Overview

---

## 24. Free / Pro policy

| Tier | Deterministic report | AI narration |
|------|---------------------|--------------|
| Signed-out | No | No |
| Free (`learning.basic`) | Yes | No |
| Pro/Trial (`learning.full`) | Yes | Yes, max 1 generation/day/account |

Does not consume correction credits. Separate report quota only.

---

## 25. Future boundaries

- **Export (PDF/DOCX/MD):** `FullLearningReport` + `LearningAnalysisSnapshot` are export-ready; no JSX coupling
- **AI Coach:** may consume snapshot + narrative + Daily Brief snapshot; no raw event access required

---

## 26. Tests

**File:** `tests/integration/full-learning-report.test.ts` (13 tests)

Covers: empty/insufficient/ready, layout/translation exclusion, cache/quota, account isolation, deterministic narrative, AI validation, Groq fallback, localization.

**Regression (WL-4 scope):** 59 passed (WL-4A/B/C/D + Full Report)

---

## 27. Files changed

| Area | Path |
|------|------|
| Shared types | `packages/shared/src/learningReport.ts` |
| Validation | `packages/shared/src/learningReportValidation.ts` |
| Snapshot | `extension/src/storage/learning/report/computeLearningAnalysisSnapshot.ts` |
| Deterministic copy | `extension/src/storage/learning/report/buildDeterministicReport.ts` |
| Resolver | `extension/src/storage/learning/report/resolveFullLearningReport.ts` |
| Groq client | `extension/src/background/learningReportNarrate.ts` |
| Backend | `backend/src/providers/learningReportNarrationProvider.ts` |
| Gateway/route | `backend/src/gateway/index.ts`, `backend/src/routes/http.ts` |
| UI | `extension/src/dashboard/panels/LearningReportPanel.tsx` |
| i18n | `extension/src/popup/i18n/en.ts`, `ar.ts`, `resolveMessage.ts` |
| Storage | `extension/src/storage/accountScopedStorage.ts` |

---

## 28. Remaining limitations (P2/P3)

- P2: Practice button does not auto-start targeted pattern session
- P2: No inline `[Understand]` explanation drawer in report panel
- P3: Non-ar locales use English deterministic strings until translated
- P3: Account-switch during in-flight Groq relies on context guard (tested via isolation; no explicit delay simulation)

---

## Final verdict

```
FULL LEARNING REPORT STATUS: COMPLETE

FORENSIC AUDIT: PASS
LEARNING ANALYSIS SNAPSHOT: PASS
EVIDENCE TRACEABILITY: PASS
WRITING ANALYSIS: PASS
STRENGTHS: PASS
AREAS TO IMPROVE: PASS
RECURRING PATTERNS: PASS
TREND: PASS
FOCUS: PASS
EXPLANATIONS: PASS
PRACTICE: PASS
LAYOUT EXCLUDED: PASS
TRANSLATION EXCLUDED: PASS
AI SAFETY: PASS
AI OUTPUT VALIDATION: PASS
DETERMINinistic FALLBACK: PASS
GROQ: 0 calls (tests mock failure / no live API)
GROQ COST: 0
DAILY REPORT QUOTA: PASS
CACHE: PASS
EVIDENCE VERSION: PASS
LOCALIZATION: PASS
SIGN-OUT: PASS
ACCOUNT ISOLATION: PASS
ACCOUNT SWITCH: PASS
PRIVACY: PASS
SECURITY: PASS
WL-4D REGRESSION: PASS
WL-4C REGRESSION: PASS
WL-4B REGRESSION: PASS
WL-4A REGRESSION: PASS
FEATURE AVAILABILITY REGRESSION: not re-run (unchanged surface)

TOTAL TESTS: 59 passed / 0 failed (WL-4 + Full Report integration scope)
Shared package: 97 passed

P0: 0
P1: 0
P2: 2
P3: 2

PRODUCTION BLOCKER: NO

NEXT PHASE: REPORT EXPORT — PDF / DOCX / MD
```
