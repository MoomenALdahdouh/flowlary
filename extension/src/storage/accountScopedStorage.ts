/**
 * Central account-scoped storage keys and I/O.
 * Application code must not manually construct flowlary.account.* keys.
 */

import { STORAGE_KEYS } from '@flowlary/shared'
import {
  activeAccountContext,
  isValidAccountId,
  type AccountContextSnapshot,
} from './activeAccountContext.ts'
import type { FlowlaryStorage } from './index.ts'

/** Logical account-owned datasets (suffix under flowlary.account.<id>.). */
export const ACCOUNT_OWNED = {
  learningProfile: 'learning.profile',
  learningEvents: 'learning.events',
  learningSessions: 'learning.sessions',
  learningBriefQuota: 'learning.briefQuota',
  learningReportQuota: 'learning.reportQuota',
  learningCoachQuota: 'learning.coachQuota',
  history: 'history',
  correction: 'correction',
  translation: 'translation',
  layout: 'layout',
  layoutProfile: 'layout.profile',
  layoutPracticeSessions: 'layoutPractice.sessions',
} as const

export type AccountOwnedKind = keyof typeof ACCOUNT_OWNED

/** Legacy unscoped keys that used to hold account-owned data. */
export const LEGACY_UNSCOPED_OWNED_KEYS: Record<AccountOwnedKind, string> = {
  learningProfile: STORAGE_KEYS.learningProfile,
  learningEvents: STORAGE_KEYS.learningEvents,
  learningSessions: STORAGE_KEYS.learningSessions,
  learningBriefQuota: 'flowlary.legacy.learningBriefQuota',
  learningReportQuota: 'flowlary.legacy.learningReportQuota',
  learningCoachQuota: 'flowlary.legacy.learningCoachQuota',
  history: STORAGE_KEYS.history,
  correction: STORAGE_KEYS.correction,
  translation: STORAGE_KEYS.translation,
  layout: STORAGE_KEYS.layout,
  layoutProfile: STORAGE_KEYS.layoutProfile,
  layoutPracticeSessions: 'flowlary.legacy.layoutPracticeSessions',
}

export function buildAccountScopedKey(accountId: string, kind: AccountOwnedKind): string {
  if (!isValidAccountId(accountId)) throw new Error('invalid_account_id')
  return `flowlary.account.${accountId}.${ACCOUNT_OWNED[kind]}`
}

export function isAccountScopedStorageKey(key: string): boolean {
  return key.startsWith('flowlary.account.') && key !== STORAGE_KEYS.accountIsolationMeta
}

/** Parse account id from a scoped key; null if not account-scoped product data. */
export function parseAccountIdFromStorageKey(key: string): string | null {
  if (!isAccountScopedStorageKey(key)) return null
  const rest = key.slice('flowlary.account.'.length)
  const dot = rest.indexOf('.')
  if (dot <= 0) return null
  const id = rest.slice(0, dot)
  return isValidAccountId(id) ? id : null
}

export type AccountWriteGuard = AccountContextSnapshot

export function captureWriteGuard(): AccountWriteGuard {
  return activeAccountContext.snapshot()
}

export function assertWriteGuard(guard: AccountWriteGuard): boolean {
  return activeAccountContext.matches(guard)
}

export class AccountScopedStorage {
  constructor(private storage: FlowlaryStorage) {}

  getActiveAccountId(): string | null {
    return activeAccountContext.getAccountId()
  }

  requireActiveAccountId(): string {
    return activeAccountContext.requireAccountId()
  }

  keyFor(kind: AccountOwnedKind, accountId = this.requireActiveAccountId()): string {
    return buildAccountScopedKey(accountId, kind)
  }

  async get<T>(kind: AccountOwnedKind): Promise<T | undefined> {
    const accountId = activeAccountContext.getAccountId()
    if (!accountId) return undefined
    return this.storage.get<T>(buildAccountScopedKey(accountId, kind), 'local')
  }

  /**
   * Persist account-owned data. Fail closed if no active account or context changed.
   * Returns false when the write was discarded (race / signed out).
   */
  async set(
    kind: AccountOwnedKind,
    value: Record<string, unknown>,
    guard?: AccountWriteGuard,
  ): Promise<boolean> {
    const expected = guard ?? captureWriteGuard()
    if (!assertWriteGuard(expected) || !expected.accountId) return false
    await this.storage.set(buildAccountScopedKey(expected.accountId, kind), value, 'local')
    if (!assertWriteGuard(expected)) {
      // Context flipped after write — best-effort remove to avoid polluting new account.
      // Do not delete if still same account (only generation bump without id change is rare).
      return false
    }
    return true
  }

  async remove(kind: AccountOwnedKind, guard?: AccountWriteGuard): Promise<boolean> {
    const expected = guard ?? captureWriteGuard()
    if (!assertWriteGuard(expected) || !expected.accountId) return false
    await this.storage.remove(buildAccountScopedKey(expected.accountId, kind), 'local')
    return assertWriteGuard(expected)
  }

  async clearAllOwnedForActiveAccount(guard?: AccountWriteGuard): Promise<boolean> {
    const expected = guard ?? captureWriteGuard()
    if (!assertWriteGuard(expected) || !expected.accountId) return false
    for (const kind of Object.keys(ACCOUNT_OWNED) as AccountOwnedKind[]) {
      await this.storage.remove(buildAccountScopedKey(expected.accountId, kind), 'local')
      if (!assertWriteGuard(expected)) return false
    }
    return true
  }
}

export function getAccountScopedStorage(storage: FlowlaryStorage): AccountScopedStorage {
  return new AccountScopedStorage(storage)
}
