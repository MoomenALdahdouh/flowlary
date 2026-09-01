/**
 * Legacy unscoped → account-scoped claim (once).
 * Never assign quarantined/claimed legacy to a second account.
 */

import { STORAGE_KEYS } from '@flowlary/shared'
import type { FlowlaryStorage } from './index.ts'
import {
  ACCOUNT_OWNED,
  LEGACY_UNSCOPED_OWNED_KEYS,
  buildAccountScopedKey,
  type AccountOwnedKind,
} from './accountScopedStorage.ts'
import { isValidAccountId } from './activeAccountContext.ts'

export type AccountIsolationMeta = {
  version: 1
  /** Account that claimed pre-isolation unscoped data (claim-once). */
  legacyClaimedByAccountId: string | null
  /** When unscoped keys were tombstoned / quarantined. */
  legacyQuarantinedAt: number | null
}

const META_VERSION = 1 as const

function emptyMeta(): AccountIsolationMeta {
  return {
    version: META_VERSION,
    legacyClaimedByAccountId: null,
    legacyQuarantinedAt: null,
  }
}

export function normalizeIsolationMeta(raw: unknown): AccountIsolationMeta {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyMeta()
  const value = raw as Partial<AccountIsolationMeta>
  const claimed =
    typeof value.legacyClaimedByAccountId === 'string' &&
    isValidAccountId(value.legacyClaimedByAccountId)
      ? value.legacyClaimedByAccountId
      : null
  return {
    version: META_VERSION,
    legacyClaimedByAccountId: claimed,
    legacyQuarantinedAt:
      typeof value.legacyQuarantinedAt === 'number' ? value.legacyQuarantinedAt : null,
  }
}

export async function readIsolationMeta(storage: FlowlaryStorage): Promise<AccountIsolationMeta> {
  return normalizeIsolationMeta(await storage.get(STORAGE_KEYS.accountIsolationMeta, 'local'))
}

async function writeIsolationMeta(
  storage: FlowlaryStorage,
  meta: AccountIsolationMeta,
): Promise<void> {
  await storage.set(STORAGE_KEYS.accountIsolationMeta, meta as unknown as Record<string, unknown>, 'local')
}

function hasMeaningfulPayload(raw: unknown): boolean {
  if (raw == null) return false
  if (typeof raw !== 'object') return true
  const keys = Object.keys(raw as object).filter((k) => k !== '_v')
  return keys.length > 0
}

async function legacyUnscopedPresent(storage: FlowlaryStorage): Promise<boolean> {
  for (const kind of Object.keys(ACCOUNT_OWNED) as AccountOwnedKind[]) {
    const raw = await storage.get(LEGACY_UNSCOPED_OWNED_KEYS[kind], 'local')
    if (hasMeaningfulPayload(raw)) return true
  }
  return false
}

/**
 * On first authenticated session after upgrade:
 * - If unscoped legacy exists and nothing claimed yet → copy into this account, tombstone unscoped.
 * - Otherwise mark quarantined so later accounts never inherit unscoped leftovers.
 */
export async function maybeClaimLegacyAccountData(
  storage: FlowlaryStorage,
  accountId: string,
  now = Date.now(),
): Promise<'claimed' | 'already_claimed' | 'quarantined' | 'noop'> {
  if (!isValidAccountId(accountId)) throw new Error('invalid_account_id')

  const meta = await readIsolationMeta(storage)
  if (meta.legacyClaimedByAccountId) {
    // Ensure unscoped leftovers cannot be read by anyone — tombstone if still present.
    await tombstoneUnscopedOwned(storage)
    return 'already_claimed'
  }
  if (meta.legacyQuarantinedAt != null) {
    await tombstoneUnscopedOwned(storage)
    return 'quarantined'
  }

  const present = await legacyUnscopedPresent(storage)
  if (!present) {
    await writeIsolationMeta(storage, {
      version: META_VERSION,
      legacyClaimedByAccountId: null,
      legacyQuarantinedAt: now,
    })
    return 'noop'
  }

  for (const kind of Object.keys(ACCOUNT_OWNED) as AccountOwnedKind[]) {
    const legacyKey = LEGACY_UNSCOPED_OWNED_KEYS[kind]
    const scopedKey = buildAccountScopedKey(accountId, kind)
    const legacyRaw = await storage.get(legacyKey, 'local')
    if (!hasMeaningfulPayload(legacyRaw)) continue
    const existing = await storage.get(scopedKey, 'local')
    if (!hasMeaningfulPayload(existing)) {
      // Copy raw envelope as-is via chrome set through FlowlaryStorage primitives.
      if (legacyRaw && typeof legacyRaw === 'object' && !Array.isArray(legacyRaw)) {
        await storage.set(scopedKey, legacyRaw as Record<string, unknown>, 'local')
      }
    }
  }

  await tombstoneUnscopedOwned(storage)
  await writeIsolationMeta(storage, {
    version: META_VERSION,
    legacyClaimedByAccountId: accountId,
    legacyQuarantinedAt: now,
  })
  return 'claimed'
}

async function tombstoneUnscopedOwned(storage: FlowlaryStorage): Promise<void> {
  for (const kind of Object.keys(ACCOUNT_OWNED) as AccountOwnedKind[]) {
    await storage.remove(LEGACY_UNSCOPED_OWNED_KEYS[kind], 'local')
  }
}
