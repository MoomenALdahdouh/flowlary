# WL-4C-B — CorrectionChange → Safe Explanation Adapter

**Date:** 2026-08-27  
**Baseline:** WL-4C-A complete  
**Mode:** Thin deterministic adapter — no UI, no Groq, no rule library

---

## Executive Summary

WL-4C-B adds a **pure adapter** that converts existing `CorrectionChange` objects into safe `RuleExplanation` objects using the WL-4C-A contract. The adapter is the translation boundary between correction output and the explanation domain model.

**Architecture achieved:**

```
CorrectionChange
      ↓
buildExplanationFromCorrectionChange()
      ↓
RuleExplanation
      ↓
(future WL-4C-C Rule Resolver)
      ↓
(future UI)
```

**Core guarantee:** The adapter never produces `trusted_rule` explanations, never assigns `HIGH` confidence, and never invents grammar rule names. Grammar corrections remain conservative; layout stays separate from English learning.

**Result:** 15 new focused tests pass. Full regression suite (147 tests) passes. Correction, Learning, Practice, UI, Groq, storage, and account isolation remain unchanged.

---

## Forensic Findings

### Files inspected

| Path | Finding |
|---|---|
| `packages/shared/src/correction/index.ts` | `CorrectionChange` has `type`, `original`, `corrected`, `start`, `end` only |
| `packages/shared/src/explanation/index.ts` | WL-4C-A factories and invariants ready for reuse |
| `packages/shared/src/explanation/fromCorrectionChange.ts` | Did not exist — new adapter added |
| `packages/shared/src/learningEvents.ts` | `normalizeLearningText()` used for practice target validation |
| `packages/shared/src/practice.ts` | `practiceTargetPatternId()` = `{category}:{normalizedOriginal}` |
| `extension/src/features/correction/` | No explanation wiring (unchanged) |
| `extension/src/features/learning/` | No explanation events (unchanged) |
| `extension/src/storage/learning/` | WL-4B targeting unchanged |
| `extension/src/background/` | No explanation handlers (unchanged) |

### Audit vs code

| Claim | Code truth | Action |
|---|---|---|
| WL-4C-A contract exists | Confirmed in `explanation/index.ts` | Reused |
| No existing adapter | Confirmed via grep | New file added |
| Categories 1:1 with ChangeType | Confirmed | Direct mapping |
| Practice ID = `category:normalizedOriginal` | Matches WL-4B | Validated via `isValidPracticeTargetId()` |
| No Explain UI | Confirmed | No UI added |

No discrepancies requiring scope expansion.

---

## Current CorrectionChange Contract

```typescript
type CorrectionChange = {
  type: ChangeType          // spelling | grammar | wording | layout
  original: string
  corrected: string
  start: number
  end: number
}
```

**Unchanged.** The adapter reads `type`, `original`, and `corrected` only. `start`/`end` are ignored — no sentence reconstruction, no storage lookups.

---

## WL-4C-A Contract Reused

| Symbol | Usage |
|---|---|
| `createPairExplanation()` | Spelling, wording, layout, non-ambiguous grammar |
| `createUncertainExplanation()` | Ambiguous grammar (confidence would be `uncertain`) |
| `buildExplanationConfidence()` | Routing grammar to pair vs fallback |
| `isValidPracticeTargetId()` | Optional practice target validation |
| `assertRuleExplanationInvariants()` | Every output satisfies invariants |

**Not used:** `createTrustedRuleExplanation()` — reserved for WL-4C-C.

---

## Adapter Architecture

**Location:** `packages/shared/src/explanation/fromCorrectionChange.ts`  
**Export:** Re-exported from `packages/shared/src/explanation/index.ts`

```typescript
type ExplanationBuildOptions = {
  practiceTargetId?: string
}

function buildExplanationFromCorrectionChange(
  change: CorrectionChange,
  options?: ExplanationBuildOptions,
): RuleExplanation
```

**Properties:**
- Pure, deterministic, zero network/storage/provider dependencies
- Account-agnostic
- Throws on malformed input (does not fabricate data)

### Decision flow

```
validate CorrectionChange
      ↓
map type → ExplanationCategory (1:1)
      ↓
reject layout + practiceTargetId
      ↓
validate optional practiceTargetId
      ↓
grammar + pairConfidence === 'uncertain'?
   yes → createUncertainExplanation (source: fallback)
   no  → createPairExplanation (source: pair)
```

---

## Category Mapping

| CorrectionChange.type | ExplanationCategory |
|---|---|
| spelling | spelling |
| grammar | grammar |
| wording | wording |
| layout | layout |

No other categories permitted. Invalid `type` throws `invalid_correction_category`.

---

## Confidence Behavior

Reuses `buildExplanationConfidence()` from WL-4C-A — no second algorithm.

| Category | Typical source | Confidence |
|---|---|---|
| spelling | pair | medium |
| wording | pair | medium |
| layout | pair | medium |
| grammar (ambiguous token) | fallback | uncertain |
| grammar (longer token) | pair | low |

**Never:** `pair` + `high`, `grammar` + `high`, or any `trusted_rule` from this adapter.

---

## Grammar Safety

The adapter does **not** inspect text for subject-verb agreement, tense, articles, prepositions, or any grammar rule.

| Input | Output summary (conceptual) | ruleId |
|---|---|---|
| go → goes | "A grammar correction changed 'go' to 'goes'." | none |
| get → got | "…could not be identified confidently." | none |
| He go → He goes | Uses pair `go`/`goes` only if change spans that token | none |

**Impossible from this adapter:** "Subject–Verb Agreement" or any named grammar rule.

---

## Layout Boundary

Layout corrections:
- Category remains `layout`
- Summary uses **"keyboard input"** language
- `practiceTargetId` is **rejected** if provided (`layout_practice_target_not_allowed`)
- Never framed as English grammar learning

---

## Practice Target Integration

Optional `practiceTargetId` in `ExplanationBuildOptions`:
- Validated via existing `isValidPracticeTargetId(category, original)`
- Format: `{category}:{normalizedOriginal}` (WL-4B identity)
- Omitted by default when no options provided
- Never derived from corrected text
- Never attached to layout corrections

---

## Validation

Input validation (throws):
- `invalid_correction_change` — null/non-object
- `invalid_correction_category` — unknown type
- `invalid_correction_pair` — empty or identical original/corrected
- `invalid_practice_target_id` — mismatched WL-4B identity
- `layout_practice_target_not_allowed` — layout + practice link

Output validation: all factories call `assertRuleExplanationInvariants()` internally.

---

## Tests

**File:** `tests/unit/shared/explanation-from-correction.test.ts`

| Test | Result |
|---|---|
| TEST 1: spelling recieved → received | PASS |
| TEST 2: wording make a photo → take a photo | PASS |
| TEST 3: grammar go → goes (no named rule) | PASS |
| TEST 4: ambiguous grammar get → got | PASS |
| TEST 5: layout keyboard terminology | PASS |
| TEST 6: valid WL-4B practice target preserved | PASS |
| TEST 7: no practice target without options | PASS |
| TEST 8: never generates trusted_rule | PASS |
| TEST 9: no HIGH pair confidence | PASS |
| TEST 10: deterministic identical output | PASS |
| TEST 11: no surrounding context dependency | PASS |
| TEST 12: malformed input rejected | PASS |
| Invariant: never trusted_rule | PASS |
| Invariant: never HIGH | PASS |
| Invariant: layout not English grammar | PASS |

**Totals:**
- Shared package: 62 passed
- Extension regression suite: 147 passed
- 0 failed

---

## Files Changed

| File | Change |
|---|---|
| `packages/shared/src/explanation/fromCorrectionChange.ts` | **New** — adapter + options type |
| `packages/shared/src/explanation/index.ts` | Re-export adapter |
| `tests/unit/shared/explanation-from-correction.test.ts` | **New** — 15 tests |
| `docs/audit/WL4C_B_CORRECTION_EXPLANATION_ADAPTER.md` | **New** — this report |

---

## Files Intentionally Untouched

- `CorrectionChange`, `CORRECTION_SYSTEM_PROMPT`, correction provider, Groq/gateway
- `LearningEvent`, `recordCorrectionLearning()`, `recordLayoutLearning()`
- Progress, practice targeting, exercise generation, recommendation engines
- All UI (CorrectionCard, PracticePanel, dashboard, popup)
- Extension storage, account isolation, history, telemetry
- WL-4C-A factory logic (reused, not modified)

---

## Groq Impact

**0 calls.** No provider, prompt, or gateway changes.

---

## Privacy Impact

**None.** Adapter produces in-memory domain objects only. No persistence, telemetry, history, or LearningEvent additions.

---

## Account Isolation

**Unchanged.** Adapter has no accountId, storage, or cache. Account scoping remains in surrounding request/UI layers.

---

## Known Limitations

1. **No rule resolution** — grammar explanations are pair-level or uncertain only.
2. **No sentence context** — uses change pair only; cannot explain multi-token grammar patterns beyond what `original`/`corrected` contain.
3. **No auto practice target** — caller must pass `practiceTargetId` explicitly; adapter does not derive it from change alone.
4. **No UI wiring** — adapter exists but is not connected to CorrectionCard or dashboard.
5. **No localization** — summaries are English-only; WL-4C-F handles optional Groq localization.

---

## WL-4C-C Readiness

**Safe to start WL-4C-C.**

WL-4C-C can add a trusted rule library and a resolver that either:
- Returns `createTrustedRuleExplanation()` when deterministic evidence matches, or
- Falls back to `buildExplanationFromCorrectionChange()` when no trusted match exists

The adapter remains the safe default path. WL-4C-C should not modify this adapter — it should wrap or supersede it only when trusted evidence is available.

---

## Final Verdict

```
WL-4C-B STATUS:
COMPLETE

CORRECTION ADAPTER:
PASS

PAIR EXPLANATION:
PASS

GRAMMAR SAFETY:
PASS

SPELLING:
PASS

WORDING:
PASS

LAYOUT:
PASS

PRACTICE LINK:
PASS

TRUSTED RULE GENERATION:
MUST BE NO

GROQ:
0 CALLS

UI:
UNCHANGED

LEARNING:
UNCHANGED

HISTORY:
UNCHANGED

STORAGE:
UNCHANGED

ACCOUNT ISOLATION:
UNCHANGED

TESTS:
147 passed (15 adapter + 10 WL-4C-A + 122 regression)
0 failed

P0:
0

P1:
0

P2:
0

P3:
Adapter does not auto-derive practiceTargetId from change; callers must pass it when known.

PRODUCTION BLOCKER:
NO (domain adapter only — no user-facing feature yet)

NEXT PHASE:
WL-4C-C
```
