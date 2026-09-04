import { STORAGE_KEYS } from '@flowlary/shared'
import {
  stateManager,
  type CorrectionSettings,
  type FlowlarySettings,
  type LayoutSettings,
  type TranslationSettings,
  DEFAULT_CORRECTION,
  DEFAULT_LAYOUT,
  DEFAULT_TRANSLATION,
} from '../core/state/StateManager.ts'
import { normalizeLayoutProfileState, type LayoutProfileState } from '../features/layout/profile/index.ts'
import {
  createDefaultEntitlement,
  normalizeEntitlement,
  toPublicView,
  type FlowlaryEntitlement,
} from './entitlement.ts'
import {
  normalizeMigrationState,
  type MigrationState,
} from './migration/types.ts'
import {
  normalizeCorrection,
  normalizeHistoryPreserve,
  normalizeLayout,
  normalizeSettings,
  normalizeTranslation,
  readStoredString,
  withVersion,
  type FlowlaryHistoryPreserve,
} from './schemas.ts'
import {
  getHistoryService,
  normalizeHistoryStore,
  type HistoryEntry,
  type HistoryStats,
} from './history/index.ts'
import type { FlowlaryStorage } from './index.ts'
import { getAccountScopedStorage } from './accountScopedStorage.ts'
import { activeAccountContext } from './activeAccountContext.ts'

export async function getSettings(storage: FlowlaryStorage): Promise<FlowlarySettings> {
  const raw = await storage.get(storage.keys.settings, 'local')
  return normalizeSettings(raw)
}

export async function setSettings(
  storage: FlowlaryStorage,
  value: FlowlarySettings,
): Promise<void> {
  await storage.set(storage.keys.settings, withVersion(value), 'local')
}

export async function getCorrectionSettings(storage: FlowlaryStorage): Promise<CorrectionSettings> {
  if (!activeAccountContext.getAccountId()) return { ...DEFAULT_CORRECTION }
  const raw = await getAccountScopedStorage(storage).get('correction')
  return normalizeCorrection(raw)
}

export async function setCorrectionSettings(
  storage: FlowlaryStorage,
  value: CorrectionSettings,
): Promise<void> {
  await storage.remove(storage.keys.correctionGroqKey, 'local')
  if (!activeAccountContext.getAccountId()) return
  await getAccountScopedStorage(storage).set('correction', withVersion(value))
}

export async function getTranslationSettings(storage: FlowlaryStorage): Promise<TranslationSettings> {
  if (!activeAccountContext.getAccountId()) {
    const raw = await storage.get(STORAGE_KEYS.translation, 'local')
    return normalizeTranslation(raw ?? DEFAULT_TRANSLATION)
  }
  return normalizeTranslation(await getAccountScopedStorage(storage).get('translation'))
}

export async function setTranslationSettings(
  storage: FlowlaryStorage,
  value: TranslationSettings,
): Promise<void> {
  if (!activeAccountContext.getAccountId()) {
    await storage.set(STORAGE_KEYS.translation, withVersion(value), 'local')
    return
  }
  await getAccountScopedStorage(storage).set('translation', withVersion(value))
}

export async function getLayoutSettings(storage: FlowlaryStorage): Promise<LayoutSettings> {
  if (!activeAccountContext.getAccountId()) return { ...DEFAULT_LAYOUT }
  return normalizeLayout(await getAccountScopedStorage(storage).get('layout'))
}

export async function setLayoutSettings(
  storage: FlowlaryStorage,
  value: LayoutSettings,
): Promise<void> {
  await getAccountScopedStorage(storage).set('layout', withVersion(value))
}

export async function getLayoutProfile(storage: FlowlaryStorage): Promise<LayoutProfileState> {
  if (!activeAccountContext.getAccountId()) return normalizeLayoutProfileState(undefined)
  return normalizeLayoutProfileState(await getAccountScopedStorage(storage).get('layoutProfile'))
}

export async function setLayoutProfile(
  storage: FlowlaryStorage,
  value: LayoutProfileState,
): Promise<void> {
  await getAccountScopedStorage(storage).set(
    'layoutProfile',
    withVersion(value as unknown as Record<string, unknown>),
  )
}

export async function getEntitlement(storage: FlowlaryStorage, now = Date.now()): Promise<FlowlaryEntitlement> {
  const raw = await storage.get(storage.keys.entitlement, 'local')
  return normalizeEntitlement(raw, now)
}

export async function setEntitlement(
  storage: FlowlaryStorage,
  value: FlowlaryEntitlement,
): Promise<void> {
  await storage.set(storage.keys.entitlement, value, 'local')
}

export async function getLicenseKey(storage: FlowlaryStorage): Promise<string> {
  const sync = readStoredString(await storage.get(storage.keys.entitlementLicenseKey, 'sync'))
  if (sync) return sync
  return readStoredString(await storage.get(storage.keys.entitlementLicenseKey, 'local'))
}

export async function setLicenseKey(storage: FlowlaryStorage, key: string): Promise<void> {
  const trimmed = key.trim()
  if (trimmed) {
    await storage.setPrimitive(storage.keys.entitlementLicenseKey, trimmed, 'sync')
  } else {
    await storage.remove(storage.keys.entitlementLicenseKey, 'sync')
    await storage.remove(storage.keys.entitlementLicenseKey, 'local')
  }
}

export async function getHistoryPreserve(storage: FlowlaryStorage): Promise<FlowlaryHistoryPreserve> {
  if (!activeAccountContext.getAccountId()) return normalizeHistoryPreserve(undefined)
  return normalizeHistoryPreserve(await getAccountScopedStorage(storage).get('history'))
}

export async function getHistory(storage: FlowlaryStorage): Promise<HistoryEntry[]> {
  if (!activeAccountContext.getAccountId()) return []
  const service = getHistoryService(storage)
  await service.initialize()
  return service.list()
}

export async function getHistoryStats(storage: FlowlaryStorage): Promise<HistoryStats> {
  if (!activeAccountContext.getAccountId()) {
    return { total: 0, byOperation: { CORRECT: 0, TRANSLATE: 0, FIX_LAYOUT: 0 } }
  }
  const service = getHistoryService(storage)
  await service.initialize()
  return service.getStats()
}

export async function removeHistoryEntry(storage: FlowlaryStorage, id: string): Promise<boolean> {
  if (!activeAccountContext.getAccountId()) return false
  const service = getHistoryService(storage)
  await service.initialize()
  return service.remove(id)
}

export async function clearHistory(storage: FlowlaryStorage): Promise<void> {
  if (!activeAccountContext.getAccountId()) return
  const service = getHistoryService(storage)
  await service.initialize()
  await service.clear()
}

export async function getUnifiedHistoryStore(storage: FlowlaryStorage) {
  if (!activeAccountContext.getAccountId()) return normalizeHistoryStore(undefined)
  const raw = await getAccountScopedStorage(storage).get('history')
  return normalizeHistoryStore(raw)
}

export async function getMigrationState(storage: FlowlaryStorage): Promise<MigrationState> {
  const raw = await storage.get(storage.keys.migrations, 'local')
  return normalizeMigrationState(raw)
}

export async function setMigrationState(storage: FlowlaryStorage, state: MigrationState): Promise<void> {
  await storage.set(storage.keys.migrations, withVersion(state as unknown as Record<string, unknown>), 'local')
}

export async function getEntitlementPublicView(storage: FlowlaryStorage, now = Date.now()) {
  const entitlement = await getEntitlement(storage, now)
  const hasLicenseKey = Boolean((await getLicenseKey(storage)).trim())
  return toPublicView(entitlement, hasLicenseKey, now)
}

export function createMigrationReader(storage: FlowlaryStorage) {
  return {
    getLocal: <T,>(key: string) => storage.get<T>(key, 'local'),
    getSync: <T,>(key: string) => storage.get<T>(key, 'sync'),
    hasFlowlaryCorrection: async () =>
      Boolean(await storage.get(storage.keys.correction, 'local')),
    hasFlowlaryGroqKey: async () =>
      Boolean(await storage.get(storage.keys.correctionGroqKey, 'local')),
    getFlowlaryCorrection: async () =>
      normalizeCorrection(await storage.get(storage.keys.correction, 'local')),
    getFlowlaryGroqKey: async () =>
      readStoredString(await storage.get(storage.keys.correctionGroqKey, 'local')),
    setFlowlaryCorrection: async (value: CorrectionSettings) => {
      await storage.set(storage.keys.correction, withVersion(value), 'local')
      await storage.remove(storage.keys.correctionGroqKey, 'local')
    },
    setGroqKey: (key: string) => storage.setPrimitive(storage.keys.correctionGroqKey, key, 'local'),
    getFlowlaryHistory: async () =>
      normalizeHistoryPreserve(await storage.get(storage.keys.history, 'local')),
    setFlowlaryHistory: async (value: FlowlaryHistoryPreserve) => {
      await storage.set(storage.keys.history, value, 'local')
    },
    getFlowlaryTranslation: async () => {
      const raw = await storage.get(storage.keys.translation, 'local')
      if (!raw) return undefined
      return normalizeTranslation(raw)
    },
    hasFlowlaryTranslation: async () => Boolean(await storage.get(storage.keys.translation, 'local')),
    hasFlowlarySettings: async () => Boolean(await storage.get(storage.keys.settings, 'local')),
    getFlowlarySettings: () => getSettings(storage),
    setFlowlaryTranslation: async (value: TranslationSettings) => {
      await storage.set(storage.keys.translation, withVersion(value), 'local')
    },
    setFlowlarySettings: (value: FlowlarySettings) => setSettings(storage, value),
    getFlowlaryLayout: async () => {
      const raw = await storage.get(storage.keys.layout, 'local')
      if (!raw) return undefined
      return normalizeLayout(raw)
    },
    setFlowlaryLayout: async (value: LayoutSettings) => {
      await storage.set(storage.keys.layout, withVersion(value), 'local')
    },
    hasFlowlaryLayout: async () => Boolean(await storage.get(storage.keys.layout, 'local')),
    hasFlowlaryLayoutProfile: async () => Boolean(await storage.get(storage.keys.layoutProfile, 'local')),
    getFlowlaryLayoutProfile: async () =>
      normalizeLayoutProfileState(await storage.get(storage.keys.layoutProfile, 'local')),
    setFlowlaryLayoutProfile: async (value: LayoutProfileState) => {
      await storage.set(
        storage.keys.layoutProfile,
        withVersion(value as unknown as Record<string, unknown>),
        'local',
      )
    },
    getFlowlaryEntitlement: () => getEntitlement(storage),
    setFlowlaryEntitlement: (value: FlowlaryEntitlement) => setEntitlement(storage, value),
    getFlowlaryLicenseKey: () => getLicenseKey(storage),
    setFlowlaryLicenseKey: (key: string, area: 'local' | 'sync') =>
      storage.setPrimitive(storage.keys.entitlementLicenseKey, key, area),
  }
}

export async function ensureDefaultNamespaces(storage: FlowlaryStorage, now = Date.now()): Promise<void> {
  // Device-scoped defaults only. Account-owned namespaces are created lazily on login.
  if (!(await storage.get(storage.keys.settings, 'local'))) {
    await setSettings(storage, stateManager.settings)
  }
  if (!(await storage.get(storage.keys.entitlement, 'local'))) {
    await setEntitlement(storage, createDefaultEntitlement(now))
  }
}

export { STORAGE_KEYS }
