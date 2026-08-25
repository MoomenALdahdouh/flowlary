import { vi } from 'vitest'

type StorageArea = 'local' | 'sync'

export type MockChromeStorage = {
  local: Record<string, unknown>
  sync: Record<string, unknown>
  install: () => void
  reset: () => void
}

export function createMockChromeStorage(
  seed: { local?: Record<string, unknown>; sync?: Record<string, unknown> } = {},
): MockChromeStorage {
  const store: MockChromeStorage = {
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
          Object.assign(store[area], values)
        }),
        remove: vi.fn(async (keys: string | string[]) => {
          const list = Array.isArray(keys) ? keys : [keys]
          for (const key of list) delete store[area][key]
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
        },
      })
    },
    reset() {
      store.local = { ...seed.local }
      store.sync = { ...seed.sync }
    },
  }

  return store
}

export function getStored(local: Record<string, unknown>, key: string): unknown {
  return local[key]
}
