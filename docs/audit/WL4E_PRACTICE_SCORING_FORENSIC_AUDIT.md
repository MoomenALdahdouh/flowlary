# WL-4E — Practice Scoring & Learning Progression Forensic Audit

**Date:** 2026-08-27  
**Scope:** Target-level practice performance and progression  
**Baseline:** WL-4A/B complete, Full Learning Report + Export complete

---

## 1. Pipeline trace (verified)

```
Writing / Practice input
  → CORRECT_TEXT (PracticePanel → requestPracticeCorrection)
  → recordPracticeDetected / Accepted / Rejected  [recordCorrectionLearning.ts]
  → LearningEventService.record()                  [events/index.ts, source='practice']
  → PracticeSessionStore.saveSession()             [sessions.ts]
  → computeProgressMetrics()                       [progress.ts — writing vs practice separated]
  → computePracticeRecommendation()                [recommendation.ts — writing events only]
  → listPracticeRecurringTargets()                 [targetSelection.ts]
  → Daily Brief / Full Report                      [existing snapshot layers]
```

---

## 2. Audit questions — answers

### A. What practice outcome data already exists?

| Source | Fields |
|--------|--------|
| `LearningEvent` (`source='practice'`) | `batchId`, `category`, `original`, `corrected`, `normalizedOriginal`, `action` (detected/accepted/rejected), `timestamp` |
| `PracticeSessionRecord` | `targetPattern`, `itemsAttempted`, `itemsCompleted`, `correctionsDetected/Accepted/Rejected`, `wordsWritten`, `startedAt`, `completedAt` |
| **Not stored** | Per-item outcome flags, item-level target match, explicit success/failure enum |

### B. Reusable fields

- Target identity: `practiceTargetPatternId()` → `{category}:{normalizedOriginal}` ✅
- Practice batch IDs: `practice-{sessionId}-{itemIndex}` ✅ (PracticePanel line 203–204)
- Session-level aggregates ✅
- Target-specific errors: derivable from practice events where `normalizedOriginal` matches target ✅

### C. Item-level results reconstructable?

**Partially.** For completed sessions with `targetPattern`:

- Batch IDs `practice-{sessionId}-0..(itemsCompleted-1)` can be inferred from `PracticeSessionRecord.id` + `itemsCompleted`
- Target error on item = `detected` practice event on that `batchId` matching target `normalizedOriginal`
- **Zero-change success** = completed item batchId with **no** target-matching `detected` event

**Limitation (P2):** Non-target errors on a completed item count as inferred “clean” for the target — conservative bias documented.

### D. Can accepted/rejected measure performance safely?

- `detected` on target = learner made the target error (failed attempt on target)
- `accepted` / `rejected` = learner action after detection — both imply the error occurred
- **Do not** count accepted/rejected as success
- Rejected practice events are rare in UX (user dismisses correction) — still counts as target error occurrence

### E. Zero-change items

- PracticePanel advances without recording events when `response.changes.length === 0` ✅
- Counted as **clean attempts** via batchId inference (no detected event) ✅
- WL-4A `rollbackAttemptMetrics` ensures failed API calls do not increment attempts ✅

### F. Failed/network/aborted checks excluded?

| Case | Behavior | Verified |
|------|----------|----------|
| API failure | `rollbackAttemptMetrics`, no events | WL-4A tests |
| Aborted request | rollback, no events | WL-4A |
| Account switch mid-check | stale guard, rollback | WL-4A |
| Credit exhaustion | blocked before API, no events | WL-4A |
| Zero-change | no events, item completes | PracticePanel 295–300 |

### G. Group by target pattern?

Yes — match `category` + `normalizedOriginal` to `practiceTargetPatternId`.

### H. Account isolation?

- Learning events: account-scoped ✅
- Practice sessions: account-scoped ✅
- Same patterns as WL-4A/B tests ✅

### I. Historical data sufficient?

- Old sessions without `targetPattern` (pre-WL-4B): no target progression — returns `new` / insufficient
- Old sessions with targetPattern: progression derivable from aggregates + events
- No backfill invented ✅

### J. What must NOT be inferred?

- CEFR / proficiency level ❌
- Universal English score ❌
- Mastery percentage ❌
- Improvement from writing-only data alone for practice progression ❌
- Success from `accepted` events alone ❌

---

## 3. Evidence model decision

**No new storage schema required** for v1.

Derive from:

1. `PracticeSessionRecord` where `targetPattern` matches (completed sessions)
2. Inferred batch IDs + practice `LearningEvent` target-matching `detected` events
3. Writing recurrence via existing `computeRecurringPatterns` on writing events (for `needs_attention` only)

---

## 4. Progression states (evidence thresholds)

| State | Requirements |
|-------|----------------|
| `new` | 0 inferred practice attempts on target |
| `insufficient` | 1 attempt only |
| `practicing` | 2+ attempts, no stronger signal |
| `improving` | 4+ attempts; recent half clean rate ≥ prior half + 0.25 |
| `stable` | 3+ attempts AND ≥75% clean AND 0 target errors in last 3 attempts |
| `needs_attention` | 2+ target errors in last 3 attempts OR (writing recurrence ≥2 AND practice error rate ≥50% with 2+ attempts) |

Performance measure: **target-specific clean attempt rate** (not global English score).

---

## 5. Writing vs practice boundary

| Signal | Source filter |
|--------|---------------|
| Writing recurrence | `source === 'writing'` only |
| Practice performance | `source === 'practice'` + session records |
| `computePracticeRecommendation` | Already writing-only — **unchanged** |
| `progress.writingErrorCount` vs `practiceErrorCount` | Already separate — **preserved** |

---

## 6. Recommendation integration

**Do not rewrite** `computePracticeRecommendation()`.

Post-process in `GET_PRACTICE_HOME`:

- Attach progression map to recurring targets
- Deprioritize `stable` patterns when selecting/displaying recommendation (fall through to next recurring target)

User category choice remains authoritative (WL-4B).

---

## 7. UI integration (minimal)

- Practice **completion screen**: show progression state + evidence-backed message when quality ≥ partial
- Practice **home**: optional progression hint on recommended pattern
- No XP, stars, streaks, leaderboards

---

## 8. Daily Brief / Full Report

- **Daily Brief:** optional single-line progression note when `improving` or `stable` with ready evidence — extend snapshot minimally
- **Full Report:** add `practiceProgressions[]` (top targets) to analysis snapshot — consumed by existing narrative builder

Zero Groq.

---

## 9. Risks & limitations

| ID | Limitation |
|----|------------|
| P2 | Non-target errors on clean batchIds inflate target success |
| P2 | Pre-WL-4B sessions lack `targetPattern` |
| P3 | `improving` requires 4+ attempts — slow to appear |

---

## 10. Implementation verdict

**PROCEED** with deterministic derivation from existing events + session records.  
**No new LearningEvent fields.** **No Groq.** **Minimal recommendation post-processing.**

---

## Audit status: PASS — implementation justified
