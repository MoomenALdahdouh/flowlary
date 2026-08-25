import type { OperationType } from './types.ts'

export type CacheEntry<T = unknown> = {
  value: T
  createdAt: number
  expiresAt: number
}

/** Cache key parts — operation type is mandatory for isolation. */
export type CacheKeyParts = {
  operation: OperationType
  text: string
  sourceLanguage?: string
  targetLanguage?: string
  layoutSource?: string
  layoutCandidates?: string[]
}

export function buildCacheKey(parts: CacheKeyParts): string {
  const { operation, text, sourceLanguage, targetLanguage, layoutSource, layoutCandidates } =
    parts
  switch (operation) {
    case 'CORRECT':
      return `CORRECT:${hashString(text)}`
    case 'TRANSLATE':
      return `TRANSLATE:${hashString(text)}:${sourceLanguage ?? ''}:${targetLanguage ?? ''}`
    case 'FIX_LAYOUT': {
      const layouts = (layoutCandidates ?? []).slice().sort().join(',')
      return `FIX_LAYOUT:${hashString(text)}:${layoutSource ?? ''}:${layouts}`
    }
    case 'PIPELINE':
      return `PIPELINE:${hashString(text)}`
    default:
      return `${operation}:${hashString(text)}`
  }
}

function hashString(value: string): string {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16)
}

export interface CacheCoordinator {
  get<T>(key: string): T | undefined
  set<T>(key: string, value: T, ttlMs?: number): void
  has(key: string): boolean
  delete(key: string): void
  clear(operation?: OperationType): void
  buildKey(parts: CacheKeyParts): string
}

export function createMemoryCacheCoordinator(defaultTtlMs = 60_000): CacheCoordinator {
  const store = new Map<string, CacheEntry>()

  return {
    buildKey: buildCacheKey,

    get<T>(key: string): T | undefined {
      const entry = store.get(key)
      if (!entry) return undefined
      if (Date.now() > entry.expiresAt) {
        store.delete(key)
        return undefined
      }
      return entry.value as T
    },

    set<T>(key: string, value: T, ttlMs = defaultTtlMs): void {
      const now = Date.now()
      store.set(key, { value, createdAt: now, expiresAt: now + ttlMs })
    },

    has(key: string): boolean {
      return this.get(key) !== undefined
    },

    delete(key: string): void {
      store.delete(key)
    },

    clear(operation?: OperationType): void {
      if (!operation) {
        store.clear()
        return
      }
      const prefix = `${operation}:`
      for (const key of store.keys()) {
        if (key.startsWith(prefix)) store.delete(key)
      }
    },
  }
}
