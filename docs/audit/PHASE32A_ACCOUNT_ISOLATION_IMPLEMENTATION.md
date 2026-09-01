# PHASE 32A — Account Isolation Implementation

**Date:** 2026-08-26  
**Status:** Implemented and verified  
**Related audit:** `docs/audit/PHASE32A_ACCOUNT_ISOLATION_AUDIT.md`

---

## 1. Root cause

Local product state lived under global unscoped keys (`flowlary.learning.*`, `flowlary.history`, correction/translation/layout, consent). Logout cleared only auth session keys. The next signed-in account inherited the previous user’s local product state. Server entitlement was correct; local ownership was not.

The extension also never persisted server `account.id`, so there was no stable ownership key.

---

## 2. Storage inventory

See the audit report for the full table. Summary of the ownership model implemented:

| Class | Examples |
|---|---|
| **ACCOUNT-SCOPED** | learning profile/events/sessions, history/activity, correction (+consent), translation, layout, layout.profile |
| **DEVICE** | `flowlary.settings`, locale, theme |
| **INSTALLATION** | install id/token, learning.install, migrations, local entitlement blob |
| **SESSION** | JWT/refresh/session/email/plan/server entitlement cache, **`authAccountId`** |
| **TEMPORARY** | AI cache (cleared on logout/switch) |

---

## 3. Ownership classification

- **Consent:** account-scoped (must not transfer between users).
- **Correction / translation / layout prefs:** account-scoped (set during onboarding as personal preferences).
- **Learning + activity:** account-scoped.
- **Master enable / pause / excluded domains:** device-scoped.
- **Install identity:** installation-scoped (unchanged).

Ownership key: **server `account.id` only** (UUID). Never email, install token, or JWT string.

---

## 4. Architecture implemented

```
Auth (register/login/refresh)
  → persist accountId
  → attachActiveAccount(accountId)
       → activeAccountContext.activate (+ generation bump)
       → maybeClaimLegacyAccountData (claim-once)
       → reset service singletons
       → hydrateStateFromStorage (account namespace)

Logout
  → clearAccountSession
       → detachActiveAccount (generation bump, context null)
       → clear AI cache
       → reset in-memory correction/translation/layout to defaults
       → do NOT delete account namespaces
```

### New modules

| File | Role |
|---|---|
| `extension/src/storage/activeAccountContext.ts` | `activeAccountId` + generation race token |
| `extension/src/storage/accountScopedStorage.ts` | Key builder + get/set/remove; fail closed |
| `extension/src/storage/accountIsolationMigration.ts` | Legacy claim-once / quarantine |
| `extension/src/storage/accountSessionLifecycle.ts` | attach / detach / restore |

Physical keys: `flowlary.account.<accountId>.<suffix>` (e.g. `.learning.profile`, `.history`, `.correction`).

Application code must not construct these keys manually — use `getAccountScopedStorage(storage)`.

---

## 5. Migration strategy

Pre-isolation unscoped keys (`flowlary.learning.*`, `history`, `correction`, `translation`, `layout`, `layout.profile`):

1. On first authenticated attach after upgrade, if unscoped data exists and isolation meta has no prior claim → **copy into that account’s namespace**, tombstone unscoped keys, record `legacyClaimedByAccountId`.
2. Later accounts never receive that legacy data (`already_claimed` / `quarantined`).
3. Never silently assign claimed data to a newly authenticated second user.

Meta key: `flowlary.account.isolation.meta`.

---

## 6. Logout behavior

Logout = **detach**, not delete.

- Auth/session keys cleared (including `authAccountId`).
- Active context null + generation bumped.
- In-memory account prefs reset to defaults so UI cannot show A’s data.
- AI cache cleared.
- Account namespaces remain on disk for re-login recovery.

---

## 7. Account-switch behavior

A → logout → B:

- B sees empty/default account state unless B already has a namespace.
- A’s learning/activity/settings remain under A’s keys.

B → logout → A:

- A’s prior local state restores via attach.

Invariant: A data ≠ B data on the same Chrome profile.

---

## 8. Async race protection

- Every account-owned write captures `AccountWriteGuard` `{ accountId, generation }`.
- Before commit, `assertWriteGuard` must still match.
- Logout/login bumps generation so in-flight A writes cannot commit into B.
- History / learning / practice write paths use `return await writeStore(...)` so storage failures are caught safely.

---

## 9. Privacy guarantees

| Invariant | Status |
|---|---|
| B cannot read A’s account-scoped storage | Enforced by key namespace + active context |
| B cannot write A’s storage | Guard + fail closed |
| Logout does not expose previous account data | Detach + memory reset + UI clear |
| Account switch does not merge state | Separate namespaces |
| Stale async A writes discarded after switch | Generation guard |
| Clear/reset only active account | Scoped clear/reset APIs |
| Export only active account | Requires active accountId |
| Import cannot change account identity | Writes only into active namespace; no auth import |
| No account-scoped repo without accountId | Fail closed (defaults / empty / reject) |
| No global fallback for account-owned data | Unscoped keys not read for product APIs after claim |

`chrome.storage.onChanged` ignores other accounts’ `flowlary.account.*` keys. UI clears status briefly when `accountId` changes.

---

## 10. Tests added

`tests/integration/phase32a-account-isolation.test.ts` — matrix covering:

1. A → logout → B isolation  
2. B → logout → A restore  
3. Stale async write discarded  
4. Onboarding not inherited  
5. Activity clear scoped  
6. Learning clear scoped  
7. Export secrets / only active data  
8. Import becomes B-owned only  
9. Generation race  
10. No account fail closed  
11. Re-login restore  
12. A→B→A→B  
13. Legacy claim-once  
14. Practice sessions isolated  

Helpers: `tests/helpers/accountIsolation.ts`, updated `seedFlowlaryAccountAuth` to persist `accountId` + activate context.

---

## 11. Full test results

```
npm test
→ 91 passed test files
→ 654 passed tests
```

Targeted isolation suite: **14/14 passed**.

---

## 12. Build result

```
npm run build        → success
npm run build:release → success
```

Release bundle includes `accountScopedStorage-*.js`. No debug logging of account-owned content was added.

---

## 13. Remaining risks

1. **Claim-once tradeoff:** On a shared device upgrading from pre-32A, whichever account signs in first claims unscoped legacy data. Documented; safer than leaking to every subsequent user.
2. **Signed-out prefs:** Account-scoped prefs are not persisted while signed out (fail closed). Local layout still works from in-memory defaults.
3. **Single-process chrome.storage:** Isolation is per Chrome profile / extension install, not cross-device (learning remains local-first by design).
4. **Rollup circular import warning** around storage re-exports was mitigated for background by importing `runStorageMigration` directly; monitor content script similarly if warnings reappear.
5. **Access JWT after logout** still valid until expiry (pre-existing; out of scope).

---

## Key files touched

- `packages/shared/src/types.ts` — `authAccountId`, `accountIsolationMeta`
- `extension/src/config/accountAuth.ts` — persist/require `account.id`; attach on login/register/refresh
- `extension/src/storage/facade.ts`, learning/history/practice, export/import/reset/summary
- `extension/src/background/index.ts` — restore active account on SW start; status includes `accountId`
- `extension/src/popup/useExtensionSession.ts` — account-aware storage listener + UI clear on switch
