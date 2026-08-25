import { STORAGE_KEYS } from '@flowlary/shared'

export type StorageArea = 'local' | 'sync'

export type StorageRecord<T> = {
  key: string
  area: StorageArea
  value: T
  version: number
}

const DEFAULT_VERSION = 1

async function readArea(area: StorageArea): Promise<Record<string, unknown>> {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    return {}
  }
  return chrome.storage[area].get(null) as Promise<Record<string, unknown>>
}

async function writeArea(area: StorageArea, key: string, value: unknown): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    return
  }
  await chrome.storage[area].set({ [key]: value })
}

function unwrapStored<T>(raw: unknown): T | undefined {
  if (raw == null) return undefined
  if (typeof raw !== 'object' || Array.isArray(raw)) return raw as T
  const record = raw as Record<string, unknown>
  if ('_v' in record && 'value' in record && Object.keys(record).length === 2) {
    return record.value as T
  }
  if ('_v' in record) {
    const { _v: _ignored, ...rest } = record
    return rest as T
  }
  return raw as T
}

function wrapStored(value: unknown): unknown {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return { value, _v: DEFAULT_VERSION }
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...(value as object), _v: DEFAULT_VERSION }
  }
  return { value, _v: DEFAULT_VERSION }
}

export class FlowlaryStorage {
  async get<T>(key: string, area: StorageArea = 'local'): Promise<T | undefined> {
    if (typeof chrome === 'undefined' || !chrome.storage) return undefined
    const result = await chrome.storage[area].get(key)
    return unwrapStored<T>(result[key])
  }

  async set<T extends Record<string, unknown>>(key: string, value: T, area: StorageArea = 'local'): Promise<void> {
    await writeArea(area, key, wrapStored(value))
  }

  async setPrimitive(key: string, value: string, area: StorageArea = 'local'): Promise<void> {
    await writeArea(area, key, wrapStored(value.trim()))
  }

  async remove(key: string, area: StorageArea = 'local'): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage) return
    await chrome.storage[area].remove(key)
  }

  async getNamespaceSnapshot(): Promise<Record<string, unknown>> {
    const local = await readArea('local')
    const sync = await readArea('sync')
    const namespaced: Record<string, unknown> = {}
    for (const [key, value] of Object.entries({ ...local, ...sync })) {
      if (key.startsWith('flowlary.')) {
        namespaced[key] = value
      }
    }
    return namespaced
  }

  keys = STORAGE_KEYS
}

export const flowlaryStorage = new FlowlaryStorage()

export {
  getSettings,
  setSettings,
  getCorrectionSettings,
  setCorrectionSettings,
  getTranslationSettings,
  setTranslationSettings,
  getLayoutSettings,
  setLayoutSettings,
  getLayoutProfile,
  setLayoutProfile,
  getEntitlement,
  setEntitlement,
  getLicenseKey,
  setLicenseKey,
  getMigrationState,
  setMigrationState,
  getEntitlementPublicView,
  createMigrationReader,
  ensureDefaultNamespaces,
} from './facade.ts'

export { hydrateStateFromStorage, getHydratedEntitlementView } from './hydrate.ts'

export {
  runStorageMigration,
  getMigrationDiagnostics,
  resetMigrationRunnerForTests,
} from './migration/runner.ts'

export { LEGACY_EWA, LEGACY_LINGO, LEGACY_LAYFIX, ALL_LEGACY_KEYS } from './legacyKeys.ts'

export {
  normalizeSettings,
  normalizeCorrection,
  normalizeTranslation,
  normalizeLayout,
  normalizeLayoutProfile,
  readStoredString,
} from './schemas.ts'

export {
  normalizeEntitlement,
  createDefaultEntitlement,
  resolveEntitlementStatus,
  canFeatureUseEntitlement,
  toPublicView,
  type FlowlaryEntitlement,
  type EntitlementPublicView,
} from './entitlement.ts'

/** @deprecated Use runStorageMigration — kept for compatibility. */
export async function migrateEWASettings(): Promise<void> {
  const { runStorageMigration } = await import('./migration/runner.ts')
  await runStorageMigration()
}

/** @deprecated Use runStorageMigration — kept for compatibility. */
export async function migrateLingoSettings(): Promise<void> {
  const { runStorageMigration } = await import('./migration/runner.ts')
  await runStorageMigration()
}

/** @deprecated Use runStorageMigration — kept for compatibility. */
export async function migrateLayfixSettings(): Promise<void> {
  const { runStorageMigration } = await import('./migration/runner.ts')
  await runStorageMigration()
}
