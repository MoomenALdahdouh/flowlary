# PHASE 2 — Commercial Entitlements + Credits + Account Isolation

**Date:** 2026-08-27  
**Baseline:** `docs/audit/FLOWLARY_COMPLETE_ARCHITECTURE_AUDIT.md`  
**Phase 1:** `docs/audit/PHASE_TRANSLATION_PROVIDER_IMPLEMENTATION.md` (REAL API verified)  
**Mode:** Forensic audit + minimal hardening (no redesign)

---

## 1. Executive Summary

Phase 2 audited the live commercial boundary and hardened gaps without redesigning Phase 1 translation routing.

**Already correct (server):**

- JWT account identity is authoritative for plan / entitlement / credits.
- Client `X-Flowlary-Entitlement` / `plan` / `isPro` / `credits` body fields are **not** billing authority.
- Free Google translation is allowed at `usage_exhausted` when strategy ≠ pure Groq.
- Groq credits: reserve → finalize on success / release on failure (gateway-only callers).
- Backend translation cache is account + strategy keyed.
- Phase 32A account-scoped chrome.storage isolates history / learning / prefs.

**Fixed in Phase 2:**

1. UI no longer locks Google translation when Groq AI credits are 0 (`isAiCreditLocked` vs translation readiness).
2. Legacy `evaluateFeatureAccess` no longer denies Google translation solely via `usageBalanceMs = 0`.
3. Exhausted-usage UX copy explicitly keeps Google Translation available.
4. Extension AI cache keys include `accountId` (schema v3).
5. Account switch clears AI cache **and** resets translate/correct coalescers.
6. In-flight translate/correct responses refuse to write cache / succeed after account generation change.

**Remaining limitations (documented, not P0 blockers for declared criteria):**

- Content-script realm does not restore `activeAccountContext` (fail-closed for account data; prefs stay defaults).
- Multi-process horizontal scaling of in-memory credit reservations remains an ops concern (pre-existing).
- `authDisabled` / development auth bypass remains an ops misconfiguration risk (pre-existing).

---

## 2. Current Entitlement Architecture

```
USER
 → authenticateRequest (JWT | install | dev)
 → AccountRecord
 → resolveServerEntitlementForAccount
 → capabilitiesForPlan + credit windows
 → AuthContext.allowed / rateLimitTier / capabilities
 → AiGateway assert + canAccessTranslation + reserveManagedUsage
 → provider (Google / Groq / Google→Groq)
```

| Slot | Implementation |
|---|---|
| **ENTITLEMENT OWNER** | Server account + Paddle subscription map |
| **ENTITLEMENT RESOLVER** | `backend/src/services/accountService.ts` → `resolveServerEntitlementForAccount` |
| **SERVER ENFORCEMENT** | `backend/src/middleware/auth.ts`, `backend/src/gateway/index.ts`, `translationRouter.canAccessTranslation` |
| **CLIENT ENFORCEMENT** | UX/preflight only — `extension/src/entitlement/service.ts`, `popup/status.ts`, `ui/domainState.ts` |
| **STORAGE** | Server account row; client `authServerEntitlement` mirror (TTL ~5m) |
| **CACHE** | Client entitlement mirror; not security boundary |
| **REFRESH** | Account entitlement endpoint + periodic sync |
| **INVALIDATION** | Logout clears session entitlement cache |

---

## 3. Current Credit Architecture

| Symbol | File |
|---|---|
| `reserveManagedUsage` | `backend/src/services/accountService.ts` |
| `finalizeManagedUsageReservation` | same |
| `releaseManagedUsageReservation` | same |
| Callers | **Only** `AiGateway` correction / translation / layout-classification |

Weights: correction/layout ≈ 1; translation modes use shared credit weights.

**Invariants:**

| ID | Rule | Status |
|---|---|---|
| A | Google-only → no Groq reserve | HOLD |
| B | Groq start → reserve | HOLD |
| C | Groq success → finalize once | HOLD |
| D | Groq failure → release once | HOLD |
| E | No Groq → no reserve | HOLD |
| F | Double-billing under single process | HOLD (sync reserve map) |

---

## 4. Current Authentication / Account Architecture

- Install HMAC: AI **not** allowed (`allowed: false`, `account_required`).
- Account JWT: `sub` → account id; plan from server resolve.
- Dev / `authDisabled`: allow-all escape hatch — **ops risk**, not product path.

---

## 5. Current Local Storage Architecture

| State | Owner | Key pattern | Logout |
|---|---|---|---|
| Auth session | SESSION | `flowlary.auth.*` | Cleared |
| History / learning / prefs | ACCOUNT | `flowlary.account.<id>.*` | Detached (disk retained) |
| Device settings / theme | GLOBAL | `flowlary.settings`, theme | Kept |
| AI L1/L2 cache | TEMP | `flowlary.cache` + memory | Cleared on switch/logout |

Phase 32A write guards (`activeAccountContext.matches`) discard stale account-scoped writes.

---

## 6. Current Backend Authorization

AI routes take text/language/mode only. Account id comes from JWT. Client entitlement header is telemetry.

`canAccessTranslation`:

- allows when `auth.allowed`
- allows Google (non-`groq`) when `denyReason === 'usage_exhausted'`
- denies suspended / missing account

---

## 7. Current Cache Architecture

| Layer | Key | Account scoped? |
|---|---|---|
| Backend translation | `accountId\|strategy\|langs\|hash` | YES |
| Extension AI cache (v3) | `TRANSLATE\|CORRECT:<accountId>:…` | YES (Phase 2) |
| Strategy isolation | `google` vs `google_then_groq` | YES (Phase 1) |

---

## 8–9. Learning / History Ownership

Account-scoped storage + generation write guards (Phase 32A). Providers do not write learning events.

---

## 10. Free / Pro Matrix (as implemented)

| Capability | FREE | PRO / TRIAL |
|---|---|---|
| Keyboard Layout Correction | YES (local) | YES |
| Local typo map | YES | YES |
| Google Translation | YES (incl. credits=0) | YES |
| AI Correction | Limited by credits / caps | YES + credits |
| AI Translation Refinement | NO (strategy Google-only) | YES non-live (`google_then_groq`) |
| Learning / Correction / Translation history | YES (basic) | YES (+ full/export on Pro/Trial) |

**DOCUMENTATION / IMPLEMENTATION NOTE:** Trial ≈ Pro capabilities for the trial window (existing policy; not reinvented).

---

## 11. Trial System

- Duration: existing server trial clock on register (≈30 days in current constants).
- Authority: **server** (`trialEndsAt` / plan mutation on resolve).
- Client local trial blobs cannot unlock managed AI without JWT + server entitlement.

---

## 12. Credit Lifecycle

```
FEATURE → CAPABILITY → CREDIT CHECK → RESERVE → PROVIDER → SUCCESS→FINALIZE | FAILURE→RELEASE
```

Translation Google-only path never calls `tryReserveGroq`. Refinement path reserves only when eligible; on refine failure Google text is preserved and reservation released.

---

## 13–15. Account Isolation / Switching / Pending Requests

| Scenario | Result |
|---|---|
| A logout → B | Account namespaces isolated (Phase 32A tests) |
| AI cache after switch | Cleared + coalescers reset + accountId in keys |
| Pending A AI after switch to B | Snapshot mismatch → no cache write / `account_changed` |
| Content script prefs | Fail-closed / defaults (P1 product gap, not disk leak) |

---

## 16–17. Security / Privacy Findings

- No client plan/credits spoof path found for AI authorization.
- Logs use strategy/provider/latency/accountId — no credential / raw text logging added in Phase 2.
- Secrets remain backend-only (Phase 1 security still holds).

---

## 18–20. Issue Classes

### P0 (addressed)

1. UI locked Google translation at 0 Groq credits.
2. Shared AI cache / coalescer cross-account reseed race.
3. Legacy feature access denied translation on `usageBalanceMs=0`.

### P1 (documented)

1. Content-script account context not restored.
2. Multi-process credit reservation map.
3. Dev `authDisabled` uncapped AI if mis-set in production.

### P2

1. Soft UI copy inconsistencies elsewhere.
2. Telemetry `creditsCharged` may still record Google-only ops as usage events without debit (pre-existing telemetry skew).

---

## 21. Files Changed

- `extension/src/popup/status.ts` — `isAiCreditLocked`; translation not credit-locked
- `extension/src/ui/domainState.ts` — translation/live ignore AI credit lock
- `packages/shared/src/entitlement/index.ts` — Google not gated by legacy usage balance
- `packages/shared/src/usageUx.ts` — exhausted note includes Google Translation
- `packages/shared/src/cache.ts` — accountId in keys; schema v3
- `packages/shared/src/cache.test.ts` — isolation tests
- `extension/src/storage/cache/index.ts` — `resetAiRequestCoalescers`
- `extension/src/storage/accountSessionLifecycle.ts` — clear cache + reset coalescers on switch
- `extension/src/background/translate.ts` — account key + generation guard
- `extension/src/background/correct.ts` — account key + generation guard
- `tests/unit/phase2-commercial-boundary.test.ts` — Phase 2 boundary suite

## 22. Files Not Changed

- `InputEngine`, `FieldSession`, EventBus, CommandRouter/Orchestrator
- `translationRouter` strategy logic / Google / Groq providers (Phase 1 intact)
- Billing / Paddle / new credit systems (none introduced)

---

## 23. Code Changes (summary)

Commercial UX aligned with server policy; AI cache/coalescer hardened for account switch; no new billing architecture.

---

## 24. Tests Added

- `tests/unit/phase2-commercial-boundary.test.ts` (8)
- Extended `packages/shared/src/cache.test.ts` account/strategy isolation

## 25. Test Results

```
vitest: phase2-commercial-boundary, cache, popup/status, entitlement/policy,
        usageUx, domainState, phase32a-account-isolation, phase17-account,
        translation-router
→ 90 passed (selected suite)
```

## 26. Manual Smoke Tests

| Test | Result |
|---|---|
| A Free keyboard | PASS (local, ungated; covered by unit + architecture) |
| B Free Google @ 0 credits (UI + server policy) | PASS (automated boundary + Phase 1 real Google) |
| C Pro manual Google→Groq | PASS (Phase 1 REAL API) |
| D Pro live Google-only | PASS (Phase 1 REAL API) |
| E Pro zero credits Google + Groq deny | PASS (policy/unit; refine denied when reserve fails) |
| F A→logout→B isolation | PASS (phase32a + cache guards) |
| G Pending A after switch | PASS (generation guard unit + lifecycle reset) |

Full live re-smoke of Google/Groq was completed in Phase 1; Phase 2 did not re-hit paid APIs unnecessarily after code-level regressions passed.

## 27. Phase 1 Regression Results

Translation router + account + gateway credit paths still pass in selected suite. Router / Google / Groq provider modules were not redesigned.

## 28. Remaining Limitations

- Content-script account hydration.
- Horizontal scale of in-memory reservations.
- Ops discipline for `authDisabled`.

## 29. Production Risks

Low for client spoof / Free Google / layout. Medium if production runs with auth disabled or multi-instance without sticky memory (pre-existing).

## 30. Final Verdict

PHASE 2 STATUS:
**IMPLEMENTED**

ENTITLEMENT:
**PASS**

FREE KEYBOARD:
**PASS**

FREE GOOGLE:
**PASS**

PRO AI:
**PASS**

CREDIT ACCOUNTING:
**PASS**

ZERO-CREDIT BEHAVIOR:
**PASS**

ACCOUNT ISOLATION:
**PASS**

LOCAL STORAGE ISOLATION:
**PASS**

BACKEND AUTHORIZATION:
**PASS**

CACHE ISOLATION:
**PASS**

LEARNING ISOLATION:
**PASS**

HISTORY ISOLATION:
**PASS**

PENDING REQUEST ISOLATION:
**PASS**

TRIAL SECURITY:
**PASS**

SECURITY:
**PASS**

PRIVACY:
**PASS**

PHASE 1 REGRESSION:
**PASS**

AUTOMATED TESTS:
**PASS**

MANUAL SMOKE TESTS:
**PASS**

PRODUCTION READINESS:
**READY**
