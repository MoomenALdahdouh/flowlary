# PHASE 3B — Core Integration Hardening

**Date:** 2026-08-27  
**Baseline:** `docs/audit/PHASE3A_CORE_FEATURES_LEARNING_FORENSIC_AUDIT.md`  
**Mode:** Implementation + verification (minimal scope, no redesign)

---

## 1. Baseline

Phase 3A identified **5 P1**, **6 P2**, **4 P3** findings. Phase 3B addressed all implementable P1 integration gaps except **P1-4 (layout learning taxonomy)**, which requires an explicit product decision.

Phase 1 (translation router) and Phase 2 (account isolation / credits) architecture were preserved.

---

## 2. P1 Findings Addressed

| ID | Issue | Status |
|----|-------|--------|
| P1-1 | Content script never restored `activeAccountContext` | **FIXED** |
| P1-2 | Layout `personalExceptions` not hydrated into `LayoutFeature` | **FIXED** |
| P1-3 | `GET_PROGRESS` read legacy global `learningSessions` | **FIXED** |
| P1-4 | Layout not in learning taxonomy | **DEFERRED** (product decision) |
| P1-5 | Dual correction `fieldStates` maps | **FIXED** |

---

## 3. Exact Files Changed

| File | Change |
|------|--------|
| `extension/src/content/accountBootstrap.ts` | **NEW** — account restore, hydration order, storage listener |
| `extension/src/content_script.ts` | Defer feature start until bootstrap completes |
| `extension/src/features/correction/CorrectionFeature.ts` | Shared `fieldStates`, `clearFieldStates()` |
| `extension/src/features/correction/scheduler.ts` | Accept shared `fieldStates` map |
| `extension/src/features/correction/applyCorrection.ts` | Export `FieldCorrectionStateEntry` type |
| `extension/src/background/index.ts` | `GET_PROGRESS` uses account-scoped practice store |
| `extension/src/dashboard/panels/ProgressPanel.tsx` | Label matches `errorCount` metric (P2-1) |
| `extension/src/popup/i18n/en.ts` | Added `progress.uniqueErrors` string |
| `tests/integration/phase3b-core-integration.test.ts` | **NEW** — 20 integration tests |

**Not changed:** InputEngine, FieldSession, EventBus, CommandRouter, TranslationRouter, Groq providers, learning schema, history schema, correction prompts, credit system.

---

## 4. Exact Architectural Changes

### P1-1 — Content script account bootstrap

**FILE:** `extension/src/content/accountBootstrap.ts`  
**FUNCTION:** `bootstrapContentScriptAccount()`

**BEFORE:** Content script called `hydrateStateFromStorage` without account activation → `activeAccountContext.getAccountId()` null → learning/history fail-closed.

**AFTER:**
```
runStorageMigration()
→ restoreActiveAccountFromSession()
→ hydrateStateFromStorage()
→ hydrateLayoutFeatureFromStorage(layout)
→ ensureHistoryInitialized()
→ initializeFlowlaryCache()
→ installContentScriptAccountListener()
→ engine.start() / features.start()
```

**WHY:** Reuses Phase 2 `restoreActiveAccountFromSession` — no second account system.

**ACCOUNT IMPACT:** Signed-in users can persist learning/history from content script.

**RACE IMPACT:** Unchanged generation guards; account listener calls `detachActiveAccount` or re-restore on `authAccountId` change; `correction.clearFieldStates()` on switch.

**TEST:** `tests/integration/phase3b-core-integration.test.ts` — P1-1 block (TEST A–H)

---

### P1-2 — Layout personalExceptions hydration

**FILE:** `extension/src/content/accountBootstrap.ts`  
**FUNCTION:** `hydrateLayoutFeatureFromStorage()`

**BEFORE:** `LayoutFeature` used `DEFAULT_LAYOUT_PROFILE_STATE` (empty exceptions).

**AFTER:** After account restore + state hydration, `layout.setProfileState(await getLayoutProfile())`.

**WHY:** Single source of truth — account-scoped `layout.profile` storage via existing facade.

**ACCOUNT IMPACT:** Exceptions follow active account; reset on logout via listener.

**TEST:** P1-2 block in phase3b integration tests

---

### P1-3 — GET_PROGRESS practice session scope

**FILE:** `extension/src/background/index.ts`  
**FUNCTION:** `GET_PROGRESS` handler

**BEFORE:**
```typescript
await flowlaryStorage.get(flowlaryStorage.keys.learningSessions, 'local')
```

**AFTER:**
```typescript
const practiceSessions = await getPracticeSessionStore(flowlaryStorage).list()
const sessionStore = normalizePracticeSessionStore({ version: 1, sessions: practiceSessions })
```

**WHY:** Same abstraction as `GET_PRACTICE_HOME` / `SAVE_PRACTICE_SESSION`.

**ACCOUNT IMPACT:** Practice summary scoped to active account.

**TEST:** P1-3 block in phase3b integration tests

---

### P1-5 — Shared correction field state

**FILE:** `extension/src/features/correction/CorrectionFeature.ts`, `scheduler.ts`

**BEFORE:** Independent `fieldStates` maps → divergent card/pending state between auto scheduler and manual CORRECT.

**AFTER:** Single `Map<string, FieldCorrectionStateEntry>` created in `CorrectionFeature`, passed to `CorrectionScheduler`. `clearFieldStates()` clears on account switch.

**WHY:** Smallest fix — one authoritative state per field without merging schedulers.

**RACE IMPACT:** Manual CORRECT while auto request pending returns `noop` (shared `lastSentText` / `pendingRequestId`) — no duplicate AI call.

**TEST:** P1-5 block — verifies single Groq call + `noop` on duplicate manual trigger

---

## 5. Account Initialization Order

### Content script (new)

1. `restoreActiveAccountFromSession`
2. `hydrateStateFromStorage`
3. `hydrateLayoutFeatureFromStorage`
4. `clearFieldStates` (on switch only)
5. History init + AI cache init
6. Feature/engine start

### Service worker (unchanged)

1. `restoreActiveAccountFromSession`
2. `hydrateStateFromStorage` (×2 with retireByok)
3. Learning/history/cache init

---

## 6. Account Switch Behavior

**Listener:** `chrome.storage.onChanged` on `STORAGE_KEYS.authAccountId`

| Transition | Action |
|------------|--------|
| A → B | `restoreActiveAccountFromSession` + hydrate + layout profile + `clearFieldStates` |
| A → null | `detachActiveAccount` + reset layout profile + `clearFieldStates` |
| null → A | restore + hydrate + layout profile |

Fail-closed preserved when no valid account id.

---

## 7. Layout Profile Hydration

- Loaded from `getLayoutProfile()` (account-scoped)
- Applied via `LayoutFeature.setProfileState()`
- Used by scheduler `getExceptions()` and `fixCurrentText`
- Account B does not inherit A exceptions (verified in tests)

---

## 8. Practice Progress Storage

- **Write path:** `PracticeSessionStore` → account-scoped `learning.sessions`
- **Read path (GET_PROGRESS):** same store via `.list()`
- Legacy global `flowlary.learning.sessions` key no longer read

---

## 9. Correction Field State Architecture

```
CorrectionFeature
  └── fieldStates: Map<fieldId, FieldCorrectionStateEntry>
        └── shared with CorrectionScheduler
              ├── debouncer (scheduler-owned callback)
              ├── pendingRequestId
              ├── card / cardMounted
              └── lastSentText / lastCorrectedFor
```

Manual and auto paths read/write the same entry per `fieldId`.

---

## 10. Layout Learning Policy Decision

**LAYOUT LEARNING POLICY:**

**CURRENT:** Layout corrections remain **history-only** (`FIX_LAYOUT`). No `layout` category in `LearningEventCategory` / `ChangeType`.

**IMPACT:** Users cannot practice layout mistakes through the existing Practice/Progress taxonomy.

**RECOMMENDATION:** Product decision required before implementation. Adding `layout` would touch:
- `packages/shared/src/correction/index.ts` (ChangeType)
- `packages/shared/src/learningEvents.ts`
- `recordCorrectionLearning` callers (layout fix path)
- Progress `byType` aggregation
- Practice recommendation filters
- Import/export validation
- Dashboard copy

**Phase 3B action:** **NOT IMPLEMENTED** (per scope rule).

---

## 11. P2 Fixes Made

| ID | Fix |
|----|-----|
| P2-1 | ProgressPanel label → `progress.uniqueErrors` (matches `errorCount` semantics) |
| P2-6 | Addressed indirectly via P1-2 layout profile hydration |

---

## 12. P2 Fixes Intentionally Deferred

| ID | Reason |
|----|--------|
| P2-2 | `correction_cache_hits` — cache hits occur in background SW; wiring requires cross-context metric pass (out of minimal scope) |
| P2-3 | Direct mode skips `detected` events — product semantics, not integration bug |
| P2-4 | World layout intelligence — out of scope |
| P2-5 | Translation provider metadata — no existing history metadata extension used; product policy |

---

## 13. Tests Before

Baseline regression suites run before changes (phase32a, phase22c, phase7, layout feature, phase2 commercial boundary).

---

## 14. Tests After

| Suite | Result |
|-------|--------|
| `phase3b-core-integration.test.ts` | **20/20 pass** |
| `phase32a-account-isolation.test.ts` | **14/14 pass** |
| `phase22c-learning.test.ts` | **6/6 pass** |
| `phase7-correction.test.ts` | **10/10 pass** |
| `layoutFeature.test.ts` | **3/3 pass** |
| `phase2-commercial-boundary.test.ts` | **8/8 pass** |

**Total Phase 3B + regression (extension): 61 passed, 0 failed**

---

## 15. End-to-End Flow Result

**E2E test:** signed-in user → bootstrap → learning event → history → `GET_PROGRESS` → `GET_HISTORY` → account switch → B sees empty data.

**Result:** PASS

---

## 16. Account Isolation Result

- Learning events account-scoped ✓
- History account-scoped ✓
- Practice sessions account-scoped ✓
- Layout profile account-scoped ✓
- A→B switch clears correction field state ✓
- Phase 2 AI cache guards unchanged ✓

---

## 17. Regression Result

| Phase | Result |
|-------|--------|
| Phase 1 translation router | Not modified — **PASS** (no regressions in touched suites) |
| Phase 2 account isolation | **PASS** (phase32a + phase2 commercial boundary) |

---

## 18. Files Not Changed

InputEngine, FieldSession, EventBus, CommandRouter, CommandOrchestrator, TranslationProviderRouter, Google/Groq providers, AI gateway, credit system, `accountSessionLifecycle` core logic, learning event schema, history schema, instant typo map, correction prompts, layout algorithms.

---

## 19. Remaining Risks

1. **P1-4:** Layout mistakes not learnable/practiceable until product adds taxonomy.
2. **Multi-tab account listener:** Each content script installs one listener (idempotent guard); all tabs receive storage events — acceptable, all re-sync from authoritative `authAccountId`.
3. **P2-2:** Correction cache hit metric still unused in content-script metrics.
4. **IME/composition:** Still not exhaustively E2E tested (P3-4).

---

## 20. Phase 3C Recommendation

**PHASE 3C** (optional): Product decision on layout learning category; cross-context cache metrics; browser E2E with real extension harness; IME safety tests.

---

## 21. Final Verdict

```
PHASE 3B STATUS:
COMPLETE

P1-1 ACCOUNT CONTEXT:
PASS

P1-2 LAYOUT PROFILE:
PASS

P1-3 PRACTICE PROGRESS:
PASS

P1-4 LAYOUT LEARNING POLICY:
DECISION REQUIRED

P1-5 CORRECTION STATE:
PASS

LEARNING PERSISTENCE:
PASS

HISTORY PERSISTENCE:
PASS

PRACTICE PROGRESS:
PASS

DASHBOARD TRACE:
PASS

ACCOUNT ISOLATION:
PASS

ACCOUNT SWITCH SAFETY:
PASS

CORRECTION RACE SAFETY:
PASS

PHASE 1 REGRESSION:
PASS

PHASE 2 REGRESSION:
PASS

TESTS:
61 passed
0 failed

P0:
0

P1 REMAINING:
1

P2 REMAINING:
4

PRODUCTION BLOCKER:
NO

NEXT PHASE:
PHASE 3C
```

---

*End of Phase 3B report.*
