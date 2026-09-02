import { vi } from 'vitest'
import { STORAGE_KEYS } from '@flowlary/shared'

type StorageArea = 'local' | 'sync'

export type MockChromeStorageWithListeners = {
  local: Record<string, unknown>
  sync: Record<string, unknown>
  install: () => void
  reset: () => void
  setLocal: (values: Record<string, unknown>) => Promise<void>
}

export function createMockChromeStorageWithListeners(
  seed: { local?: Record<string, unknown>; sync?: Record<string, unknown> } = {},
): MockChromeStorageWithListeners {
  const listeners = new Set<
    (changes: Record<string, chrome.storage.StorageChange>, area: StorageArea) => void
  >()

  const store: MockChromeStorageWithListeners = {
    local: { ...seed.local },
    sync: { ...seed.sync },
    install() {
      const areaHandler = (area: StorageArea) => ({
        get: vi.fn(async (keys: string | string[] | Record<string, unknown> | null) => {
          const data = store[area]
          if (keys == null) return { ...data }
          if (typeof keys === 'string') return { [keys]: data[keys] }
          if (Array.isArray(keys)) {
            const result: Record<string, unknown> = {}
            for (const key of keys) result[key] = data[key]
            return result
          }
          const result: Record<string, unknown> = {}
          for (const [key, fallback] of Object.entries(keys)) {
            result[key] = key in data ? data[key] : fallback
          }
          return result
        }),
        set: vi.fn(async (values: Record<string, unknown>) => {
          const changes: Record<string, chrome.storage.StorageChange> = {}
          for (const [key, value] of Object.entries(values)) {
            changes[key] = { oldValue: store[area][key], newValue: value }
            store[area][key] = value
          }
          for (const listener of listeners) listener(changes, area)
        }),
        remove: vi.fn(async (keys: string | string[]) => {
          const list = Array.isArray(keys) ? keys : [keys]
          const changes: Record<string, chrome.storage.StorageChange> = {}
          for (const key of list) {
            changes[key] = { oldValue: store[area][key], newValue: undefined }
            delete store[area][key]
          }
          for (const listener of listeners) listener(changes, area)
        }),
      })

      vi.stubGlobal('chrome', {
        runtime: {
          onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
          onInstalled: { addListener: vi.fn() },
          sendMessage: vi.fn(),
          id: 'test-extension',
        },
        commands: { onCommand: { addListener: vi.fn() } },
        tabs: {
          query: vi.fn().mockResolvedValue([]),
          sendMessage: vi.fn().mockResolvedValue(undefined),
        },
        storage: {
          local: areaHandler('local'),
          sync: areaHandler('sync'),
          onChanged: {
            addListener: vi.fn((listener: typeof listeners extends Set<infer L> ? L : never) => {
              listeners.add(listener)
            }),
            removeListener: vi.fn((listener: typeof listeners extends Set<infer L> ? L : never) => {
              listeners.delete(listener)
            }),
          },
        },
      })
    },
    reset() {
      store.local = { ...seed.local }
      store.sync = { ...seed.sync }
      listeners.clear()
    },
    async setLocal(values: Record<string, unknown>) {
      await chrome.storage.local.set(values)
    },
  }

  return store
}

export async function simulateAuthAccountAttach(
  store: MockChromeStorageWithListeners,
  accountId: string,
): Promise<void> {
  await store.setLocal({
    [STORAGE_KEYS.authAccountId]: { value: accountId, _v: 1 },
  })
}
