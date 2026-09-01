# WL-4A — Practice Correctness Hardening

**Date:** 2026-08-27  
**Baseline:** WL-4 forensic audit complete (`docs/audit/WL4_PRACTICE_FORENSIC_AUDIT.md`)  
**Mode:** Hardening only — no WL-4B, no scoring, no layout practice

---

## Executive Summary

WL-4A hardened the existing Practice system against correctness, account, credit, and commercial UX boundary issues identified in the WL-4 audit. No recommendation engine, learning engine, or prompt architecture was rewritten.

**Key outcomes:**
- Practice UI now reflects backend entitlement truth (credits, consent, sign-in)
- Session start blocked when AI correction is unavailable (0 credits, no consent)
- Stale correction responses discarded via check-key guards + AbortController
- Failed checks roll back inflated attempt metrics
- Double submit guarded with ref + disabled buttons
- Cached correction responses now verify account snapshot before return
- Commercial copy corrected: Free users with credits can practice; Pro = higher limits

**Session resume:** Explicitly **NOT REQUIRED** — reload losing in-memory React state does not cause data integrity issues (no orphaned sessions, no duplicate credits/events). Documented as product limitation; safe abandon on exit remains.

---

## Git Baseline

| Field | Value |
|-------|-------|
| Branch | `main` |
| Commit | `61f349827f111231dd8ebdac1c557478dcb10cb8` |
| Unrelated user modifications | Preserved (not reverted) |

---

## Issues Confirmed (Fixed)

| Finding | Actual Bug? | Priority | Fix | Test |
|---------|-------------|----------|-----|------|
| Generic error on credit exhaustion | Yes (UX) | P2 | Specific `usage_exhausted` message + block session start | `practiceAvailability.test.ts`, WL-4A integration |
| Free/Pro teaser implied Pro-only Practice | Yes (UX) | P2 | Updated i18n; credit notice; start disabled when blocked | `practiceAvailability.test.ts` |
| Failed check inflated `itemsAttempted` | Yes | P2 | Rollback metrics on error/abort | PracticePanel guards (behavioral) |
| Stale correction could apply to wrong item | Yes | P2 | `activeCheckRef` + `isActivePracticeCheck` | `practiceAvailability.test.ts` |
| Double check race | Partial | P2 | `checkingHeldRef` + disabled button | `practiceAvailability.test.ts` |
| Cached correction skipped account check | Yes | P1 | Account snapshot verify on cache hit | WL-4A integration + `correct.ts` |
| Account switch mid-flight could succeed | Yes | P1 | Existing network guard + cache guard | WL-4A integration |

---

## Issues Reclassified as Enhancements (Not Fixed)

| Finding | Reason |
|---------|--------|
| Generic prompts / error-specific drills | WL-4B scope |
| Session resume after reload | Product limitation — no integrity bug |
| Personalization in PracticePanel | WL-4C / P3 |
| Accuracy scoring | WL-4D |
| Mixed headline errorCount | Product decision — documented for WL-4D |
| Per-change accept/reject | Phase 22D deferred design |

---

## Account Switch Safety

| Requirement | Status | Evidence |
|-------------|--------|----------|
| A request cannot write to B | PASS | `activeAccountContext.matches` in `handleCorrectText` |
| A learning event cannot write under B | PASS | Write guard + generation bump on `attachActiveAccount` |
| A session cannot save under B | PASS | Account-scoped `PracticeSessionStore` |
| B cannot see A's session | PASS | WL-4A integration test |
| Stale response cannot overwrite B UI | PASS | PracticePanel `isActivePracticeCheck` |
| No B credit charge on A stale response | PASS | `account_changed` before cache write |
| Cache cannot satisfy wrong account | PASS | Cache key includes `accountId`; snapshot check on hit |

---

## Stale Request Safety

- `AbortController` aborted on item advance / exit
- `activeCheckRef` tracks `{ sessionId, itemIndex }`
- Late responses ignored when key mismatch or aborted
- **FILE:** `PracticePanel.tsx`, `practiceAvailability.ts`

---

## Double Submission Safety

- `checkingHeldRef` prevents concurrent check requests
- `actionRecordedRef` / `detectedRecordedRef` preserved
- Buttons disabled while `checking === true`
- Dedupe on learning events unchanged (`batchId:category:normalizedOriginal:action`)

---

## Credit Exhaustion

**Policy (unchanged backend):** Practice requires `practice.basic` or `practice.full` + `ai.correction` + credits > 0.

**UX fix (Option A):** Session start disabled when correction unavailable. Credit notice shown when available. Specific error messages on check failure.

---

## Free/Pro Commercial UX

| Before | After |
|--------|-------|
| "Trial and Pro unlock full sessions" teaser | "Practice uses daily AI credits; Pro has higher limits" |
| Start buttons enabled at 0 credits | Start disabled when `usage_exhausted` |
| Generic correction error | Specific messages for credits, account change, rate limit, network |

Backend unchanged — UI matches enforced policy.

---

## Session Reload Decision

**SESSION RESUME: NOT REQUIRED**

Reload loses React in-memory session state. This does not cause:
- Orphaned persisted sessions (only completed sessions saved)
- Duplicate learning events
- Duplicate credits (no in-flight request survives reload)
- Incorrect progress (partial sessions not persisted)

Exit confirms safe abandon. Product limitation documented.

---

## Completion Safety

- `finishingRef` prevents duplicate `finishSession` calls
- Exactly 5 items via `PRACTICE_ITEMS_PER_SESSION`
- Zero-change items auto-advance without learning events
- Exit does not show "completed" state

---

## Zero-Change Behavior

Preserved: zero corrections → advance item, no detected/accepted/rejected events.

---

## Error Handling

| Error | UI | Learning event | Metrics |
|-------|-----|----------------|---------|
| `usage_exhausted` | Specific message | None | Rolled back |
| `account_changed` | Specific message | None | Rolled back |
| `rate_limited` | Specific message | None | Rolled back |
| `consent_required` | Specific message | None | Rolled back |
| `network` | Specific message | None | Rolled back |
| `aborted` | Silent | None | Rolled back |

---

## Learning Event Safety

Unchanged schema and dedupe. Guards ensure events only recorded on successful active check with corrections.

---

## Progress Safety

No formula changes. Mixed `errorCount` documented for future WL-4D.

---

## Layout Boundary

Preserved — no changes. WL-4A integration verifies layout excluded from recommendation.

---

## Privacy & Security

- No new persistent answer storage
- Account snapshot checks on cache + network paths
- Write guards preserved
- Client cannot inject account scope

---

## Cost

No additional Groq calls introduced. Max ~5 checks/session unchanged.

---

## Tests Added

| File | Count | Coverage |
|------|-------|----------|
| `tests/unit/dashboard/practiceAvailability.test.ts` | 6 | Availability, stale key, double guards, error mapping |
| `tests/integration/wl4a-practice-hardening.test.ts` | 10 | Credits, account switch, cache, dedupe, layout, sessions |

---

## Regression Results

**121 tests passed, 0 failed**

Includes: WL-1, WL-2, WL-3, Phase 3B/3D/22C/22D/32A, practice-recommendation, personalization, phase12-cache, WL-4A.

---

## Files Modified

| File | Change |
|------|--------|
| `extension/src/dashboard/panels/PracticePanel.tsx` | Guards, availability, error UX, metrics rollback |
| `extension/src/dashboard/panels/practiceAvailability.ts` | **NEW** — availability + check guards |
| `extension/src/dashboard/App.tsx` | Pass `status` to PracticePanel |
| `extension/src/background/correct.ts` | Account snapshot check on cache hit |
| `extension/src/popup/i18n/en.ts` | Accurate commercial + error strings |
| `tests/unit/dashboard/practiceAvailability.test.ts` | **NEW** |
| `tests/integration/wl4a-practice-hardening.test.ts` | **NEW** |

---

## Files Intentionally Untouched

- `computePracticeRecommendation`, `resolvePracticeFocus`
- `PracticeSessionStore`, `recordPractice*`
- Learning/progress/personalization engines
- Prompt pools (`prompts.ts`)
- Providers, gateway, translation

---

## Remaining P2/P3 (Future)

| Item | Phase |
|------|-------|
| Error-specific prompts | WL-4B |
| Session resume | Enhancement |
| Personalization in Practice UI | WL-4C |
| Accuracy scoring | WL-4D |
| Writing-only headline metrics | WL-4D |

---

## WL-4B Readiness

**YES** — correctness foundations stable; prompt/error-specific work can proceed without revisiting guards.

---

## Final Verdict

```
WL-4A STATUS:
COMPLETE

PRACTICE:
FUNCTIONAL

ACCOUNT SWITCH:
PASS

STALE SAFETY:
PASS

DOUBLE SUBMISSION:
PASS

CREDIT SAFETY:
PASS

FREE/PRO UX:
PASS

SESSION STATE:
PASS

COMPLETION:
PASS

LEARNING EVENTS:
PASS

PROGRESS:
PASS

LAYOUT EXCLUSION:
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
2

P3:
4

PRODUCTION BLOCKER:
NO

WL-4B READY:
YES

NEXT PHASE:
WL-4B
```
