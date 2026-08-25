import {
  CACHE_SCHEMA_VERSION,
  CACHE_TTL_MS,
  MAX_CACHE_ENTRIES,
  operationFromCacheKey,
  type CacheMetrics,
  type OperationType,
  type PersistentCacheRecord,
  type PersistentCacheStoreV1,
} from '@flowlary/shared'
import type { FlowlaryStorage } from '../index.ts'
import { canCacheValue } from './privacy.ts'

function emptyStore(): PersistentCacheStoreV1 {
  return { version: CACHE_SCHEMA_VERSION, entries: [] }
}

function sanitizeRecord(raw: unknown): PersistentCacheRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Partial<PersistentCacheRecord>
  if (typeof value.key !== 'string' || !value.key.trim()) return null
  const operation = operationFromCacheKey(value.key)
  if (!operation) return null
  if (typeof value.createdAt !== 'number' || typeof value.expiresAt !== 'number') return null
  if (value.value === undefined) return null
  if (!canCacheValue(value.value)) return null
  return {
    key: value.key,
    operation,
    value: value.value,
    createdAt: value.createdAt,
    expiresAt: value.expiresAt,
    lastAccessAt:
      typeof value.lastAccessAt === 'number' && Number.isFinite(value.lastAccessAt)
        ? value.lastAccessAt
        : value.createdAt,
  }
}

export function normalizePersistentCacheStore(raw: unknown): PersistentCacheStoreV1 {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyStore()
  const value = raw as Partial<PersistentCacheStoreV1>
  if (value.version !== CACHE_SCHEMA_VERSION || !Array.isArray(value.entries)) return emptyStore()
  const entries = value.entries
    .map((item) => sanitizeRecord(item))
    .filter((item): item is PersistentCacheRecord => item != null)
  return { version: CACHE_SCHEMA_VERSION, entries }
}

export class PersistentCacheStore {
  private writeChain: Promise<void> = Promise.resolve()
  private loaded = false
  private store: PersistentCacheStoreV1 = emptyStore()

  constructor(
    private storage: FlowlaryStorage,
    private metrics: CacheMetrics,
  ) {}

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.writeChain.then(fn, fn)
    this.writeChain = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }

  private pruneInMemory(now = Date.now()): void {
    this.pruneExpired(now)
    this.evictToLimit()
  }

  async ensureLoaded(): Promise<void> {
    if (this.loaded) return
    const raw = await this.storage.get(this.storage.keys.cache, 'local')
    this.store = normalizePersistentCacheStore(raw)
    this.loaded = true
    this.pruneInMemory()
  }

  private async persist(): Promise<void> {
    await this.storage.set(this.storage.keys.cache, this.store as unknown as Record<string, unknown>, 'local')
  }

  private pruneExpired(now = Date.now()): void {
    const before = this.store.entries.length
    this.store.entries = this.store.entries.filter((entry) => {
      if (entry.expiresAt <= now) {
        this.metrics.cache_expired += 1
        return false
      }
      return true
    })
    if (this.store.entries.length < before) {
      this.metrics.cache_evictions += before - this.store.entries.length
    }
  }

  private evictToLimit(): void {
    if (this.store.entries.length <= MAX_CACHE_ENTRIES) return
    const sorted = [...this.store.entries].sort((a, b) => a.lastAccessAt - b.lastAccessAt)
    const removeCount = this.store.entries.length - MAX_CACHE_ENTRIES
    const removeKeys = new Set(sorted.slice(0, removeCount).map((entry) => entry.key))
    this.store.entries = this.store.entries.filter((entry) => !removeKeys.has(entry.key))
    this.metrics.cache_evictions += removeCount
  }

  async cleanup(): Promise<void> {
    await this.enqueue(async () => {
      await this.ensureLoaded()
      this.pruneInMemory()
      await this.persist()
    })
  }

  async get<T>(key: string): Promise<T | undefined> {
    await this.ensureLoaded()
    const now = Date.now()
    const entry = this.store.entries.find((item) => item.key === key)
    if (!entry) return undefined
    if (entry.expiresAt <= now) {
      this.metrics.cache_expired += 1
      this.store.entries = this.store.entries.filter((item) => item.key !== key)
      await this.persist()
      return undefined
    }
    entry.lastAccessAt = now
    return entry.value as T
  }

  async set<T>(key: string, value: T, operation: OperationType, ttlMs?: number): Promise<void> {
    if (!canCacheValue(value)) {
      this.metrics.cache_invalid += 1
      return
    }
    const ttl = ttlMs ?? CACHE_TTL_MS[operation as keyof typeof CACHE_TTL_MS] ?? CACHE_TTL_MS.TRANSLATE
    await this.enqueue(async () => {
      await this.ensureLoaded()
      const now = Date.now()
      const next: PersistentCacheRecord = {
        key,
        operation,
        value,
        createdAt: now,
        expiresAt: now + ttl,
        lastAccessAt: now,
      }
      this.store.entries = this.store.entries.filter((entry) => entry.key !== key)
      this.store.entries.push(next)
      this.metrics.cache_writes += 1
      this.pruneInMemory(now)
      await this.persist()
    })
  }

  async delete(key: string): Promise<void> {
    await this.enqueue(async () => {
      await this.ensureLoaded()
      this.store.entries = this.store.entries.filter((entry) => entry.key !== key)
      await this.persist()
    })
  }

  async clear(operation?: OperationType): Promise<void> {
    await this.enqueue(async () => {
      await this.ensureLoaded()
      if (!operation) {
        this.store = emptyStore()
      } else {
        const prefix = `${operation}:`
        this.store.entries = this.store.entries.filter((entry) => !entry.key.startsWith(prefix))
      }
      await this.persist()
    })
  }

  resetForTests(): void {
    this.loaded = false
    this.store = emptyStore()
    this.writeChain = Promise.resolve()
  }

  async drain(): Promise<void> {
    await this.writeChain
  }
}
