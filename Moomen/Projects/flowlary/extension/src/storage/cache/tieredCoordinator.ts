import {
  CACHE_TTL_MS,
  createMemoryCacheCoordinator,
  operationFromCacheKey,
  type CacheCoordinator,
  type CacheMetrics,
  type OperationType,
  type TieredCacheCoordinator,
} from '@flowlary/shared'
import type { FlowlaryStorage } from '../index.ts'
import { PersistentCacheStore } from './persistentStore.ts'

export function createTieredCacheCoordinator(
  storage: FlowlaryStorage,
  metrics: CacheMetrics,
): TieredCacheCoordinator {
  const l1 = createMemoryCacheCoordinator()
  const l2 = new PersistentCacheStore(storage, metrics)
  let initPromise: Promise<void> | null = null

  async function initialize(): Promise<void> {
    if (!initPromise) initPromise = l2.ensureLoaded()
    await initPromise
  }

  function ttlForKey(key: string, ttlMs?: number): number {
    if (ttlMs != null) return ttlMs
    const operation = operationFromCacheKey(key)
    if (operation && operation in CACHE_TTL_MS) {
      return CACHE_TTL_MS[operation as keyof typeof CACHE_TTL_MS]
    }
    return CACHE_TTL_MS.TRANSLATE
  }

  const coordinator: TieredCacheCoordinator = {
    metrics,

    buildKey: l1.buildKey.bind(l1),

    initialize,

    get<T>(key: string): T | undefined {
      const value = l1.get<T>(key)
      if (value !== undefined) {
        metrics.cache_l1_hits += 1
        return value
      }
      metrics.cache_l1_misses += 1
      return undefined
    },

    async getWithL2<T>(key: string): Promise<T | undefined> {
      const l1Value = l1.get<T>(key)
      if (l1Value !== undefined) {
        metrics.cache_l1_hits += 1
        return l1Value
      }
      metrics.cache_l1_misses += 1
      await initialize()
      const l2Value = await l2.get<T>(key)
      if (l2Value === undefined) {
        metrics.cache_l2_misses += 1
        return undefined
      }
      metrics.cache_l2_hits += 1
      l1.set(key, l2Value, ttlForKey(key))
      return l2Value
    },

    set<T>(key: string, value: T, ttlMs?: number): void {
      l1.set(key, value, ttlForKey(key, ttlMs))
    },

    setWithL2<T>(key: string, value: T, operation: OperationType, ttlMs?: number): void {
      const ttl = ttlForKey(key, ttlMs)
      l1.set(key, value, ttl)
      void l2.set(key, value, operation, ttl)
    },

    has(key: string): boolean {
      return coordinator.get(key) !== undefined
    },

    delete(key: string): void {
      l1.delete(key)
      void l2.delete(key)
    },

    clear(operation?: OperationType): void {
      l1.clear(operation)
      void l2.clear(operation)
    },

    async flush(): Promise<void> {
      await l2.drain()
    },
  }

  return coordinator
}

export function asMemoryCoordinator(tiered: TieredCacheCoordinator): CacheCoordinator {
  return tiered
}
