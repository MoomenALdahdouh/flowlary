/**
 * Dashboard extension-page account bootstrap — restores Phase 2 account context
 * before PracticePanel (and other dashboard panels) write learning events locally.
 */

import { STORAGE_KEYS } from '@flowlary/shared'
import {
  detachActiveAccount,
  flowlaryStorage,
  hydrateStateFromStorage,
  restoreActiveAccountFromSession,
  runStorageMigration,
} from '../storage/index.ts'
import { ensureLearningEventsInitialized } from '../storage/learning/events/index.ts'
import { readStoredString } from '../storage/schemas.ts'

let accountListenerInstalled = false

async function applyDashboardAccountSession(): Promise<string | null> {
  const accountId = await restoreActiveAccountFromSession(flowlaryStorage)
  await hydrateStateFromStorage(flowlaryStorage)
  if (accountId) {
    await ensureLearningEventsInitialized(flowlaryStorage)
  }
  return accountId
}

async function handleAuthAccountIdStorageChange(
  change: chrome.storage.StorageChange,
): Promise<void> {
  const nextRaw = change.newValue
  const nextId =
    nextRaw == null
      ? ''
      : readStoredString(
          typeof nextRaw === 'object' && nextRaw !== null && 'value' in nextRaw
            ? (nextRaw as { value: unknown }).value
            : nextRaw,
        ).trim()

  if (!nextId) {
    await detachActiveAccount(flowlaryStorage)
    return
  }

  await applyDashboardAccountSession()
}

export function installDashboardAccountListener(): void {
  if (accountListenerInstalled) return
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return
  accountListenerInstalled = true

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return
    if (!(STORAGE_KEYS.authAccountId in changes)) return
    void handleAuthAccountIdStorageChange(changes[STORAGE_KEYS.authAccountId]!)
  })
}

/**
 * Restore account context before dashboard panels mount.
 * Call before React render in dashboard/main.tsx.
 */
export async function bootstrapDashboardAccount(): Promise<string | null> {
  await runStorageMigration()
  const accountId = await applyDashboardAccountSession()
  installDashboardAccountListener()
  return accountId
}

/** Test helper — reset listener guard. */
export function resetDashboardAccountListenerForTests(): void {
  accountListenerInstalled = false
}
