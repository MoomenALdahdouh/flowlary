import type { OperationType } from './types.ts'

/** Bumped when TRANSLATE/CORRECT keys gained accountId isolation (Phase 2). */
export const CACHE_SCHEMA_VERSION = 4 as const
export const MAX_CACHE_ENTRIES = 200
export const MAX_CACHE_TEXT_LENGTH = 2_000

export const CACHE_TTL_MS: Record<'CORRECT' | 'TRANSLATE' | 'FIX_LAYOUT', number> = {
  CORRECT: 15 * 60_000,
  TRANSLATE: 60 * 60_000,
  FIX_LAYOUT: 24 * 60 * 60_000,
}

export type CacheEntry<T = unknown> = {
  value: T
  createdAt: number
  expiresAt: number
}

export type PersistentCacheRecord = {
  key: string
  operation: OperationType
  value: unknown
  createdAt: number
  expiresAt: number
  lastAccessAt: number
}

export type PersistentCacheStoreV1 = {
  version: typeof CACHE_SCHEMA_VERSION
  entries: PersistentCacheRecord[]
}

export type CacheMetrics = {
  cache_l1_hits: number
  cache_l1_misses: number
  cache_l2_hits: number
  cache_l2_misses: number
  cache_expired: number
  cache_evictions: number
  cache_invalid: number
  cache_writes: number
  request_coalesced: number
  ai_requests_correct: number
  ai_requests_translate: number
  ai_requests_layout_classify: number
  ai_requests_avoided: number
}

export function createCacheMetrics(): CacheMetrics {
  return {
    cache_l1_hits: 0,
    cache_l1_misses: 0,
    cache_l2_hits: 0,
    cache_l2_misses: 0,
    cache_expired: 0,
    cache_evictions: 0,
    cache_invalid: 0,
    cache_writes: 0,
    request_coalesced: 0,
    ai_requests_correct: 0,
    ai_requests_translate: 0,
    ai_requests_layout_classify: 0,
    ai_requests_avoided: 0,
  }
}

/** Cache key parts — operation type is mandatory for isolation. */
export type CacheKeyParts = {
  operation: OperationType
  text: string
  sourceLanguage?: string
  targetLanguage?: string
  /** Isolates Google vs Groq vs Google+refine results. */
  translationStrategy?: string
  /** Isolates AI cache entries across accounts (Phase 2). */
  accountId?: string | null
  layoutSource?: string
  layoutCandidates?: string[]
  layoutContext?: string
  contextHash?: string
}

export function normalizeCacheText(operation: OperationType, text: string): string {
  const normalized = text.normalize('NFC')
  switch (operation) {
    case 'TRANSLATE':
      return normalized
    case 'CORRECT':
      return normalized.replace(/\s+/g, ' ').trim()
    case 'FIX_LAYOUT':
      return normalized
    default:
      return normalized.trim()
  }
}

export function hashCorrectionContext(input: {
  previousText?: string
  fieldType?: string
} = {}): string {
  const previous = (input.previousText ?? '').slice(-200)
  const fieldType = input.fieldType ?? ''
  if (!previous && !fieldType) return '0'
  return hashString(`${fieldType}\0${previous}`)
}

export function buildCacheKey(parts: CacheKeyParts): string {
  const {
    operation,
    text,
    sourceLanguage,
    targetLanguage,
    translationStrategy,
    layoutSource,
    layoutCandidates,
    layoutContext,
    contextHash,
    accountId,
  } = parts
  const normalized = normalizeCacheText(operation, text)
  const accountPart = accountId && accountId.trim() ? accountId.trim() : 'anon'
  switch (operation) {
    case 'CORRECT':
      return `CORRECT:${accountPart}:${hashString(normalized)}:${contextHash ?? '0'}`
    case 'TRANSLATE':
      return `TRANSLATE:${accountPart}:${hashString(normalized)}:${sourceLanguage ?? ''}:${targetLanguage ?? ''}:${translationStrategy ?? 'google'}`
    case 'FIX_LAYOUT': {
      const layouts = (layoutCandidates ?? []).slice().sort().join(',')
      const ctx = layoutContext ? hashString(layoutContext) : ''
      return `FIX_LAYOUT:${hashString(normalized)}:${layoutSource ?? ''}:${layouts}${ctx ? `:${ctx}` : ''}`
    }
    case 'PIPELINE':
      return `PIPELINE:${hashString(normalized)}`
    default:
      return `${operation}:${hashString(normalized)}`
  }
}

export function hashString(value: string): string {
  let hash = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16)
}

export function operationFromCacheKey(key: string): OperationType | undefined {
  const prefix = key.split(':')[0]
  if (prefix === 'CORRECT' || prefix === 'TRANSLATE' || prefix === 'FIX_LAYOUT' || prefix === 'PIPELINE') {
    return prefix
  }
  return undefined
}

export interface CacheCoordinator {
  get<T>(key: string): T | undefined
  set<T>(key: string, value: T, ttlMs?: number): void
  has(key: string): boolean
  delete(key: string): void
  clear(operation?: OperationType): void
  buildKey(parts: CacheKeyParts): string
}

export interface TieredCacheCoordinator extends CacheCoordinator {
  initialize(): Promise<void>
  getWithL2<T>(key: string): Promise<T | undefined>
  setWithL2<T>(key: string, value: T, operation: OperationType, ttlMs?: number): void
  flush(): Promise<void>
  metrics: CacheMetrics
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
