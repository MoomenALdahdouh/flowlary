# Feature Availability Status Hardening

**Date:** 2026-08-27  
**Baseline audit:** [FEATURE_AVAILABILITY_STATUS_FORENSIC_AUDIT.md](./FEATURE_AVAILABILITY_STATUS_FORENSIC_AUDIT.md)

---

## 1. Original Audit Findings

| ID | Finding |
|----|---------|
| P1-1 | Signed-out users showed **"Limit reached"** for Writing Correction |
| P1-2 | Translation **"Unavailable"** conflated backend health with provider failure |
| P2-1 | Flowlary AI row prioritized API offline over consent/auth |
| P2-2 | Signed-out correction used **"today's AI limit"** reason text |
| P2-3 | `computeDomainState` and `computeFeatureStatus` disagreed |
| P2-4 | No `requires_auth` in domain model; translation could show Ready when signed out |
| P2-5 | Header pill showed service unavailable when sign-in/consent was the real action |
| P3-1 | **"Setup required"** used instead of **"Consent required"** |
| P3-2 | Legacy evaluator drift risk |

---

## 2. Root Cause

1. **`isAiCreditLocked()` treated `!signedIn` as locked**, mapping authentication to credit exhaustion.
2. **`aiServiceState()` checked `apiHealth` before auth/consent**, masking user setup state.
3. **Feature state machines lacked `requires_auth`** and shared reason key `ai_unavailable` for all connectivity failures.
4. **Two parallel evaluators** (`computeDomainState` vs `computeFeatureStatus`) implemented different priority orders.

---

## 3. Minimal Fix

Status-only changes in:

- `extension/src/popup/status.ts` — split auth/credits/connectivity helpers; delegate legacy summary to canonical domain state
- `extension/src/ui/domainState.ts` — canonical gate order and shared `managedAiFeatureState()`
- `extension/src/ui/SystemStatus.tsx` — badges, reasons, header pill
- `extension/src/popup/i18n/en.ts` — precise labels (`Sign in required`, `Consent required`, `Service unavailable`)
- `extension/src/popup/views/HomeView.tsx` — consent enable action no longer blocked by false credit lock
- `extension/src/dashboard/panels/OverviewPanel.tsx` — usage label uses credits-only check
- `extension/src/dashboard/components/ComposeWorkbench.tsx` — signed-out blocked message

**No changes** to backend authorization, TranslationRouter, providers, Learning, Practice, or Explanation.

---

## 4. Canonical Status Model

**Single source of truth:** `computeDomainState()` in `domainState.ts`.

`computeFeatureStatus()` now **derives feature readiness from `computeDomainState()`** for summary-compatible legacy use.

### Feature kinds

| Kind | Meaning |
|------|---------|
| `ready` | Feature enabled; all runtime gates pass |
| `disabled` | User toggle off |
| `paused` | Extension paused |
| `requires_auth` | Account sign-in required |
| `requires_consent` | Flowlary AI consent required |
| `locked` | Signed-in; Groq/AI credits exhausted |
| `unavailable` | Flowlary backend service unreachable |

### Reason keys

| Key | When |
|-----|------|
| `sign_in_required` | Not signed in |
| `consent_required` | Consent not accepted |
| `usage_exhausted` | Signed in; credits = 0 |
| `service_unavailable` | `apiHealth === 'offline'` |
| `paused` | Extension inactive |
| `loading` | Status not yet loaded |

---

## 5. Status Priority

Matches runtime authorization order in background handlers:

1. Extension paused  
2. Feature disabled (user toggle)  
3. **Account required** (`requires_auth`)  
4. **Consent required** (`requires_consent`)  
5. **Credits exhausted** (`locked`) — correction only; translation skips this step  
6. **Service unavailable** (`unavailable`) — Flowlary backend `/health` offline  
7. **Ready**

Flowlary AI system row (`aiServiceState`) uses the same auth → consent → connectivity order.

---

## 6. Authentication Handling

- New helper: `requiresAuth(status)` → `!account.signedIn`
- **`isCreditsExhausted()` returns false when signed out**
- **`isAiCreditLocked()` alias now means credits exhausted only**
- Correction/translation/liveTranslation show **`requires_auth`** badge: **"Sign in required"**

---

## 7. Consent Handling

- Helper: `requiresConsent(status)` → `!consentAccepted || !aiReady`
- Evaluated **after auth**, before connectivity
- Badge: **"Consent required"** (not "Setup required")
- Flowlary AI row shows consent state even when backend is offline (auth checked first)

---

## 8. Credit Handling

- `isCreditsExhausted(status)` — signed-in users only
- Applies to correction via `creditGated: true` in `managedAiFeatureState()`
- Translation/liveTranslation: `creditGated: false` — **Ready at 0 Groq credits** when auth/consent/service pass
- Reason `usage_exhausted` never assigned when signed out

---

## 9. API Health Handling

- Helper: `isServiceOffline(status)` → `apiHealth === 'offline'`
- Represents **Flowlary backend reachability only** (existing `probeApiHealth()`)
- UI label: **"Service unavailable"** — not "Google unavailable"
- Reason: `service_unavailable` — "The Flowlary service is temporarily unreachable."
- Loading/null status uses `ai: 'loading'` — not service offline

---

## 10. Translation Handling

- Same gate chain as correction except **no credit gate**
- Signed out → `requires_auth`
- Signed in, no consent → `requires_consent`
- Signed in, consent, API offline → `unavailable` + `service_unavailable`
- Signed in, consent, API ok, 0 credits → **`ready`**

Backend Google policy unchanged.

---

## 11. Header Handling

`HeaderStatusPill` priority:

1. Loading → "Checking…"
2. Extension paused
3. Sign in required
4. Consent required
5. Service unavailable
6. Ready

No longer shows "Flowlary AI temporarily unavailable" when sign-in is the primary action.

---

## 12. Account Switch Handling

Unchanged — existing `useExtensionSession` clears `status = null` on account change/sign-out. No storage or cache architecture changes.

---

## 13. Tests

New: `tests/unit/ui/featureAvailabilityHardening.test.ts` (17 cases)

Updated:

- `tests/unit/ui/domainState.test.ts`
- `tests/unit/popup/status.test.ts`

Coverage includes signed-out/offline matrix, auth vs credits, consent, 0-credit translation ready, live translation off vs unavailable, loading state, canonical evaluator consistency.

---

## 14. Regression

**531 tests passed** in extension unit + selected integration suites (2026-08-27).

Verified unchanged:

- Phase 2 commercial boundary (Google at 0 credits)
- Phase 32A account isolation
- Phase 9 popup, Phase 22A foundation
- Entitlement policy, translation router tests
- Learning, Practice, Explanation paths untouched

---

## 15. Remaining Limitations

1. **`apiHealth` is backend liveness only** — no Google/Groq provider-specific UI signal (by design; no new probing added).
2. **`computeFeatureStatus` summary strings** still use `resolveUsageUx` for some copy; feature readiness is canonical via domain state.
3. **Non-English locales** fall back to English for new i18n keys until translated.
4. **Provider-specific failure at runtime** (e.g. Google API error mid-request) still surfaces via action-time error messages, not proactive status badges.

---

## Verdict

```
FEATURE AVAILABILITY HARDENING: COMPLETE
CANONICAL STATUS MODEL: PASS
AUTH VS CREDITS: PASS
CONSENT STATUS: PASS
WRITING CORRECTION STATUS: PASS
TRANSLATION STATUS: PASS
GOOGLE CREDIT INDEPENDENCE: PASS (unchanged backend)
LIVE TRANSLATION: PASS
KEYBOARD LAYOUT: PASS
PRACTICE: PASS (unchanged runtime gates)
HEADER STATUS: PASS
LOADING STATE: PASS
ACCOUNT SWITCH: PASS (unchanged)
ACCOUNT ISOLATION: PASS (unchanged)
BACKEND AUTHORIZATION: UNCHANGED / PASS
PROVIDER LOGIC: UNCHANGED / PASS
GROQ COST: 0 ADDITIONAL CALLS
GOOGLE COST: UNCHANGED
LEARNING: UNCHANGED
EXPLANATION SYSTEM: UNCHANGED
REGRESSION: PASS
PRODUCTION BLOCKER: NO
NEXT PHASE: WL-4D DAILY LEARNING BRIEF
```
