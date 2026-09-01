# WL-4C-A — Explanation Contract + Confidence Model Implementation

**Date:** 2026-08-27  
**Baseline:** WL-4B complete; WL-4C forensic audit complete  
**Mode:** Minimal shared-domain foundation — no UI, no Groq, no rule library

---

## Executive Summary

WL-4C-A establishes a **type-safe, deterministic explanation contract** in `@flowlary/shared` that future WL-4C phases can build on. The contract supports pair-level explanations, uncertain fallbacks, and declarative trusted-rule references — without resolving grammar rules, calling Groq, or touching correction/learning pipelines.

**Core guarantee:** No explanation object may claim a named grammar rule unless created through `createTrustedRuleExplanation()` with an explicit `TrustedRuleReference`. Pair-level explanations never receive `HIGH` confidence and never carry `ruleId` / `ruleTitle`.

**Result:** Pure domain infrastructure only. Correction, Learning, Practice, UI, and Groq remain unchanged.

---

## Files Inspected

| Path | Purpose |
|---|---|
| `docs/audit/WL4C_LEARNING_FEEDBACK_RULE_EXPLANATION_FORENSIC_AUDIT.md` | Authoritative WL-4C audit |
| `docs/audit/WL4B_ERROR_SPECIFIC_PRACTICE_IMPLEMENTATION.md` | WL-4B practice target identity |
| `packages/shared/src/correction/index.ts` | `CorrectionChange`, `ChangeType`, validation pattern |
| `packages/shared/src/learningEvents.ts` | `LearningEventCategory`, `normalizeLearningText()` |
| `packages/shared/src/learning.ts` | Learning metrics (unchanged) |
| `packages/shared/src/practice.ts` | `practiceTargetPatternId()`, WL-4B identity |
| `packages/shared/src/index.ts` | Shared export conventions |
| `packages/shared/vitest.config.ts` | Shared test layout |
| `extension/src/storage/learning/` | Learning storage (no explanation code) |
| `extension/src/features/correction/` | Correction pipeline (unchanged) |
| `extension/src/features/learning/` | Learning recorders (unchanged) |
| `extension/src/dashboard/` | Dashboard panels (no Explain UI) |
| `extension/src/background/` | Background handlers (unchanged) |
| `tests/unit/shared/*.test.ts` | Shared unit test conventions |
| `tests/unit/storage/practice-*.test.ts` | WL-4B regression baseline |

**Grep for existing explanation contract:** No `RuleExplanation`, `ExplanationConfidence`, or explanation module existed prior to WL-4C-A.

---

## Current Architecture Verified

### Correction payload (unchanged)

```typescript
type CorrectionChange = {
  type: ChangeType          // spelling | grammar | wording | layout
  original: string
  corrected: string
  start: number
  end: number
}
```

No `ruleId`, `subtype`, `confidence`, or explanation metadata.

### LearningEvent (unchanged)

Persists pair + `normalizedOriginal` + hash. No explanation fields added.

### Practice target identity (WL-4B, reused)

`practiceTargetPatternId()` → `{category}:{normalizedOriginal}`  
Validation uses existing `normalizeLearningText()` from `learningEvents.ts`.

### Validation conventions

Shared package uses **manual runtime guards** (`validateCorrectionResponse`, `isLearningEventCategory`) — **not Zod**. WL-4C-A follows the same pattern with `assertRuleExplanationInvariants()` and `validateRuleExplanation()`.

### Audit vs code

| Audit claim | Code truth | Action |
|---|---|---|
| No explanation contract exists | Confirmed | New module added |
| Categories: spelling/grammar/wording/layout | Matches `ChangeType` / `LearningEventCategory` | Reused as `ExplanationCategory` |
| No Explain UI | Confirmed | No UI added |
| Practice ID = `category:normalizedOriginal` | Matches `practiceTargetPatternId()` | Reused via `isValidPracticeTargetId()` |

No discrepancies requiring architecture changes.

---

## New Contract

**Location:** `packages/shared/src/explanation/index.ts`  
**Export:** `packages/shared/src/index.ts`

```typescript
type ExplanationConfidence = 'high' | 'medium' | 'low' | 'uncertain'
type ExplanationSource = 'pair' | 'trusted_rule' | 'fallback'
type ExplanationCategory = 'spelling' | 'grammar' | 'wording' | 'layout'

type RuleExplanation = {
  confidence: ExplanationConfidence
  source: ExplanationSource
  category: ExplanationCategory
  ruleId?: string
  ruleTitle?: string
  summary: string
  why?: string
  incorrectExample: string
  correctExample: string
  practiceTargetId?: string
}

type TrustedRuleReference = {
  ruleId: string
  category: ExplanationCategory
  ruleVersion: string
}
```

**Properties:**
- Serializable plain objects
- No provider, UI, React, storage, or account fields
- No CEFR level, mastery claims, or assessment semantics

---

## Confidence Model

**Function:** `buildExplanationConfidence(input)`

| Source | Category | Confidence |
|---|---|---|
| `trusted_rule` | any | `high` (reserved for future resolver) |
| `fallback` | any | `uncertain` |
| `pair` | spelling, wording, layout | `medium` |
| `pair` | grammar (short/ambiguous token) | `uncertain` |
| `pair` | grammar (longer token) | `low` |

**Ambiguous grammar tokens** (deterministic set): `go`, `goes`, `get`, `got`, `do`, `does`, `be`, `is`, `are`, `was`, `were`, `a`, `an`, `the`, `to`, plus tokens with normalized length `< 3`.

**Examples verified in tests:**

| Pair | Category | Confidence | ruleId |
|---|---|---|---|
| recieved → received | spelling | medium | none |
| make a photo → take a photo | wording | medium | none |
| go → goes | grammar | uncertain | none |
| get → got | grammar | uncertain (fallback) | none |
| lvpfh → hello | layout | medium | none |

Grammar pairs **never** receive `HIGH`. Spelling/wording pairs **never** receive named rules.

---

## Safe Factory Functions

| Function | Source | ruleId | Confidence cap |
|---|---|---|---|
| `createPairExplanation()` | `pair` | never | never `high` |
| `createUncertainExplanation()` | `fallback` | never | `uncertain` |
| `createTrustedRuleExplanation()` | `trusted_rule` | required | `high` |

### Category-safe summary language

| Category | Summary pattern |
|---|---|
| spelling | `The spelling 'X' was corrected to 'Y'.` |
| wording | `The wording 'X' was changed to the more natural 'Y'.` |
| grammar | `A grammar correction changed 'X' to 'Y'.` |
| layout | `The keyboard input 'X' was corrected to 'Y'.` |

No judgment language. No invented rule names for pair explanations.

---

## Safety Invariants

Enforced by `assertRuleExplanationInvariants()`:

| Rule | Enforcement |
|---|---|
| RULE 1: ruleId only with trusted rule | `ruleId`/`ruleTitle` only when `source === 'trusted_rule'` |
| RULE 2: ruleTitle requires ruleId | Throws `rule_title_without_rule_id` |
| RULE 3: trusted rule → source trusted_rule | Required on create + validate |
| RULE 4: pair never pretends named rule | Pair source rejects ruleId/ruleTitle |
| RULE 5: uncertain without ruleId | `createUncertainExplanation()` has no ruleId |
| RULE 6: layout ≠ English grammar | Layout summaries use "keyboard input" |
| RULE 7: practiceTargetId optional | Not required for any factory |
| RULE 8: no mastery/failure claims | Neutral factual summaries only |
| RULE 9: no CEFR | Not in contract |
| RULE 10: no AI-as-trusted | Only `createTrustedRuleExplanation()` gets HIGH |

Additional: `pair` source cannot have `confidence === 'high'`.

---

## Tests

**File:** `tests/unit/shared/explanation.test.ts`

| Test | Result |
|---|---|
| TEST 1: spelling pair recieved → received | PASS |
| TEST 2: wording pair make a photo → take a photo | PASS |
| TEST 3: grammar pair go → goes (low/uncertain, no rule) | PASS |
| TEST 4: ambiguous grammar get → got | PASS |
| TEST 5: layout not English grammar | PASS |
| TEST 6: trusted rule contract (no real rule data) | PASS |
| TEST 7: trusted_rule without ruleId fails | PASS |
| TEST 8: ruleTitle without ruleId fails | PASS |
| TEST 9: WL-4B practiceTargetId preserved | PASS |
| TEST 10: empty/malformed values rejected | PASS |

**Shared package:** 47 passed (includes 10 new explanation tests)  
**Extension regression suite:** 122 passed, 0 failed

---

## Files Changed

| File | Change |
|---|---|
| `packages/shared/src/explanation/index.ts` | **New** — contract, confidence model, factories, validation |
| `packages/shared/src/index.ts` | Export explanation module |
| `tests/unit/shared/explanation.test.ts` | **New** — 10 focused unit tests |
| `docs/audit/WL4C_A_EXPLANATION_CONTRACT_IMPLEMENTATION.md` | **New** — this report |

---

## Files Intentionally Untouched

- `CorrectionChange`, `CORRECTION_SYSTEM_PROMPT`, `validateCorrectionResponse()`
- `LearningEvent` schema, `recordCorrectionLearning()`, `recordLayoutLearning()`
- `computeProgressMetrics()`, `computeRecurringPatterns()`, `computePracticeRecommendation()`
- `selectPracticeSessionTarget()`, `listPracticeRecurringTargets()`, practice exercise generation
- All UI: CorrectionCard, PracticePanel, ComposeWorkbench, ProgressPanel, popup, dashboard
- Groq provider, AI gateway, correction/translation providers, credits
- Extension storage, account isolation, telemetry

---

## Groq Impact

**0 calls.** No provider, prompt, or gateway changes.

---

## Privacy Impact

**None.** Explanation objects are pure in-memory domain data. No persistence, telemetry, history, or LearningEvent additions.

---

## Account Isolation Impact

**None.** No account ID in contract. No new storage or cache. Account scoping deferred to future request/UI layers.

---

## Known Limitations

1. **No resolver** — WL-4C-A does not map `CorrectionChange` → `RuleExplanation`; future WL-4C-B will wire this.
2. **No rule library** — `TrustedRuleReference` is declarative only; WL-4C-C owns actual rules.
3. **English-only summaries** — Localization deferred to WL-4C-F (optional Groq).
4. **Grammar confidence is conservative** — Most grammar pairs are `low` or `uncertain` by design.
5. **No UI** — Contract exists but is not surfaced to users yet.

---

## WL-4C-B Readiness

**Safe to start WL-4C-B.**

WL-4C-B can add a thin adapter that maps `CorrectionChange` + optional practice context → `createPairExplanation()` / `createUncertainExplanation()` without modifying correction or learning schemas. The contract enforces safety invariants at creation time.

Recommended WL-4C-B scope:
- `buildExplanationFromCorrectionChange(change, options?)` helper
- Optional `practiceTargetId` from existing `practiceTargetPatternId()` when normalized original is known
- Still no UI, no Groq, no rule library

---

## Final Verdict

```
WL-4C-A STATUS:
COMPLETE

EXPLANATION CONTRACT:
PASS

CONFIDENCE MODEL:
PASS

PAIR EXPLANATION:
PASS

TRUSTED RULE CONTRACT:
PASS

PRACTICE LINK:
PASS

GROQ COST:
0

UI:
UNCHANGED

LEARNING:
UNCHANGED

CORRECTION:
UNCHANGED

TESTS:
132 passed (10 explanation + 122 regression)
0 failed

P0:
0

P1:
0

P2:
Grammar pair confidence heuristics are intentionally conservative; future WL-4C-C resolver may supersede pair-level grammar confidence for matched rules only.

PRODUCTION BLOCKER:
NO (foundation only — no user-facing feature yet)

NEXT PHASE:
WL-4C-B
```
