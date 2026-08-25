import { STORAGE_KEYS } from '@flowlary/shared'
import {
  stateManager,
  type CorrectionSettings,
  type FlowlarySettings,
  type LayoutSettings,
  type TranslationSettings,
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
import type { FlowlaryStorage } from './index.ts'

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
  const raw = await storage.get(storage.keys.correction, 'local')
  const groqApiKey = readStoredString(await storage.get(storage.keys.correctionGroqKey, 'local'))
  return normalizeCorrection(raw, groqApiKey)
}

export async function setCorrectionSettings(
  storage: FlowlaryStorage,
  value: CorrectionSettings,
): Promise<void> {
  const { groqApiKey, ...rest } = value
  await storage.set(storage.keys.correction, withVersion(rest), 'local')
  if (groqApiKey.trim()) {
    await storage.setPrimitive(storage.keys.correctionGroqKey, groqApiKey, 'local')
  } else {
    await storage.remove(storage.keys.correctionGroqKey, 'local')
  }
}

export async function getTranslationSettings(storage: FlowlaryStorage): Promise<TranslationSettings> {
  return normalizeTranslation(await storage.get(storage.keys.translation, 'local'))
}

export async function setTranslationSettings(
  storage: FlowlaryStorage,
  value: TranslationSettings,
): Promise<void> {
  await storage.set(storage.keys.translation, withVersion(value), 'local')
}

export async function getLayoutSettings(storage: FlowlaryStorage): Promise<LayoutSettings> {
  return normalizeLayout(await storage.get(storage.keys.layout, 'local'))
}

export async function setLayoutSettings(
  storage: FlowlaryStorage,
  value: LayoutSettings,
): Promise<void> {
  await storage.set(storage.keys.layout, withVersion(value), 'local')
}

export async function getLayoutProfile(storage: FlowlaryStorage): Promise<LayoutProfileState> {
  return normalizeLayoutProfileState(await storage.get(storage.keys.layoutProfile, 'local'))
}

export async function setLayoutProfile(
  storage: FlowlaryStorage,
  value: LayoutProfileState,
): Promise<void> {
  await storage.set(storage.keys.layoutProfile, withVersion(value as unknown as Record<string, unknown>), 'local')
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
  return normalizeHistoryPreserve(await storage.get(storage.keys.history, 'local'))
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
    getFlowlaryCorrection: () => getCorrectionSettings(storage),
    getFlowlaryGroqKey: async () =>
      readStoredString(await storage.get(storage.keys.correctionGroqKey, 'local')),
    setFlowlaryCorrection: (value: CorrectionSettings) => setCorrectionSettings(storage, value),
    setGroqKey: (key: string) => storage.setPrimitive(storage.keys.correctionGroqKey, key, 'local'),
    getFlowlaryHistory: () => getHistoryPreserve(storage),
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
    setFlowlaryTranslation: (value: TranslationSettings) => setTranslationSettings(storage, value),
    setFlowlarySettings: (value: FlowlarySettings) => setSettings(storage, value),
    getFlowlaryLayout: async () => {
      const raw = await storage.get(storage.keys.layout, 'local')
      if (!raw) return undefined
      return normalizeLayout(raw)
    },
    setFlowlaryLayout: (value: LayoutSettings) => setLayoutSettings(storage, value),
    hasFlowlaryLayout: async () => Boolean(await storage.get(storage.keys.layout, 'local')),
    hasFlowlaryLayoutProfile: async () => Boolean(await storage.get(storage.keys.layoutProfile, 'local')),
    getFlowlaryLayoutProfile: () => getLayoutProfile(storage),
    setFlowlaryLayoutProfile: (value: LayoutProfileState) => setLayoutProfile(storage, value),
    getFlowlaryEntitlement: () => getEntitlement(storage),
    setFlowlaryEntitlement: (value: FlowlaryEntitlement) => setEntitlement(storage, value),
    getFlowlaryLicenseKey: () => getLicenseKey(storage),
    setFlowlaryLicenseKey: (key: string, area: 'local' | 'sync') =>
      storage.setPrimitive(storage.keys.entitlementLicenseKey, key, area),
  }
}

export async function ensureDefaultNamespaces(storage: FlowlaryStorage, now = Date.now()): Promise<void> {
  if (!(await storage.get(storage.keys.settings, 'local'))) {
    await setSettings(storage, stateManager.settings)
  }
  if (!(await storage.get(storage.keys.correction, 'local'))) {
    const { groqApiKey: _k, ...rest } = stateManager.correction
    await storage.set(storage.keys.correction, withVersion(rest), 'local')
  }
  if (!(await storage.get(storage.keys.translation, 'local'))) {
    await setTranslationSettings(storage, stateManager.translation)
  }
  if (!(await storage.get(storage.keys.layout, 'local'))) {
    await setLayoutSettings(storage, stateManager.layout)
  }
  if (!(await storage.get(storage.keys.entitlement, 'local'))) {
    await setEntitlement(storage, createDefaultEntitlement(now))
  }
}

export { STORAGE_KEYS }
