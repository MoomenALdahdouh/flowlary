import type { CacheMetrics } from '@flowlary/shared'

export function createRequestCoalescer<T>(metrics?: CacheMetrics): {
  run(key: string, fn: () => Promise<T>): Promise<T>
  reset(): void
} {
  const inflight = new Map<string, Promise<T>>()

  return {
    run(key, fn) {
      const existing = inflight.get(key)
      if (existing) {
        metrics && (metrics.request_coalesced += 1)
        return existing
      }
      const promise = fn().finally(() => {
        inflight.delete(key)
      })
      inflight.set(key, promise)
      return promise
    },
    reset() {
      inflight.clear()
    },
  }
}
