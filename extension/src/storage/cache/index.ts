import { createCacheMetrics, type CacheMetrics, type TieredCacheCoordinator } from '@flowlary/shared'
import { flowlaryStorage } from '../index.ts'
import { createRequestCoalescer } from './coalesce.ts'
import { createTieredCacheCoordinator } from './tieredCoordinator.ts'

export { canCacheText, canCacheValue } from './privacy.ts'
export { PersistentCacheStore, normalizePersistentCacheStore } from './persistentStore.ts'
export { createTieredCacheCoordinator, asMemoryCoordinator } from './tieredCoordinator.ts'
export { createRequestCoalescer } from './coalesce.ts'

let coordinator: TieredCacheCoordinator | null = null
let metrics: CacheMetrics | null = null
let translateCoalescer = createRequestCoalescer(getCacheMetrics())
let correctCoalescer = createRequestCoalescer(getCacheMetrics())

export function getCacheMetrics(): CacheMetrics {
  if (!metrics) metrics = createCacheMetrics()
  return metrics
}

export function getFlowlaryCache(storage = flowlaryStorage): TieredCacheCoordinator {
  if (!coordinator) {
    metrics = getCacheMetrics()
    coordinator = createTieredCacheCoordinator(storage, metrics)
  }
  return coordinator
}

export function getTranslateCoalescer() {
  return translateCoalescer
}

export function getCorrectCoalescer() {
  return correctCoalescer
}

export async function initializeFlowlaryCache(storage = flowlaryStorage): Promise<void> {
  await getFlowlaryCache(storage).initialize()
}

export async function drainFlowlaryCache(storage = flowlaryStorage): Promise<void> {
  await getFlowlaryCache(storage).flush()
}

export function resetFlowlaryCacheForTests(): void {
  coordinator = null
  metrics = null
  translateCoalescer = createRequestCoalescer(getCacheMetrics())
  correctCoalescer = createRequestCoalescer(getCacheMetrics())
}
