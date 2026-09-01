# WL-4F — AI Learning Coach Forensic Audit

**Date:** 2026-08-27  
**Scope:** Evidence-grounded AI tutoring layer on existing learning engine  
**Baseline:** WL-4D (Daily Brief), Full Learning Report, WL-4E (Practice Progression), WL-4C (Explanation)

---

## 1. Executive summary

Flowlary already has a **complete deterministic learning pipeline** and one production Groq narration path (Full Learning Report). An AI Learning Coach can be added **safely** as a presentation/reasoning layer that:

1. Consumes **`LearningAnalysisSnapshot` + `DailyLearningBriefSnapshot` + `LearningProfile`**
2. Sends a **minimal structured payload** to Groq (never raw events)
3. Validates AI output against snapshot evidence
4. Falls back to **deterministic coach responses** on failure, Free tier, or missing consent
5. Uses a **separate account-scoped AI quota** (does not consume Daily Brief or Full Report quotas)

**Verdict:** Implementation is **safe** with strict boundaries. Coach must NOT become a second analytics engine.

---

## 2. Current architecture

```
User writing (extension)
  → CORRECT / recordLearningEvents
  → LearningEventService (account-scoped)
  → computeProgressMetrics()
  → attachPersonalizationToProgress()
  → computePracticeRecommendation()
  → computeTargetPracticeProgression()        [WL-4E]
  → computeDailyBriefSnapshot()               [WL-4D]
  → computeLearningAnalysisSnapshot()         [Full Report]
  → [optional] Full Report Groq narration     [Pro/Trial, 1/day]
  → (future) AI Learning Coach                [WL-4F]
```

**Coach is layer 9 — not a fork of layer 1.**

---

## 3. Available structured evidence

### 3.1 `LearningAnalysisSnapshot` (primary)

**Schema:** `packages/shared/src/learningReport.ts`  
**Builder:** `extension/src/storage/learning/report/computeLearningAnalysisSnapshot.ts`

| Field group | Coach use |
|-------------|-----------|
| `evidenceQuality` | Gate strong claims |
| `activity.*` | Words, events, error rate, practice sessions |
| `categoryMetrics`, `categoryPercentWriting` | Category breakdown |
| `recurringPatterns[]` | Top patterns + optional `explanation` (trusted rules) |
| `trend` | Improvement claims (7-day writing rate) |
| `focusCategory`, `prioritizedCategories`, `areasToImprove` | Focus coaching |
| `strengths[]` | Positive observations |
| `practicePlan` | Recommended action + top targets |
| `practiceProgressions[]` | Target-level practice performance (WL-4E) |
| `layoutInputCount` | **Exclude** from English coaching |

### 3.2 `DailyLearningBriefSnapshot` (daily action)

**Schema:** `packages/shared/src/learningBrief.ts`  
**Builder:** `extension/src/storage/learning/brief/computeDailyBrief.ts`

| Field | Coach use |
|-------|-----------|
| `state` | empty / insufficient / ready |
| `recurringPattern` | Single top pattern |
| `improvement` | Daily trend signal |
| `recommendedAction` | Actionable next step |
| `targetProgression` | Optional improving/stable signal |
| `hasRecentWriting` | Recency context |

**Quota:** 3 meaningful generations/day — **Coach must NOT consume this.**

### 3.3 `LearningProfile`

**Schema:** `packages/shared/src/learning.ts`

| Field | Coach use | Constraint |
|-------|-----------|------------|
| `focusAreas` | User authority | Never override |
| `level?` | Self-reported preference | **Not evidence** — label as self-reported |
| `learningLanguage` | English scope (V1) | |
| `nativeLanguage?` | Explanation locale hint | |

### 3.4 Explanation / trusted rules

**Resolver:** `packages/shared/src/explanation/trustedRules/resolver.ts`

- Named rules (`ruleId`, `ruleTitle`) **only** when `source === 'trusted_rule'`
- Coach may cite explanations embedded in `recurringPatterns[].explanation`
- Coach must **not** invent rule IDs

### 3.5 Practice progression (WL-4E)

**Module:** `packages/shared/src/practiceProgression.ts`

States: `new`, `insufficient`, `practicing`, `improving`, `stable`, `needs_attention`  
Coach may reference only when `evidenceQuality !== 'insufficient'`.

---

## 4. Coach data boundary

### MUST send to Groq (aggregated)

- Evidence quality, period, word/event counts, error rate
- Recurring patterns (category, original, corrected, count)
- Trend label/direction/percent
- Focus categories, prioritized areas
- Practice action kind
- Practice progressions (state, attempts, clean rate)
- Trusted explanation summaries (if present in snapshot)
- Coach mode + normalized user question
- UI locale
- Self-reported level (explicitly labeled)

### MUST NOT send

- Raw `LearningEvent[]`
- Full writing samples / page content
- Account IDs, emails, install IDs, API keys
- Evidence version hashes (internal cache only)
- Translation history
- Layout as English-learning evidence
- Internal storage keys

---

## 5. Groq integration path (template)

**Existing template:** Full Learning Report narration

| Layer | File |
|-------|------|
| Provider | `backend/src/providers/learningReportNarrationProvider.ts` |
| Gateway | `backend/src/gateway/index.ts` → `learningReportNarrate()` |
| Route | `POST /api/ai/learning-report-narrate` |
| Extension fetch | `extension/src/background/learningReportNarrate.ts` |
| Validation | `packages/shared/src/learningReportValidation.ts` |
| Orchestrator | `extension/src/storage/learning/report/resolveFullLearningReport.ts` |

**Coach should mirror:**

```
POST /api/ai/learning-coach
  → learningCoachProvider.ts
  → gateway.learningCoach()
  → fetchLearningCoach() [extension]
  → validateLearningCoachResponse()
  → resolveLearningCoach()
```

### Groq role

| Allowed | Forbidden |
|---------|-----------|
| Natural-language tutoring | Error counting |
| Personalized explanation | Trend calculation |
| Summarization of provided evidence | Recurring pattern detection |
| Suggesting approach to known target | Mastery / CEFR inference |
| Conversational tone | Entitlement / credit decisions |

### Cost model (recommended)

| Feature | Credits | Quota |
|---------|---------|-------|
| Deterministic coach | 0 | Unlimited |
| AI coach (Pro/Trial) | **0** (match Full Report) | **5 interactions/day/account** (new `learningCoachQuota`) |
| Daily Brief | 0 | 3/day (unchanged) |
| Full Report AI | 0 | 1/day (unchanged) |
| Correction | 1 | Daily credits |

**Trigger:** Explicit user click only — no Groq on dashboard load.

---

## 6. Entitlement model

| Tier | Deterministic coach | AI coach |
|------|---------------------|----------|
| Signed out | Sign-in prompt | No |
| Free (signed in) | Yes | No |
| Pro / Trial | Yes | Yes (consent + quota) |

Gate: `learning.full` capability / `entitlement.isPro || inTrial` + `isCorrectionAiReady()` (consent)

Backend: reject `rateLimitTier === 'free'` (same as report narrate)

---

## 7. Account isolation

| Mechanism | Location |
|-----------|----------|
| Account-scoped storage | `accountScopedStorage.ts` |
| New quota kind | `learningCoachQuota` |
| In-flight guard | `activeAccountContext.matches()` after fetch |
| Write guards | `captureWriteGuard()` |

**Mandatory tests:** Account A context ≠ B; cache isolation; mid-request account switch discards AI response.

---

## 8. Existing quota isolation

| Quota | Kind | Max/day | Coach interaction |
|-------|------|---------|-------------------|
| Daily Brief | `learningBriefQuota` | 3 | **Do not consume** |
| Full Report | `learningReportQuota` | 1 | **Do not consume** |
| Coach AI | `learningCoachQuota` (new) | 5 | **Separate** |

Opening Coach does not regenerate Brief or Report.

---

## 9. Explanation integration

| Action | Wiring |
|--------|--------|
| Coach cites trusted rule | From `recurringPatterns[].explanation` in snapshot |
| "Understand this" action | Navigate to `#report` patterns section OR inline summary |
| Do NOT | Mount content-script `ExplanationPanel` from dashboard |
| Do NOT | Duplicate trusted rule library |
| Do NOT | Groq-invent `ruleId` |

---

## 10. Practice integration

| Action | Wiring |
|--------|--------|
| `practice_pattern` | `go('practice')` with target intent |
| `practice_focus` | `go('practice')` with category intent |
| Recommendation source | `practicePlan.recommendedAction` + `recurringPatterns` |

Do not create practice engine inside Coach.

---

## 11. Layout / translation boundary

| Signal | Coach treatment |
|--------|-----------------|
| Layout errors | Exclude from English coaching |
| Translation activity | Exclude entirely |
| `layoutInputCount` | Never cite as English progress |

---

## 12. Recommended v1 scope

### Coach modes (minimal)

| Mode | Purpose |
|------|---------|
| `focus` | What should I focus on? |
| `recurring_error` | Why do I keep making this error? |
| `improving` | Am I improving? |
| `practice_help` | Help me practice |
| `custom` | User-typed question (bounded length) |

**Defer:** multi-turn chat, layout coaching, session-embedded coach, export conversation

### UI location

**Overview panel** — evolve `DailyBriefCard` slot into `LearningCoachCard`:

- Deterministic brief summary on load (no Groq)
- Preset question buttons
- Optional text input
- Structured response + action buttons
- Link to `#report` for weekly deep review

**No new sidebar nav item in v1.**

### Response contract

```typescript
LearningCoachResponse {
  summary: string
  observations: string[]
  recommendations: string[]
  explanations: string[]      // trusted evidence only
  actions: LearningCoachAction[]
  evidenceReferences: string[]
  source: 'deterministic' | 'ai'
}
```

---

## 13. AI output validation requirements

Client-authoritative validation (pattern from `validateLearningReportNarration`):

- JSON schema shape
- No CEFR / mastery / psychology claims
- Categories ⊆ snapshot allowed set
- Pattern pairs ⊆ known recurring patterns
- Counts in text must match snapshot counts (basic numeric guard)
- Improvement claims require `trend.label === 'improved'`
- Progression claims require matching `practiceProgressions` state
- Rule IDs must exist in snapshot explanations
- Actions must reference valid targets from context
- Strip HTML / reject script tags

**On failure:** show deterministic fallback — never invalid AI text.

---

## 14. Deterministic fallback

Built from existing engines via `resolveMessage()` — same strings as Daily Brief / Full Report where applicable.

Coach remains useful when:
- Free tier
- Groq unavailable
- Validation fails
- Quota exhausted
- Insufficient evidence

---

## 15. Privacy analysis

| Data | Stored | Sent to Groq |
|------|--------|--------------|
| Raw writing | Local events only | **No** |
| Pattern pairs | In snapshot | Yes (aggregated) |
| Explanation text | Trusted rule summaries | Yes (if in snapshot) |
| User question | Transient | Yes (normalized, max 500 chars) |
| Account ID | Local scoped storage | **No** (JWT auth header only) |

---

## 16. Dashboard architecture

**Nav sections:** overview, progress, practice, report, settings, privacy, account

**Overview learning stack:**
1. ComposeWorkbench
2. UsageStatusCard
3. LearningSetupCard
4. **DailyBriefCard** ← evolve to LearningCoachCard
5. LearningProfileCard
6. ProgressTeaser

**Existing APIs:** `GET_DAILY_BRIEF`, `GET_FULL_LEARNING_REPORT`, `GET_PROGRESS`, `GET_PRACTICE_HOME`

**Missing:** `ASK_LEARNING_COACH` message type

---

## 17. Risks & findings

### P0 — None identified

Architecture supports coach without rewriting learning engine.

### P1

| ID | Finding | Mitigation |
|----|---------|------------|
| P1-1 | No practice deep-link from Overview | Pass intent props to PracticePanel |
| P1-2 | Brief has no explanation field | Coach reads from Full Report snapshot slice |
| P1-3 | Free users expect AI coach | Clear UI: deterministic + Pro upgrade hint |

### P2

| ID | Finding | Notes |
|----|---------|-------|
| P2-1 | Non-target practice errors count as clean (WL-4E) | Coach must not overclaim practice mastery |
| P2-2 | `learning.full` capability not uniformly UI-enforced | Coach gates explicitly in resolver |
| P2-3 | Pre-WL-4B practice sessions lack batch inference | Progression returns insufficient honestly |

### P3

| ID | Finding |
|----|---------|
| P3-1 | Report not in dashboard tour |
| P3-2 | Duplicate fetches (brief + coach context) — acceptable v1 |

---

## 18. Recommended implementation scope

### Create

| Component | Path |
|-----------|------|
| Shared types + validation | `packages/shared/src/learningCoach.ts` |
| Backend provider | `backend/src/providers/learningCoachProvider.ts` |
| Extension context builder | `extension/src/storage/learning/coach/buildLearningCoachContext.ts` |
| Deterministic coach | `extension/src/storage/learning/coach/buildDeterministicCoach.ts` |
| Resolver + quota | `extension/src/storage/learning/coach/resolveLearningCoach.ts` |
| BG fetch | `extension/src/background/learningCoach.ts` |
| UI | `extension/src/dashboard/components/LearningCoachCard.tsx` |

### Extend

- `accountScopedStorage.ts` — `learningCoachQuota`
- `gateway/index.ts`, `routes/http.ts`
- `messaging/types.ts`, `validate.ts`, `api.ts`, `background/index.ts`
- `OverviewPanel.tsx` — replace DailyBriefCard
- `App.tsx` — practice intent props (optional v1)
- i18n `en.ts`, `ar.ts`

### Do NOT modify

- Learning event schema
- Practice recommendation core
- Explanation trusted rule library
- Daily Brief / Full Report quota logic
- Report export
- Entitlement credit reservation (coach uses quota-only model)

---

## 19. Test plan (minimum)

1. Context construction from snapshots only
2. Groq payload excludes forbidden fields
3. Validation rejects CEFR, invented patterns, unsupported improvement
4. Deterministic fallback on AI failure
5. Account isolation (A ≠ B)
6. Signed-out behavior
7. Free tier → deterministic only
8. Quota isolation (coach ≠ brief ≠ report)
9. Account switch mid-request
10. Cache hit does not increment quota
11. Layout/translation exclusion
12. Regression: WL-4A/B/C/D/E, Full Report, Export

---

## 20. Audit verdict

```
FORENSIC AUDIT: PASS
IMPLEMENTATION SAFE: YES
ADDITIONAL LEARNING ENGINE REQUIRED: ZERO
PRODUCTION BLOCKER: NO (pending implementation + tests)
```

---

*Next: minimal implementation per §18, following Full Report narration template.*
