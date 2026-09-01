/**
 * Account session attach/detach — ownership transition for local product state.
 */

import { STORAGE_KEYS } from '@flowlary/shared'
import {
  DEFAULT_CORRECTION,
  DEFAULT_LAYOUT,
  DEFAULT_TRANSLATION,
  stateManager,
} from '../core/state/StateManager.ts'
import { getFlowlaryCache, resetAiRequestCoalescers } from './cache/index.ts'
import { activeAccountContext, isValidAccountId } from './activeAccountContext.ts'
import { maybeClaimLegacyAccountData } from './accountIsolationMigration.ts'
import { hydrateStateFromStorage } from './hydrate.ts'
import { resetHistoryServiceForTests } from './history/index.ts'
import type { FlowlaryStorage } from './index.ts'
import { resetLearningEventServiceForTests } from './learning/events/index.ts'
import { resetPracticeSessionStoreForTests } from './learning/practice/sessions.ts'
import { readStoredString } from './schemas.ts'

function resetAccountBoundServices(): void {
  resetHistoryServiceForTests()
  resetLearningEventServiceForTests()
  resetPracticeSessionStoreForTests()
}


async function clearAiSessionBestEffort(storage: FlowlaryStorage): Promise<void> {
  resetAiRequestCoalescers()
  await clearAiCacheBestEffort(storage)
}

async function clearAiCacheBestEffort(storage: FlowlaryStorage): Promise<void> {
  try {
    const cache = getFlowlaryCache(storage)
    await cache.initialize()
    await cache.clear()
  } catch {
    /* cache clear best-effort */
  }
}

/**
 * Attach authenticated account as the active local owner.
 * Claims legacy unscoped data at most once. Hydrates StateManager from account namespace.
 * Clears shared AI cache when switching between accounts so prior outputs cannot leak.
 */
export async function attachActiveAccount(
  storage: FlowlaryStorage,
  accountId: string,
): Promise<void> {
  if (!isValidAccountId(accountId)) throw new Error('invalid_account_id')
  const previousId = activeAccountContext.getAccountId()
  if (previousId !== accountId) {
    await clearAiSessionBestEffort(storage)
  } else {
    resetAiRequestCoalescers()
  }
  activeAccountContext.activate(accountId)
  await storage.setPrimitive(STORAGE_KEYS.authAccountId, accountId, 'local')
  await maybeClaimLegacyAccountData(storage, accountId)
  resetAccountBoundServices()
  await hydrateStateFromStorage(storage)
}

/**
 * Detach active account on logout. Does not delete account-scoped chrome.storage.
 * Clears in-memory product state and AI cache so prior account data is not visible.
 */
export async function detachActiveAccount(storage: FlowlaryStorage): Promise<void> {
  activeAccountContext.clear()
  await storage.remove(STORAGE_KEYS.authAccountId, 'local')

  stateManager.correction = { ...DEFAULT_CORRECTION }
  stateManager.translation = { ...DEFAULT_TRANSLATION }
  stateManager.layout = { ...DEFAULT_LAYOUT }

  resetAccountBoundServices()
  await clearAiSessionBestEffort(storage)
}

/**
 * Restore active context from persisted authAccountId (SW restart while signed in).
 */
export async function restoreActiveAccountFromSession(
  storage: FlowlaryStorage,
): Promise<string | null> {
  const id = readStoredString(await storage.get(STORAGE_KEYS.authAccountId, 'local')).trim()
  if (!id || !isValidAccountId(id)) {
    if (activeAccountContext.getAccountId()) activeAccountContext.clear()
    return null
  }
  if (activeAccountContext.getAccountId() === id) return id
  const previousId = activeAccountContext.getAccountId()
  if (previousId !== id) {
    await clearAiSessionBestEffort(storage)
  }
  activeAccountContext.activate(id)
  await maybeClaimLegacyAccountData(storage, id)
  resetAccountBoundServices()
  return id
}
