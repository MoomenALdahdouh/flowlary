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

export class FlowlaryStorage {
  async get<T>(key: string, area: StorageArea = 'local'): Promise<T | undefined> {
    if (typeof chrome === 'undefined' || !chrome.storage) return undefined
    const result = await chrome.storage[area].get(key)
    return result[key] as T | undefined
  }

  async set<T>(key: string, value: T, area: StorageArea = 'local'): Promise<void> {
    await writeArea(area, key, { ...(value as object), _v: DEFAULT_VERSION })
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

/** Migration stubs — implemented in Phase 10. */
export async function migrateEWASettings(): Promise<void> {
  /* Phase 10 */
}

export async function migrateLingoSettings(): Promise<void> {
  /* Phase 10 */
}

export async function migrateLayfixSettings(): Promise<void> {
  /* Phase 10 */
}
