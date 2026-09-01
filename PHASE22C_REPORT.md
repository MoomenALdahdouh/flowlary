# Phase 22C — Real Learning Events + Progress Engine

## Phase 22C Implementation Report

### 1. LearningEvent architecture

**Schema** (`packages/shared/src/learningEvents.ts`):
- `id`, `version`, `timestamp`, `batchId`, `source` (`writing` | `future-practice`)
- `category` (`spelling` | `grammar` | `wording`)
- `original`, `corrected`, `normalizedOriginal`, `normalizedCorrected`
- `action` (`detected` | `accepted` | `rejected`)
- `sampleWordCount`, `sampleHash` (writing-sample denominator dedupe)

**Storage** (`extension/src/storage/learning/events/index.ts`):
- Key: `flowlary.learning.events`
- Store shape: `{ version, events[], samples[] }`
- `LearningEventService` with serialized writes (history pattern)
- Retention: **2,000 events max** (newest preserved on trim)
- Writing samples trimmed to same bound
- Malformed entries dropped on read; store self-heals on init

**Normalization**:
- `normalizeLearningText()` — trim, collapse whitespace, lowercase
- No stemming; `their` ≠ `there`
- `isValidLearningChange()` rejects empty/identical pairs
- `changePresentInWritingSample()` ensures original appeared in user text

### 2. Event recording

**Origin** (`extension/src/features/learning/recordCorrectionLearning.ts`):
- Hooked into correction pipeline only (no translation/layout/speed box/live translation)

| Trigger | Location | Action |
|---------|----------|--------|
| Box mode card shown | `deliverCorrectionResult` | `detected` |
| Direct commit / Apply accepted | `commitMergedCorrection` | `accepted` |
| Card dismissed | `dismissCorrectionSuggestion` | `rejected` |

**Duplicate prevention**:
- Dedupe key: `batchId:category:normalizedOriginal:action` at write time
- Progress numerator dedupes `detected`+`accepted` in same batch (accepted wins)
- Re-record attempts with same key are ignored

**Metric semantics** (documented in `progress.ts`):
- **Error** = unique `(batchId, category, normalizedOriginal)` where action ≠ `rejected`
- Accepted does not add a second error when detected already exists
- Rejected never counts as an error

### 3. Word counting

**Implementation** (`packages/shared/src/wordCount.ts`):
- Split on whitespace; count tokens containing alphanumeric characters
- `"Hello world."` → 2, `""` → 0

**Denominator formula**:
- Sum of unique `sampleHash` word counts from writing samples
- One sample per correction batch; no per-change word inflation

**Errors / 100 words**:
```
errorsPer100Words = (uniqueLearningErrors / uniqueWordsWritten) × 100
```
- Shown only when `wordsWritten ≥ 50` (`MIN_WORDS_FOR_ERROR_RATE`)

### 4. Progress

**Metrics** (`extension/src/storage/learning/progress.ts`):
- Words written, learning error count, errors / 100 words
- By type (spelling, grammar, wording) with percentages when meaningful
- 7-day rolling trend vs previous 7 days (requires ≥3 errors in each period)
- Recent learning events (writing corrections only)
- Recurring patterns (≥2 occurrences, same category + normalized original)

**Insufficient-data thresholds**:
- `empty` — no events and no words
- `insufficient_words` — events exist but < 50 words (no error rate shown)
- `ready` — enough words for error rate

**Trend**: current 7d vs previous 7d error counts; honest “Not enough data yet” when baseline insufficient

### 5. UI

**Progress page** (`extension/src/dashboard/panels/ProgressPanel.tsx`):
- Summary, improvement/trend, by type, recurring patterns, recent learning
- Practice CTA disabled (future Phase 22D)
- Clear learning history (independent from Activity)

**Overview teaser** (`ProgressTeaser`):
- Shows words + errors/100 when ready; otherwise honest placeholder + “View progress”

### 6. Privacy

- Learning events local only; never uploaded
- New Privacy cards for learning profile + learning events
- `CLEAR_LEARNING_EVENTS` deletes events/samples only — preserves Activity, LearningProfile, settings, account, consent

### 7. Tests

**Added**:
- `tests/unit/shared/wordCount.test.ts`
- `tests/unit/storage/progress.test.ts`
- `tests/integration/phase22c-learning.test.ts`

**Total**: **596 tests — 596 passed, 0 failed**

Includes:
- Double-counting integration test (1 mistake → error count = 1)
- Activity separation test (50 history entries ≠ learning errors)
- Normalization, retention, insufficient data, clear learning preserves activity/profile

### 8. Build

- Production build: **SUCCESS**

### 9. Files changed

**Shared**
- `packages/shared/src/learningEvents.ts` (new)
- `packages/shared/src/wordCount.ts` (new)
- `packages/shared/src/events.ts`
- `packages/shared/src/types.ts`
- `packages/shared/src/index.ts`

**Extension**
- `extension/src/storage/learning/events/index.ts` (new)
- `extension/src/storage/learning/progress.ts` (new)
- `extension/src/features/learning/recordCorrectionLearning.ts` (new)
- `extension/src/features/correction/applyCorrection.ts`
- `extension/src/features/correction/scheduler.ts`
- `extension/src/storage/index.ts`
- `extension/src/background/index.ts`
- `extension/src/messaging/types.ts`
- `extension/src/messaging/validate.ts`
- `extension/src/popup/api.ts`
- `extension/src/dashboard/panels/ProgressPanel.tsx`
- `extension/src/dashboard/panels/OverviewPanel.tsx`
- `extension/src/dashboard/panels/SettingsPanel.tsx`
- `extension/src/dashboard/App.tsx`
- `extension/src/dashboard/dashboard.css`
- `extension/src/popup/i18n/messages.ts`

**Tests**
- `tests/unit/shared/wordCount.test.ts` (new)
- `tests/unit/storage/progress.test.ts` (new)
- `tests/integration/phase22c-learning.test.ts` (new)

### 10. Remaining Phase 22D work

**Practice is NOT implemented yet.**

Phase 22D will add:
- PracticeSession
- Practice editor / drills
- Recurring-mistake practice UI
- Functional “Practice your weakest area” flow

Not in scope: TTS, cloud learning sync, multilingual correction, Arabic extension UI.
