# PHASE 32A — Account Isolation Audit

**Date:** 2026-08-26  
**Mode:** Forensic inventory before implementation  
**Scope:** Extension Chrome storage + related local persistence

---

## Root cause (pre-implementation)

All product state (`flowlary.learning.*`, `flowlary.history`, correction/translation/layout, consent) lives under **unscoped global keys**. Logout clears only auth session keys. The next signed-in account therefore inherits the previous user’s local product state. Server entitlement is correct; local ownership is not.

**Blocker today:** Extension never persists server `account.id`. Session stores email/tokens only. Isolation requires persisting authenticated `accountId` and routing account-owned stores through it.

---

## Chrome storage API usage

| API | Used? | Notes |
|---|---|---|
| `chrome.storage.local` | Yes | Primary persistence via `FlowlaryStorage` |
| `chrome.storage.sync` | Yes | License key only |
| `chrome.storage.session` | No | Not used |
| Page `localStorage` | Yes | Theme key `flowlary-theme` only |

---

## Complete inventory

| Storage key | Current scope | Correct scope | Risk | Migration required |
|---|---|---|---|---|
| `flowlary.learning.profile` | GLOBAL (unscoped) | **ACCOUNT** | P0 leak (onboarding, level, focus) | Yes — quarantine legacy |
| `flowlary.learning.events` | GLOBAL | **ACCOUNT** | P0 leak (mistakes, samples) | Yes — quarantine |
| `flowlary.learning.sessions` | GLOBAL | **ACCOUNT** | P0 leak (practice) | Yes — quarantine |
| `flowlary.history` | GLOBAL | **ACCOUNT** | P0 leak (activity text) | Yes — quarantine |
| `flowlary.correction` | GLOBAL | **ACCOUNT** | P0 consent + preference leak | Yes — quarantine |
| `flowlary.translation` | GLOBAL | **ACCOUNT** | P0 language preference leak | Yes — quarantine |
| `flowlary.layout` | GLOBAL | **ACCOUNT** | P0 preference leak (onboarding sets layouts) | Yes — quarantine |
| `flowlary.layout.profile` | GLOBAL | **ACCOUNT** | P0 personal exceptions leak | Yes — quarantine |
| `flowlary.settings` | GLOBAL | **DEVICE** | Low — device pause/exclusions | No (remain global) |
| `flowlary.learning.install` | GLOBAL | **INSTALLATION** | Low — fresh vs existing install | No |
| `flowlary.entitlement` | GLOBAL | **INSTALLATION / DEVICE** | Medium stale UX when signed out | No (remain local install UX) |
| `flowlary.entitlement.licenseKey` | sync/local GLOBAL | **INSTALLATION** (legacy) | Medium | No change this phase |
| `flowlary.migrations.v1` | GLOBAL | **INSTALLATION** | Low | No |
| `flowlary.cache` | GLOBAL | **TEMPORARY CACHE** | Medium cross-account AI cache | Clear on account switch / logout |
| `flowlary.auth.installId` | GLOBAL | **INSTALLATION** | Intentional | No |
| `flowlary.auth.installToken` | GLOBAL | **INSTALLATION** | Intentional | No |
| `flowlary.auth.accessToken` | SESSION | **SESSION** | Cleared on logout | Persist `accountId` alongside |
| `flowlary.auth.refreshToken` | SESSION | **SESSION** | Cleared on logout | — |
| `flowlary.auth.sessionId` | SESSION | **SESSION** | Cleared on logout | — |
| `flowlary.auth.accountEmail` | SESSION | **SESSION** | Cleared on logout | — |
| `flowlary.auth.accountPlan` | SESSION cache | **SESSION** | Cleared on logout | — |
| `flowlary.auth.serverEntitlement` | SESSION cache | **SESSION** | Cleared on logout | — |
| `flowlary.auth.entitlementSyncedAt` | Dead / unused write | **SESSION** | Low | Optional cleanup |
| `flowlary.auth.tokenExpiresAt` | SESSION | **SESSION** | Cleared on logout | — |
| *(missing)* `flowlary.auth.accountId` | N/A | **SESSION** | Blocker for isolation | **Add** from server `account.id` |
| `flowlary.ui.locale` | GLOBAL | **DEVICE** | Low | No |
| `flowlary-theme` (localStorage) | DEVICE | **DEVICE** | Low | No |
| `flowlary.correction.groqKey` | Legacy | Retired secret | Wipe if present | Remains remove-on-touch |
| Progress metrics | Derived | **ACCOUNT** (via events/sessions) | — | Via account-scoped sources |

### Legacy migration-only keys (not rewritten this phase)

EWA / Lingo / Layfix keys in `legacyKeys.ts` remain read-only migration sources. They must never be auto-assigned to a newly authenticated account.

---

## Ownership classification decision

### A. ACCOUNT-SCOPED (must isolate)

| Dataset | Why |
|---|---|
| LearningProfile + onboarding flags | Personal learner identity |
| LearningEvents + samples | Sensitive writing/learning corpus |
| PracticeSessions | Personal practice history |
| Activity (`history`) | Personal operation log |
| Correction prefs + **consent** | Product + legal: consent must not transfer |
| Translation prefs | Set in onboarding as user preference |
| Layout toggles + layout.profile | Set in onboarding; personal exceptions are user-owned |

### B. DEVICE / GLOBAL (intentional)

| Dataset | Why |
|---|---|
| `flowlary.settings` (enabled, pause, excludedDomains) | Browser/device integration |
| `flowlary.ui.locale` | UI chrome language for this profile |
| Theme `flowlary-theme` | UI chrome preference |

### C. INSTALLATION-SCOPED

| Dataset | Why |
|---|---|
| installId / installToken | Stable install identity for API |
| `learning.install` | Fresh vs existing install marker |
| `migrations.v1` | One-time migration machine |
| Local entitlement blob / legacy license key | Pre-account / migration UX |

### D. SESSION-SCOPED

Auth tokens, session id, email, plan cache, server entitlement cache, **accountId**.

### E. TEMPORARY CACHE

`flowlary.cache` — clear on logout and account switch; not migrated into account namespaces.

---

## Consent decision

**Consent is ACCOUNT-SCOPED.**

Rationale: `consentAccepted` lives inside correction settings and is presented as the user’s acceptance of Flowlary AI. Transferring A’s consent to B would misattribute legal/product consent. Device-wide consent is rejected.

---

## Settings split

| Field group | Scope |
|---|---|
| Master enable / pause / domain exclusions | DEVICE (`flowlary.settings`) |
| Correction mode, highlights, consent | ACCOUNT |
| Translation languages / live toggles | ACCOUNT |
| Layout auto/manual/source/targets | ACCOUNT |
| Layout profile exceptions/events | ACCOUNT |

---

## Logout / switch semantics (target)

| Event | Behavior |
|---|---|
| Logout | Clear session keys; set `activeAccountId = null`; detach account stores (inaccessible); **do not delete** account namespaces; clear AI cache; reset in-memory StateManager account fields to safe defaults |
| Login A | Persist `accountId`; activate A namespace; hydrate A data (or fresh defaults if empty) |
| Login B after A | Activate B only; never read unscoped legacy as B |
| A login again | Restore A namespace intact |

---

## Legacy data policy (target)

Unscoped legacy account-owned keys (`flowlary.learning.*`, `history`, `correction`, `translation`, `layout`, `layout.profile`):

1. On first authenticated session after upgrade, if unscoped data exists and **no** account namespace yet for that `accountId`, **and** a quarantine/claim marker allows safe claim:
   - Claim into that account **only when** the install has a single historical owner signal (see implementation: claim once to the first authenticated account that finds unclaimed legacy, then mark legacy quarantined/claimed).
2. Never auto-assign claimed/quarantined legacy to a *second* account.
3. Prefer: **claim-once to first post-upgrade signed-in account**, then tombstone unscoped keys so B never sees them.

Rationale: Blind assignment to “whoever logs in next” is a privacy leak. Claim-once to the first authenticated user after upgrade is the least-bad recovery for solo users; multi-user devices lose shared legacy rather than leak it.

---

## Gaps before implementation

1. Persist server `account.id` as `flowlary.auth.accountId`
2. Central `accountScopedStorage` + `ActiveAccountContext` with generation/race token
3. Route account-owned repositories through context (fail closed if no account)
4. Logout detach + StateManager/UI clear
5. `onChanged` must ignore other accounts’ keys / inactive context
6. Export/import/reset scoped to active account
7. Clear AI cache on switch/logout
8. Automated isolation invariants + test matrix

---

## Explicit non-goals (this phase)

- Cloud learning sync
- Backend learning DB
- Billing/entitlement redesign
- Deleting account data on logout
- Using email/install token as ownership key
