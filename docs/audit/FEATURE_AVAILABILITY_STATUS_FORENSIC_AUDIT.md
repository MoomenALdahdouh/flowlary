# Feature Availability & Status Forensic Audit

**Date:** 2026-08-27  
**Mode:** READ-ONLY — no production code modified  
**Scope:** Extension popup/dashboard status UI, entitlement layer, backend gateway/provider routing

---

## 1. Executive Summary

Flowlary uses a **single aggregated status pipeline** centered on `ExtensionStatus` (assembled in the service worker) and **`computeDomainState`** (consumed by popup and dashboard). Feature badges, system rows, and usage cards all derive from this pipeline — but they **collapse multiple independent dimensions** (connectivity, authentication, consent, credits, user toggles) into a small set of shared labels.

The screenshot state described in this audit — **Extension ACTIVE, Keyboard Layout READY, Writing Correction LIMIT REACHED, Translation UNAVAILABLE, Flowlary AI TEMPORARILY UNAVAILABLE, User NOT SIGNED IN, Consent REQUIRED** — is **fully reproducible** and is **not** caused by Google provider failure or Groq credit exhaustion. It is caused by:

1. **`apiHealth === 'offline'`** — the `/health` probe to `FLOWLARY_API_BASE` failed (local backend unreachable at audit time; dev default `http://127.0.0.1:8787`).
2. **`account.signedIn === false`** — no account session.
3. **`correction.consentAccepted === false`** — default after sign-out via `detachActiveAccount`.

**Critical finding:** The UI presents **contradictory and misleading reasons** for the same underlying state. The StatusStrip correctly shows "Not signed in" and "Consent required", but Writing Correction shows **"Limit reached"** (mapped from `isAiCreditLocked`, which treats signed-out as locked), and Translation shows **"Unavailable"** with reason **"Flowlary AI is temporarily unavailable"** — implying a service outage when the user has never signed in and has not granted consent.

**Backend commercial policy is correct:** Google Translation is independent of Groq credits at both client (`evaluateFeatureAccess`) and server (`canAccessTranslation`, `TranslationRouter`) layers. The **UI status model** does not faithfully represent that policy in signed-out / offline / consent-missing combinations.

| Area | Verdict |
|------|---------|
| Google Translation credit independence (backend) | **PASS** |
| Google Translation status accuracy (UI, screenshot state) | **INCORRECT** |
| Writing Correction status (signed-out → "Limit reached") | **INCORRECT** |
| Keyboard Layout (local, no gates) | **PASS** |
| Provider isolation (Groq vs Google) | **PASS** |
| Account isolation (storage/runtime) | **PASS** (popup refresh layer untested) |

**Production blocker:** **NO** — runtime gates are fail-closed; issues are status accuracy and UX ambiguity (P1/P2), not security or billing bypass.

---

## 2. Current Status Architecture

### 2.1 Data flow

```
Service worker: buildStatus()                    [background/index.ts:101–198]
  ├── readAccountSession() → account.signedIn
  ├── readServerEntitlementCache() → entitlement.*
  ├── stateManager → correction/translation/layout toggles + consent
  └── probeApiHealth() → apiHealth: 'ok' | 'offline'

Popup/Dashboard: useExtensionSession()           [popup/useExtensionSession.ts]
  ├── fetchStatus() → GET_STATUS message
  ├── computeDomainState(status, loading)        [ui/domainState.ts]  ← CANONICAL for badges
  ├── computeFeatureStatus(status)               [popup/status.ts]      ← LEGACY, not used by HomeView
  └── resolveUsageUxFromStatus(status)           [ui/usageUx.ts → shared/usageUx.ts]

UI surfaces:
  ├── SystemStatusBlock → extension + Flowlary AI row
  ├── FeatureControl → per-feature badges (Ready/Off/Unavailable/Limit reached/Setup required)
  ├── StatusStrip → plan, usage, correctionAi label, signed-in/out
  ├── UsageStatusCard → ACCOUNT_REQUIRED / AI_TEMPORARILY_UNAVAILABLE / etc.
  └── HeaderStatusPill → header connection summary
```

### 2.2 Source of truth by label

| User-facing label | Internal kind / state | Primary function | Input signal |
|-------------------|----------------------|------------------|--------------|
| **Extension active** | `domain.extension === 'active'` | `layoutState` / `buildStatus` | `stateManager.isActive()` |
| **Extension paused** | `domain.extension === 'paused'` | same | `!stateManager.isActive()` |
| **Ready** | `feature.kind === 'ready'` | `computeDomainState` | Feature enabled + gates pass |
| **Off** | `feature.kind === 'disabled'` | same | User toggle off |
| **Unavailable** | `feature.kind === 'unavailable'` | same | `apiHealth === 'offline'` (AI features) |
| **Limit reached** | `feature.kind === 'locked'` | same | `isAiCreditLocked(status) === true` |
| **Setup required** | `requires_consent` / `requires_setup` | same | Missing consent (`!consentAccepted \|\| !aiReady`) |
| **Temporarily unavailable** (Flowlary AI row) | `domain.ai === 'temporarily_unavailable'` | `aiServiceState()` | `apiHealth === 'offline'` |
| **Consent required** (Flowlary AI row) | `domain.ai === 'requires_consent'` | `aiServiceState()` | Missing consent (only when API online) |
| **Not signed in** | StatusStrip only | `StatusStrip` | `!status.account.signedIn` |
| **Consent required** (StatusStrip AI stat) | `correctionAiLabel()` | `popup/status.ts:218–221` | `!consentAccepted` |

### 2.3 Flowlary AI "temporarily unavailable" — classification

When `domain.ai === 'temporarily_unavailable'`, the condition is:

```50:54:extension/src/ui/domainState.ts
function aiServiceState(status: ExtensionStatus): AiServiceState {
  if (status.apiHealth === 'offline') return 'temporarily_unavailable'
  if (!status.correction.consentAccepted || !status.correction.aiReady) return 'requires_consent'
  return 'available'
}
```

| Category | Applies? |
|----------|----------|
| **A. Backend health failure** | **YES** — `probeApiHealth()` GET `/health` failed or non-OK |
| B. Authentication failure | No — auth is not checked in `aiServiceState` |
| C. Consent failure | **Masked** — consent check is skipped when API offline |
| D. Entitlement failure | No |
| E. Provider failure | No — no Google/Groq probe in UI |
| F. Stale client state | Possible if 15s health cache stale |
| **G. Generic fallback state** | Partial — loading null-status also sets `temporarily_unavailable` |

**Probe implementation:**

```8:21:extension/src/config/apiHealth.ts
export async function probeApiHealth(): Promise<ApiHealth> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value
  try {
    const response = await fetch(`${FLOWLARY_API_BASE}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000),
    })
    const value: ApiHealth = response.ok ? 'ok' : 'offline'
    cached = { value, at: Date.now() }
    return value
  } catch {
    cached = { value: 'offline', at: Date.now() }
    return 'offline'
  }
}
```

**Answer:** Flowlary AI "temporarily unavailable" is **(A) backend health failure** with **(G) generic fallback** behavior. It is **not** a direct Google or Groq provider signal.

### 2.4 Dual status models (inconsistency)

Two parallel evaluators exist:

| Scenario | `computeDomainState` (popup/dashboard badges) | `computeFeatureStatus` (legacy, unused in HomeView) |
|----------|------------------------------------------------|-----------------------------------------------------|
| Signed out | correction → **locked** / "Limit reached" | correction → **setup** / "Sign in" |
| 0 credits, signed in | correction → locked; translation → ready | same |
| API offline | correction/translation → unavailable | same |
| No consent | requires_consent / "Setup required" | correction → setup |

HomeView and OverviewPanel use **`computeDomainState` only**. `computeFeatureStatus` is still computed in `useExtensionSession` but not rendered.

---

## 3. Authentication Matrix

Traced from `entitlement/service.ts:canUseFeature`, `evaluateFeatureAccess`, `background/correct.ts`, `background/translate.ts`, `layout/scheduler.ts`, `practiceAvailability.ts`, and learning storage guards.

| Feature | Signed out | Signed in |
|---------|------------|-----------|
| **Keyboard Layout (auto/local remap)** | **Available** — no auth check; `layoutState()` only checks extension active + toggle | **Available** |
| **Speed Box** | **Available** — local UI; some AI-adjacent actions show consent errors | **Available** |
| **Writing Correction** | **Blocked** — `canUseFeature('correction')` → `account_required`; UI shows **"Limit reached"** (misleading) | **Available** if consent + credits |
| **Translation (manual/shortcut)** | **Blocked** at runtime — `account_required`; UI shows consent or unavailable, not sign-in | **Available** if consent; **not credit-gated** |
| **Live Translation** | **Blocked** at runtime — same as translation | **Available** if consent + translation enabled; **not credit-gated** |
| **Layout AI classifier** | **Blocked** — `canUseFeature('layout_ai')` → `account_required` | **Available** if credits (Groq-gated) |
| **Learning persistence** | **Blocked** — `activeAccountContext.getAccountId()` guards all writes | **Available** when account active |
| **Practice** | **Blocked** — `blockReason: 'account_required'` / `'signed_out'` | **Available** if consent + credits |

**Install token:** Backend explicitly denies managed AI for install-only auth (`auth.ts:43–63`, `allowed: false`, `denyReason: 'account_required'`).

**UI gap:** `computeDomainState` does **not** expose `requires_auth` for translation when signed out with API online and consent granted (hypothetical). Translation would show **Ready** while runtime returns `account_required`.

---

## 4. Consent Matrix

Consent is stored as **`correction.consentAccepted`** (account-scoped). `isCorrectionAiReady()` equals consent accepted (`features/correction/readiness.ts`).

| Feature | Consent required? | Gate location |
|---------|-------------------|---------------|
| Writing Correction | **Yes** | `correct.ts`, `applyCorrection.ts`, `domainState` |
| Translation | **Yes** (reuses correction consent) | `translate.ts:54–56`, `domainState` |
| Live Translation | **Yes** | same |
| Layout (local auto-fix) | **No** | `layout/scheduler.ts` — only `autoEnabled` |
| Layout AI classify | **No separate consent** — uses entitlement only | `classify.ts` |
| Speed Box AI actions | **Yes** for some paths | `speedBox.ts:486` |
| Practice | **Yes** | `practiceAvailability.ts:33–39` |
| Learning event writes | **No explicit consent gate** — requires active account | `learning/events/index.ts` |

| Consent state | UI (Flowlary AI row) | UI (feature badges) | Runtime |
|---------------|---------------------|----------------------|---------|
| **Required** | "Consent required" (if API online) | "Setup required" | `consent_required` error |
| **Granted** | "Available" | "Ready" (if other gates pass) | Proceeds to auth/entitlement |

**Masking bug:** When `apiHealth === 'offline'`, consent state is **hidden** — Flowlary AI shows "Temporarily unavailable" instead of "Consent required".

---

## 5. Credit Matrix

### 5.1 Client UI lock

```58:67:extension/src/popup/status.ts
export function isAiCreditLocked(status: ExtensionStatus): boolean {
  const { entitlement, account } = status
  if (!account.signedIn) return true
  if (entitlement.isPro || entitlement.inTrial) {
    return entitlement.creditsRemaining <= 0
  }
  if (entitlement.status === 'unknown') return true
  if (entitlement.status === 'free' && entitlement.creditsRemaining <= 0) return true
  return false
}
```

**Signed-out users are treated as credit-locked** → correction badge "Limit reached".

### 5.2 Client policy engine

```93:99:packages/shared/src/entitlement/index.ts
const creditGatedAi: EntitlementFeature[] = ['correction', 'layout_ai', 'practice']
if (creditGatedAi.includes(feature)) {
  if (options.creditsRemaining != null && options.creditsRemaining <= 0) {
    return { allowed: false, tier, reason: 'usage_exhausted' }
  }
}
```

**Translation is NOT in `creditGatedAi`.**

### 5.3 Server reservation

| Operation | Reserves Groq credits? | When |
|-----------|------------------------|------|
| correction | **Always** | `gateway/index.ts:85–88` |
| translation (Google path) | **No upfront**; release if unused | `strategyRequiresGroqCredits` false |
| translation (Groq path) | **Yes** | `strategy === 'groq'` |
| layout-classification | **Always** | Groq-only |

`canAccessTranslation` allows Google strategies when `denyReason === 'usage_exhausted'`:

```63:73:backend/src/providers/translationRouter.ts
export function canAccessTranslation(auth, strategy): boolean {
  if (auth.authKind === 'dev') return true
  if (!auth.accountId) return false
  if (auth.denyReason === 'suspended') return false
  if (auth.allowed) return true
  if (auth.denyReason === 'usage_exhausted' && strategy !== 'groq') return true
  return false
}
```

### 5.4 Does UI treat Groq exhaustion as Translation unavailable?

**At 0 credits, signed in, API online:** Translation badge = **Ready** (verified in `domainState.test.ts:121–144` and `phase2-commercial-boundary.test.ts`).

**At 0 credits:** UI does **not** mark translation unavailable due to credits.

**Bug (different axis):** Signed-out users see correction "Limit reached" with reason **"You've reached today's AI limit"** — implying credit exhaustion, not missing account.

---

## 6. Provider Matrix

| Provider | Operations | Credit-gated? | UI status signal | Independent failure domain? |
|----------|-------------|---------------|------------------|----------------------------|
| **Google Translate** | translation, live translation (default) | **No** (Free Google path) | None — uses global `apiHealth` | **Yes** at backend |
| **Groq** | correction, layout AI, practice, Pro translation refinement, Groq-only fallback | **Yes** | Via `isAiCreditLocked` for correction only | **Yes** at backend |
| **Local heuristics** | layout auto-fix, speed box | **No** | `layoutState` — always ready if enabled | **Yes** — fully client-side |
| **Cache** | all AI ops | N/A | Not surfaced | Per-account isolated |

**Groq failure does not disable Google Translation** (backend). **Google failure with fallback disabled does not disable layout/correction UI** — but correction may be unavailable for other reasons (credits, consent, API health).

---

## 7. Google Translation Trace

### 7.1 End-to-end path

```
TranslationFeature.execute() / runLiveTranslation()
  → requestTranslationRemote() [client.ts]
  → chrome.runtime.sendMessage({ type: 'TRANSLATE_TEXT' })
  → handleTranslateText() [background/translate.ts]
      1. isCorrectionAiReady() → consent_required
      2. canTranslateRequest() → validation
      3. canUseFeature('translation' | 'live_translation') → account_required / capability
      4. L2 cache check
      5. POST /api/ai/translation
  → routes/http.ts → AiGateway.translation()
  → resolveTranslationStrategy() → 'google' | 'google_then_groq' | 'groq'
  → runRoutedTranslation() → runGoogleTranslate() [googleTranslateProvider.ts]
```

### 7.2 What makes Translation show "Unavailable"?

In `computeDomainState`, translation uses `aiFeatureState(..., locked=false, ai)`:

```87:96:extension/src/ui/domainState.ts
  if (locked) { ... }  // never true for translation
  if (status.apiHealth === 'offline') {
    return { kind: 'unavailable', enabled: true, canToggle: false, reasonKey: 'ai_unavailable' }
  }
  if (ai === 'requires_consent') {
    return { kind: 'requires_consent', ... }
  }
  return { kind: 'ready', ... }
```

| Check | Affects Translation UI badge? |
|-------|------------------------------|
| Global Flowlary AI health (`apiHealth`) | **YES** → Unavailable |
| Groq availability | **NO** |
| Credits | **NO** (`locked=false`) |
| Authentication | **NO** (not in domainState) |
| Consent | **YES** → Setup required (when API online) |
| `GOOGLE_TRANSLATE_ENABLED` | **NO** — server-only; UI has no signal |
| Provider configuration | **NO** |
| Google vs general AI failure distinction | **NO** |

### 7.3 Screenshot state root cause

Given **NOT SIGNED IN + CONSENT REQUIRED + Translation UNAVAILABLE + Flowlary AI TEMPORARILY UNAVAILABLE:**

| Hypothesis | Verdict |
|------------|---------|
| Actual Google provider failure | **Unlikely** — UI never probes Google |
| Environment config (backend down) | **Confirmed** — `/health` unreachable at audit |
| Authentication | **True blocker** — but not shown on translation badge |
| Consent | **True blocker** — shown in StatusStrip, masked on Flowlary AI row |
| Stale status | Unlikely |
| Incorrect UI gating | **YES** — offline conflated with translation unavailability |

**Verdict:** Translation "Unavailable" in the screenshot reflects **`apiHealth === 'offline'`**, not Google provider failure. Even if Google were healthy, this user could not translate (unsigned + no consent). The label **overstates a service outage**.

---

## 8. Writing Correction Trace

### 8.1 "Limit reached" determination

```63:64:extension/src/ui/domainState.ts
  if (locked) {
    return { kind: 'locked', enabled: true, canToggle: false, reasonKey: 'usage_exhausted' }
```

`locked = isAiCreditLocked(status)` which returns **true when signed out**.

### 8.2 Priority order (correction)

1. Extension paused  
2. Feature disabled (toggle off)  
3. **Locked (credits OR signed-out)** ← screenshot hits here  
4. API offline → unavailable  
5. Consent missing → requires_consent  
6. Ready  

**Signed-out takes precedence over consent and offline unavailable** for correction badge.

### 8.3 Screenshot verdict

| Possible cause | Applies? |
|----------------|----------|
| Correct daily quota exhaustion | **No** — user not signed in |
| Unauthenticated state | **Yes** — actual blocker |
| Missing consent | **Yes** — but correction shows Limit reached first |
| Stale usage state | No |
| Backend usage_exhausted | No |
| Incorrect UI mapping | **Yes** |

**Verdict:** Writing Correction "Limit reached" is **INCORRECT** for the screenshot state. Correct label: **Sign in required** (and consent required before use).

---

## 9. Live Translation Trace

Live Translation state uses the same `aiFeatureState` as manual translation with `status.translation.liveEnabled` as the enabled flag.

| `liveEnabled` | Other gates | Badge |
|---------------|-------------|-------|
| `false` | any | **Off** (`disabled`) — user preference |
| `true` | API offline | **Unavailable** |
| `true` | no consent | **Setup required** |
| `true` | signed in, consent, API ok | **Ready** |

**"Off" vs "Unavailable":** The UI correctly uses `disabled` → label **"Off"** for user toggle. It does **not** conflate Off with Unavailable in `computeDomainState`.

**Dependency:** Live toggle is disabled in UI when `!status.translation.shortcutEnabled` (`HomeView.tsx:128`).

**Screenshot:** Live Translation status not listed; if toggle off, would correctly show **Off**.

---

## 10. Keyboard Layout Trace

```99:112:extension/src/ui/domainState.ts
function layoutState(status: ExtensionStatus): FeatureState {
  if (!status.active) return { kind: 'paused', ... }
  if (!status.layout.autoEnabled) return { kind: 'disabled', ... }
  return { kind: 'ready', ... }
}
```

**No checks for:** authentication, consent, credits, Google, Groq, or `apiHealth`.

Runtime: `LayoutScheduler` gates on `layout.autoEnabled` only. Local `planFieldFixes()` runs without network.

**Screenshot "Ready":** **Correct** and consistent with architecture.

---

## 11. Account Switch Analysis

### 11.1 Lifecycle

| Event | Behavior |
|-------|----------|
| **attachActiveAccount(A→B)** | Clears AI cache, bumps generation, hydrates B's settings |
| **detachActiveAccount (logout)** | Resets StateManager to defaults (`consentAccepted: false`), clears cache |
| **restoreActiveAccountFromSession** | SW restart rehydrate; clears cache if ID differs |
| **useExtensionSession reload** | Sets `status=null` when accountId changes or sign-out detected |

### 11.2 Stale status risk

| Dimension | Refreshed on switch? | Risk |
|-----------|---------------------|------|
| Credits / entitlement | Yes — server cache per account | Low |
| Consent | Yes — account-scoped storage | Low |
| Provider state | N/A in UI | — |
| Feature toggles | Yes — hydrated from account namespace | Low |
| AI cache | Cleared on switch | Low |
| Popup display | Cleared briefly (`status=null`) | Low — **untested** |
| apiHealth | Global, not per-account | N/A |

**Verdict:** Account isolation at storage/runtime is **sound**. Popup session refresh logic exists but lacks automated tests.

---

## 12. Screenshot Reproduction

### 12.1 Reproduced inputs

```typescript
{
  active: true,
  account: { signedIn: false, ... },
  correction: { enabled: true, consentAccepted: false, aiReady: false, ... },
  translation: { shortcutEnabled: true, liveEnabled: false, ... },
  layout: { autoEnabled: true, ... },
  apiHealth: 'offline',
  entitlement: { status: 'unknown', creditsRemaining: 0, ... }  // default for signed-out
}
```

### 12.2 Expected outputs (`computeDomainState`)

| Surface | Value | Correct? |
|---------|-------|----------|
| Extension | **active** | ✅ |
| Flowlary AI | **temporarily_unavailable** | ⚠️ True for API down; masks consent/auth |
| Keyboard Layout | **ready** | ✅ |
| Writing Correction | **locked** → "Limit reached" | ❌ Should be sign-in required |
| Translation | **unavailable** | ⚠️ API down; auth/consent also block |
| StatusStrip | Not signed in + Consent required | ✅ |
| Usage card | ACCOUNT_REQUIRED | ✅ |

### 12.3 Environment note

At audit time, `curl http://127.0.0.1:8787/health` was **unreachable**, matching `apiHealth: 'offline'` in a default dev extension build pointing at localhost.

---

## 13. UI Status Accuracy

### 13.1 Misleading combinations

| Display | Actual condition | Severity |
|---------|------------------|----------|
| "Limit reached" + "Not signed in" | Auth missing, not quota | P2 |
| "Limit reached" + reason "today's AI limit" | Signed-out treated as exhausted | P2 |
| "Temporarily unavailable" + "Consent required" | API offline masks consent on AI row | P2 |
| Translation "Unavailable" + "AI temporarily unavailable" | Backend health, not Google | P2 |
| Translation "Ready" (signed out, API ok, consent ok) | Would show ready; runtime blocks | P2 (latent) |
| "Setup required" instead of "Consent required" on badges | Wording | P3 |

### 13.2 Accurate messages

- UsageStatusCard for signed-out: **"Sign in to use Flowlary AI"**
- Layout **Ready** when extension active
- Phase 2 tests: translation **Ready** at 0 credits when signed in
- Live Translation **Off** when user disabled

---

## 14. Provider Isolation

Verified at client policy, gateway routing, and UI layers:

| Failure | Does NOT incorrectly disable |
|---------|------------------------------|
| Google Translation failure | Keyboard Layout ✅, local correction pipeline ✅, Practice UI ✅ (independent gates) |
| Groq failure / 0 credits | Google Translation (backend + UI when signed in) ✅, Keyboard Layout ✅ |
| API health offline | Keyboard Layout ✅ (stays Ready) |
| API health offline | Correction/Translation UI → unavailable (expected for network path) |

**Runtime isolation confirmed.** UI aggregates unrelated dimensions into shared "AI unavailable" copy.

---

## 15. Missing Tests

### 15.1 Existing strong coverage

- `tests/unit/ui/domainState.test.ts` — offline, consent, 0 credits + translation ready
- `tests/unit/popup/status.test.ts` — signed-out in **computeFeatureStatus** (not domainState)
- `tests/unit/phase2-commercial-boundary.test.ts` — end-to-end commercial boundary
- `tests/unit/translation-router.test.ts` — Google at usage_exhausted
- `tests/integration/phase32a-account-isolation.test.ts` — account switch isolation

### 15.2 Gaps

| Scenario | Covered? |
|----------|----------|
| Signed out → domainState correction badge | **NO** |
| Signed out + API offline → full UI matrix | **NO** |
| `useExtensionSession` status nulling on switch | **NO** |
| HomeView / OverviewPanel render assertions | **NO** (only happy-path phase9) |
| Google provider runtime failure → UI | **NO** |
| Groq runtime failure → UI (not network) | **NO** |
| `computeConnectionState` | **NO** |
| `restoreActiveAccountFromSession` | **NO** |
| AI cache cleared on attachActiveAccount | **NO** (implied only) |
| apiHealth `'unknown'` | **NO** |
| Translation ready when signed out (latent bug) | **NO** |

---

## 16. P0/P1/P2/P3 Findings

### P0 — Security / account isolation (0)

No P0 findings. Account-scoped storage, generation guards, cache clearing on switch, and mid-request `account_changed` aborts are implemented.

### P1 — Incorrect feature availability / commercial enforcement (2)

| ID | Finding |
|----|---------|
| **P1-1** | `isAiCreditLocked` treats **signed-out as locked**, causing **"Limit reached"** instead of **"Sign in required"** on Writing Correction — misrepresents commercial state and may imply false quota exhaustion. |
| **P1-2** | Translation **"Unavailable"** driven solely by **`apiHealth`**, with no distinction from auth/consent blockers. User cannot tell if Google Translation is available vs backend unreachable vs account missing. Backend policy allows Google at 0 credits but UI cannot communicate that in mixed states. |

### P2 — Misleading UI / status behavior (5)

| ID | Finding |
|----|---------|
| **P2-1** | `aiServiceState` prioritizes **API offline over consent** — Flowlary AI row shows "Temporarily unavailable" when consent is also missing. |
| **P2-2** | `featureReason.usageExhausted` ("today's AI limit") shown for signed-out correction locked state. |
| **P2-3** | **Dual models** — `computeFeatureStatus` maps signed-out → "Sign in"; `computeDomainState` → "Limit reached". HomeView uses the wrong one for auth semantics. |
| **P2-4** | No **`requires_auth`** dimension in domain model — translation can show Ready when signed out (if consent granted + API ok). |
| **P2-5** | Header pill: "Flowlary AI temporarily unavailable" when layout is ready and primary blockers are auth/consent. |

### P3 — Cosmetic / improvement (2)

| ID | Finding |
|----|---------|
| **P3-1** | Feature badges use **"Setup required"** instead of **"Consent required"** for `requires_consent`. |
| **P3-2** | `computeFeatureStatus` computed but unused in HomeView — dead path increases drift risk. |

---

## 17. Recommended Minimal Fixes

*Audit-only recommendations — not implemented in this phase.*

1. **Split `isAiCreditLocked` from auth** — introduce `requiresAuth(status)` separate from `creditsExhausted(status)`. Map signed-out correction to `requires_auth` / "Sign in required", not `locked`.
2. **Reorder or combine gates in `aiServiceState`** — e.g. report composite state or prioritize consent/auth before connectivity for clearer Flowlary AI row copy.
3. **Add `requires_auth` to translation/liveTranslation in `computeDomainState`** when `!account.signedIn`.
4. **Use distinct reason keys** — `sign_in_required`, `consent_required`, `usage_exhausted`, `service_unavailable`, `provider_unavailable` instead of shared `ai_unavailable` / `usage_exhausted`.
5. **Align on single status evaluator** — deprecate `computeFeatureStatus` or wire HomeView to one canonical function.
6. **Optional: provider-scoped health** — separate backend liveness from managed-AI readiness (future; not required for minimal fix).
7. **Add tests** for signed-out + offline matrix in `domainState.test.ts` and `useExtensionSession` account-switch refresh.

---

## 18. No-Code-Change Confirmation

This audit **did not modify**:

- TranslationRouter, Google provider, Groq provider, AiGateway  
- Learning, Practice, Layout, Correction features  
- Account or entitlement architecture  
- Any production source files  

**Only this report was created:** `docs/audit/FEATURE_AVAILABILITY_STATUS_FORENSIC_AUDIT.md`

---

## 19. Final Verdict

The Flowlary **backend correctly isolates Google Translation from Groq credits** and enforces auth/consent at runtime. The **UI status system collapses independent dimensions** into ambiguous labels. The screenshot state is **reproducible** and explained by **unsigned user + missing consent + backend health probe failure** — not by Google provider outage or quota exhaustion.

The most user-visible defect is **Writing Correction showing "Limit reached" for a user who is not signed in**, while the StatusStrip correctly says "Not signed in". Translation showing **"Unavailable"** is technically consistent with offline API but **misleading** given auth and consent are also required.

---

## Audit Completion Block

```
FEATURE AVAILABILITY AUDIT:
COMPLETE

GOOGLE TRANSLATION STATUS:
INCORRECT (UI — screenshot state conflates API offline with translation unavailability; backend policy PASS)

WRITING CORRECTION STATUS:
INCORRECT (signed-out shown as Limit reached)

KEYBOARD STATUS:
PASS

LIVE TRANSLATION STATUS:
PASS (Off vs Unavailable distinction correct; not in screenshot)

AUTH STATUS:
INCORRECT (correction badge); PASS (StatusStrip + usage card)

CONSENT STATUS:
INCORRECT (masked on Flowlary AI row when API offline); PASS (StatusStrip)

CREDIT STATUS:
PASS (translation not credit-gated at 0 credits); INCORRECT (signed-out mapped to exhausted)

ACCOUNT ISOLATION:
PASS

PROVIDER ISOLATION:
PASS

P0: 0
P1: 2
P2: 5
P3: 2

PRODUCTION BLOCKER:
NO

PRODUCTION CODE MODIFIED:
NO
```
