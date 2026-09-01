# WL-4F — AI Learning Coach Implementation

**Date:** 2026-08-27  
**Prerequisite:** [WL4F_AI_LEARNING_COACH_FORENSIC_AUDIT.md](./WL4F_AI_LEARNING_COACH_FORENSIC_AUDIT.md)

---

## Summary

WL-4F adds an **evidence-grounded AI Learning Coach** on the Overview dashboard. The coach consumes existing `LearningAnalysisSnapshot` + `DailyLearningBriefSnapshot` + `LearningProfile` — never raw events. Groq narrates only on explicit user click (Pro/Trial); Free users receive deterministic coaching.

**No second learning engine. No correction credits consumed.**

---

## Architecture

```
LearningEvent store
  → computeLearningAnalysisSnapshot()
  → computeDailyBriefSnapshot()
  → buildLearningCoachContext()
  → buildDeterministicCoachResponse()     [always]
  → [optional] POST /api/ai/learning-coach
  → validateLearningCoachResponse()
  → LearningCoachCard UI
```

---

## Contracts

### `LearningCoachContext` (internal)

Built in `buildLearningCoachContext.ts` from existing snapshots. Not sent wholesale to Groq — stripped via `buildGroqCoachPayload()`.

### `LearningCoachResponse`

```typescript
{
  summary: string
  observations: string[]
  recommendations: string[]
  explanations: string[]       // trusted evidence only
  actions: LearningCoachAction[]
  evidenceReferences: string[]
  source: 'deterministic' | 'ai'
}
```

### Coach modes (v1)

| Mode | Preset question |
|------|-----------------|
| `focus` | What should I focus on? |
| `recurring_error` | Why do I keep making this error? |
| `improving` | Am I improving? |
| `practice_help` | Help me practice |
| `custom` | User-typed (max 500 chars) |

---

## Files changed

| File | Change |
|------|--------|
| `packages/shared/src/learningCoach.ts` | Types, validation, Groq payload, quota constants |
| `packages/shared/src/index.ts` | Export |
| `backend/src/providers/learningCoachProvider.ts` | Groq provider |
| `backend/src/gateway/index.ts` | `learningCoach()` gateway method |
| `backend/src/routes/http.ts` | `POST /api/ai/learning-coach` |
| `extension/src/storage/accountScopedStorage.ts` | `learningCoachQuota` kind |
| `extension/src/storage/learning/coach/buildLearningCoachContext.ts` | Context builder |
| `extension/src/storage/learning/coach/buildDeterministicCoach.ts` | Deterministic fallback |
| `extension/src/storage/learning/coach/resolveLearningCoach.ts` | Orchestrator + cache/quota |
| `extension/src/background/learningCoach.ts` | Extension → API fetch |
| `extension/src/background/index.ts` | `ASK_LEARNING_COACH` handler |
| `extension/src/messaging/types.ts` | Message + response types |
| `extension/src/messaging/validate.ts` | Request validation |
| `extension/src/popup/api.ts` | `askLearningCoach()` |
| `extension/src/dashboard/components/LearningCoachCard.tsx` | Coach UI (replaces DailyBriefCard slot) |
| `extension/src/dashboard/panels/OverviewPanel.tsx` | Mount coach card |
| `extension/src/dashboard/App.tsx` | `onOpenReport` wiring |
| `extension/src/dashboard/dashboard.css` | Coach styles |
| `extension/src/popup/i18n/en.ts`, `ar.ts` | Coach strings |

**Unchanged:** Daily Brief resolver, Full Report resolver, Practice engine, Explanation library, Export.

---

## Cost & entitlement

| Item | Value |
|------|-------|
| AI coach quota | 5 interactions/day/account |
| Correction credits | 0 |
| Daily Brief quota | Unchanged (3/day) |
| Full Report quota | Unchanged (1/day) |
| Free tier | Deterministic coach only |
| Pro/Trial | AI-enhanced on click + consent |
| Groq trigger | Explicit user click only |

---

## Validation

Client-authoritative `validateLearningCoachResponse()` rejects:

- CEFR / mastery / fluency claims
- HTML / script content
- Invented pattern pairs
- Unsupported improvement claims
- Invalid actions (unknown targets/categories)
- Invented rule IDs

Backend performs basic JSON shape check only.

---

## Account isolation

- Quota stored at `flowlary.account.<id>.learning.coachQuota`
- In-flight AI discarded on account switch (`activeAccountContext.matches`)
- Cache keyed by `evidenceVersion:locale:mode:question`

---

## UI

**Location:** Overview panel — `LearningCoachCard` replaces `DailyBriefCard`

**Actions wired:**
- `practice_pattern` / `practice_focus` → `#practice`
- `view_progress` → `#progress`
- `open_report` → `#report`
- `keep_writing` → informational

Daily Brief API remains available; coach builds its own snapshot reads (no Brief quota consumption).

---

## Tests

| Suite | File | Count |
|-------|------|-------|
| Unit | `tests/unit/shared/learningCoach.test.ts` | 9 |
| Integration | `tests/integration/wl4f-learning-coach.test.ts` | 7 |

**Regression:** WL-4A, WL-4D, WL-4E, Full Report — pass

---

## Final verdict matrix

```
WL-4F STATUS: COMPLETE

FORENSIC AUDIT: PASS
COACH CONTEXT: PASS
EVIDENCE GROUNDING: PASS
AI OUTPUT VALIDATION: PASS
DETERMINISTIC FALLBACK: PASS
EXPLANATION INTEGRATION: PASS (via snapshot explanations)
PRACTICE INTEGRATION: PASS (action wiring)
DAILY BRIEF INTEGRATION: UNCHANGED
FULL REPORT INTEGRATION: UNCHANGED (open_report action)
ACCOUNT ISOLATION: PASS
PRIVACY: PASS
SECURITY: PASS
ENTITLEMENT: PASS
CREDIT SAFETY: PASS (0 credits)
CACHE ISOLATION: PASS
LOCALIZATION: PASS (en + ar overrides)
GROQ COST: 1 call per explicit AI interaction (Pro/Trial)
ADDITIONAL LEARNING ENGINE: ZERO

REGRESSION: PASS

TESTS: 16 new passed, 0 failed

P0: 0 | P1: 0 | P2: 2 | P3: 1
PRODUCTION BLOCKER: NO
NEXT PHASE: WEBSITE WRITING LAB / LAYOUT PRACTICE
```

**P2 follow-ups:** Practice deep-link from coach actions; inline trusted-rule expander on Overview.

**P3:** Dashboard tour step for coach card.
