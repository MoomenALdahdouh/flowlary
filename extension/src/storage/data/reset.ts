import type { FlowlaryStorage } from '../index.ts'
import {
  clearHistory,
  ensureDefaultNamespaces,
  setCorrectionSettings,
  setEntitlement,
  setLayoutProfile,
  setLayoutSettings,
  setSettings,
  setTranslationSettings,
} from '../facade.ts'
import { createDefaultEntitlement } from '../entitlement.ts'
import { clearLearningEvents } from '../learning/events/index.ts'
import { resetLearningProfile, setLearningInstallKind } from '../learning/index.ts'
import {
  DEFAULT_CORRECTION,
  DEFAULT_LAYOUT,
  DEFAULT_SETTINGS,
  DEFAULT_TRANSLATION,
  stateManager,
} from '../../core/state/StateManager.ts'
import { normalizeLayoutProfileState } from '../../features/layout/profile/index.ts'
import { getFlowlaryCache } from '../cache/index.ts'
import { clearAccountSession } from '../../config/accountAuth.ts'
import { retireByokIfNeeded } from '../retireByok.ts'
import { activeAccountContext } from '../activeAccountContext.ts'

/**
 * Removes local Flowlary product data for the **active account** (and device defaults).
 * Does not delete the server account. Does not touch other accounts' namespaces.
 */
export async function resetLocalFlowlaryData(storage: FlowlaryStorage, now = Date.now()): Promise<void> {
  const hadAccount = Boolean(activeAccountContext.getAccountId())

  if (hadAccount) {
    await clearHistory(storage)
    await clearLearningEvents(storage)
    await resetLearningProfile(storage)
    await setCorrectionSettings(storage, { ...DEFAULT_CORRECTION })
    await setTranslationSettings(storage, { ...DEFAULT_TRANSLATION })
    await setLayoutSettings(storage, { ...DEFAULT_LAYOUT })
    await setLayoutProfile(storage, normalizeLayoutProfileState(undefined))
  }

  await setLearningInstallKind(storage, 'fresh')

  stateManager.settings = { ...DEFAULT_SETTINGS }
  stateManager.correction = { ...DEFAULT_CORRECTION }
  stateManager.translation = { ...DEFAULT_TRANSLATION }
  stateManager.layout = { ...DEFAULT_LAYOUT }

  await setSettings(storage, stateManager.settings)
  await setEntitlement(storage, createDefaultEntitlement(now))

  const cache = getFlowlaryCache(storage)
  await cache.initialize()
  await cache.clear()

  // Account session cleared — owned namespaces for prior account remain on disk for re-login.
  await clearAccountSession(storage)
  await retireByokIfNeeded(storage)
  await ensureDefaultNamespaces(storage, now)
}
