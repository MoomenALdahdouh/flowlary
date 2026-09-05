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
import { applyUserPolicyToMemory, resolveWritingPolicy } from '../core/policy/writingPolicy.ts'
import { hydrateStateFromStorage } from './hydrate.ts'
import {
  setCorrectionSettings,
  setLayoutSettings,
  setSettings,
  setTranslationSettings,
} from './facade.ts'
import {
  buildAccountScopedKey,
  type AccountOwnedKind,
} from './accountScopedStorage.ts'
import type {
  CorrectionSettings,
  LayoutSettings,
  TranslationSettings,
} from '../core/state/StateManager.ts'
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

type PreAuthAccountState = {
  correction: CorrectionSettings
  translation: TranslationSettings
  layout: LayoutSettings
}

function hasMeaningfulAccountPayload(raw: unknown): boolean {
  if (raw == null) return false
  if (typeof raw !== 'object') return true
  const keys = Object.keys(raw as object).filter((key) => key !== '_v')
  return keys.length > 0
}

async function accountOwnedKeyPresent(
  storage: FlowlaryStorage,
  accountId: string,
  kind: AccountOwnedKind,
): Promise<boolean> {
  const raw = await storage.get(buildAccountScopedKey(accountId, kind), 'local')
  return hasMeaningfulAccountPayload(raw)
}

async function persistProjectedAccountWritingState(storage: FlowlaryStorage): Promise<void> {
  await setSettings(storage, stateManager.settings)
  await setCorrectionSettings(storage, stateManager.correction)
  await setTranslationSettings(storage, stateManager.translation)
  await setLayoutSettings(storage, stateManager.layout)
}

function mergePreAuthAccountState(
  preAuth: PreAuthAccountState,
  hadCorrection: boolean,
  hadTranslation: boolean,
  hadLayout: boolean,
): void {
  if (!hadCorrection) {
    Object.assign(stateManager.correction, preAuth.correction)
  } else if (preAuth.correction.consentAccepted) {
    stateManager.correction.consentAccepted = true
  }

  if (!hadTranslation) {
    Object.assign(stateManager.translation, preAuth.translation)
  } else if (preAuth.translation.liveEnabled) {
    stateManager.translation = {
      ...stateManager.translation,
      liveEnabled: true,
      mode: preAuth.translation.mode,
      sourceLanguage: preAuth.translation.sourceLanguage,
      targetLanguage: preAuth.translation.targetLanguage,
    }
  }

  if (!hadLayout) {
    Object.assign(stateManager.layout, preAuth.layout)
  }

  applyUserPolicyToMemory(resolveWritingPolicy())
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

  // Anonymous SET_CORRECTION / SET_TRANSLATION update SW memory only; capture before hydrate.
  const preAuth: PreAuthAccountState | null = !previousId
    ? {
        correction: { ...stateManager.correction },
        translation: { ...stateManager.translation },
        layout: { ...stateManager.layout },
      }
    : null

  activeAccountContext.activate(accountId)
  const [hadCorrection, hadTranslation, hadLayout] = await Promise.all([
    accountOwnedKeyPresent(storage, accountId, 'correction'),
    accountOwnedKeyPresent(storage, accountId, 'translation'),
    accountOwnedKeyPresent(storage, accountId, 'layout'),
  ])
  const claim = await maybeClaimLegacyAccountData(storage, accountId)
  resetAccountBoundServices()
  await hydrateStateFromStorage(storage)

  // Claimed unscoped EWA/Lingo/Layfix is the source of truth. Do not overlay
  // anonymous in-memory defaults (improveEnglish: true) on top of it.
  if (preAuth && claim !== 'claimed') {
    mergePreAuthAccountState(preAuth, hadCorrection, hadTranslation, hadLayout)
  }

  await persistProjectedAccountWritingState(storage)
  // Publish auth last so content scripts hydrate once account-owned keys exist.
  await storage.setPrimitive(STORAGE_KEYS.authAccountId, accountId, 'local')
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
