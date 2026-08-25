# Phase 10 — Unified Storage & Legacy Migration

## Overview

Phase 10 unifies persistent state under the `flowlary.*` namespace, migrates legacy keys from EWA / Lingo / Layfix, and introduces a single entitlement model. Migration is **v1**, idempotent, resumable, and never deletes legacy keys in this phase.

## Target namespaces

| Key | Purpose | Storage area |
|-----|---------|--------------|
| `flowlary.settings` | Global enable, pause, excluded domains | local |
| `flowlary.correction` | Correction toggles (no API key) | local |
| `flowlary.correction.groqKey` | BYOK Groq secret | local only |
| `flowlary.translation` | Languages, live/shortcut toggles | local |
| `flowlary.layout` | Auto/manual/shortcut layout toggles | local |
| `flowlary.layout.profile` | Layout profile, exceptions, trust events | local |
| `flowlary.history` | Preserved legacy history (Phase 11 engine deferred) | local |
| `flowlary.entitlement` | Unified license + usage | local |
| `flowlary.entitlement.licenseKey` | Lemon license key | sync |
| `flowlary.migrations.v1` | Migration state machine | local |

**Sync vs local:** EWA settings were historically in `chrome.storage.sync`; Flowlary stores product settings in **local** storage. Secrets (Groq key) remain **local only**. License keys migrate to **sync** (`flowlary.entitlement.licenseKey`) matching Lingo/Layfix behavior.

## Legacy inventory

| Legacy key | Product | Area | Target | Merge | Destructive? | Verify? |
|------------|---------|------|--------|-------|--------------|---------|
| `ewa_settings` | EWA | sync | `flowlary.correction` + global fields | TARGET_WINS | No | Yes |
| `ewa_groq_api_key` | EWA | local | `flowlary.correction.groqKey` | TARGET_WINS | No | configured only |
| `ewa_history` | EWA | local | `flowlary.history.ewa` | APPEND_UNIQUE | No | count |
| `lingoProfile` | Lingo | local | `flowlary.translation` + `flowlary.settings` | TARGET_WINS | No | Yes |
| `lingoUsage` | Lingo | local | `flowlary.entitlement.usage` | CONSERVATIVE_MERGE | No | Yes |
| `lingoLicenseCache` | Lingo | local | `flowlary.entitlement.license.cache` | PRO_MERGE | No | Yes |
| `lingoLicenseKey` | Lingo | sync | `flowlary.entitlement.licenseKey` | TARGET_WINS | No | configured only |
| `lingoFirstActivatedAt` | Lingo | sync | `flowlary.entitlement.usage.firstActivatedAt` | EARLIEST | No | Yes |
| `autofixProfile` | Layfix | local | `flowlary.layout` + `flowlary.layout.profile` | TARGET_WINS | No | Yes |
| `autofixEvents` | Layfix | local | `flowlary.layout.profile.events` | TARGET_WINS | No | count |
| `autofixHistory` | Layfix | local | `flowlary.history.layfix` | APPEND_UNIQUE | No | count |
| `autofixUsage` | Layfix | local | `flowlary.entitlement.usage` | CONSERVATIVE_MERGE | No | Yes |
| `autofixLicenseCache` | Layfix | local | `flowlary.entitlement.license.cache` | PRO_MERGE | No | Yes |
| `licenseKey` | Layfix | sync | `flowlary.entitlement.licenseKey` | TARGET_WINS | No | configured only |
| `autofixFirstActivatedAt` | Layfix | sync | usage trial start | EARLIEST | No | Yes |
| `enabled`, `layoutProfile`, `excludedDomains` | Layfix legacy sync | sync | merged via `autofixProfile` migration | LEGACY_WINS if profile missing | No | Yes |
| `wordCacheV2` | Layfix | local | **not migrated** (Option B) | — | No | — |

### Field transformations

**EWA → correction**

- `correctionMode` → `mode` (`box` | `direct`)
- `enabled`, `highlights`, `consentAccepted` → same
- `backendUrl` → **not migrated** (Flowlary uses fixed API routing)
- `groqApiKey` in sync object → ignored; use `ewa_groq_api_key` local key

**Lingo → translation + settings**

- `sourceLanguage`, `targetLanguage`, `liveEnabled`, `shortcutEnabled` → `flowlary.translation`
- `enabled`, `pausedUntil`, `excludedDomains` → `flowlary.settings`

**Layfix → layout + profile**

- `enabled` → `flowlary.layout.autoEnabled`
- `manualConversionEnabled`, `directShortcutEnabled` → layout toggles
- `sourceLayout`, `enabledLayouts` → layout + profile
- `personalExceptions` → `flowlary.layout.profile.personalExceptions`
- `autofixEvents` → profile trust events

## Merge rules

| Namespace | Strategy | Rationale |
|-----------|----------|-----------|
| Correction / translation / layout | **TARGET_WINS** | Preserve user data already in Flowlary |
| Groq / license keys | **TARGET_WINS** | Never replace newer valid secrets |
| Entitlement usage | **CONSERVATIVE_MERGE** | Earliest trial start, minimum balance |
| License cache | **PRO_MERGE** | Pro if either legacy source verified Pro |
| History preserve | **APPEND_UNIQUE** | No duplication; legacy arrays copied once |
| Personal exceptions | **UNION** via normalize | Never drop learned tokens |

## Migration state machine

States: `NOT_STARTED` → `RUNNING` → `PARTIAL` | `VERIFIED` → `COMPLETE` | `FAILED`

Stored in `flowlary.migrations.v1`:

```typescript
{
  version: 1,
  status,
  startedAt,
  completedAt,
  lockAcquiredAt,      // 5-minute stale lock recovery
  completedSteps: [],
  failedSteps: [],
  verifiedSteps: [],
  cleanupEligible: false // true only after VERIFIED
}
```

**COMPLETE** requires: write → read → validate → verify → mark complete. Skipped steps still count as verified when no legacy source exists.

## Migration steps (v1)

1. `ewa_correction`
2. `ewa_groq_key`
3. `ewa_history_preserve`
4. `lingo_translation`
5. `lingo_entitlement`
6. `layfix_layout`
7. `layfix_events`
8. `layfix_history_preserve`
9. `layfix_entitlement`

## Cache decision (wordCacheV2)

**Option B:** Legacy `wordCacheV2` is left untouched. Flowlary rebuilds its in-memory cache naturally. Phase 12 owns persistent cache optimization.

## History decision

Legacy `ewa_history` and `autofixHistory` are preserved under `flowlary.history` as `{ ewa?: [], layfix?: [] }`. No unified history engine or UI (Phase 11).

## Entitlement model

Product ID: **`FLOWLARY`**

```typescript
{
  product: 'FLOWLARY',
  status: 'trial' | 'free' | 'pro' | 'unknown',
  usage: UsageState,      // from Lingo/Layfix semantics
  license: { cache, migratedFrom }
}
```

- Single decision point: `resolveEntitlementStatus()` / `canFeatureUseEntitlement()`
- Malformed data → fail closed (`unknown`, no Pro)
- Migration never increments usage counters

## Security

- API keys and license keys never logged, reported, or sent remotely
- Migration diagnostics show step names only
- Groq verification checks `configured: true/false` via `hasGroqKey` in status

## Cleanup policy

Legacy keys are **not deleted** in Phase 10. After `cleanupEligible: true`, a future phase may remove legacy keys following explicit user verification. No automatic deletion is implemented.

## Startup flow

```
Service worker start
  → runStorageMigration() [locked, idempotent]
  → ensureDefaultNamespaces()
  → hydrateStateFromStorage() → stateManager
Content script start
  → same migration + hydration (separate JS context)
```

## Failure recovery

Partial migrations resume on next startup: verified steps skipped, failed steps retried, stale locks expire after 5 minutes.
