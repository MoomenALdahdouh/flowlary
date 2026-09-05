import type { CacheMetrics } from '@flowlary/shared'

export function createRequestCoalescer(metrics?: CacheMetrics): {
  run<T>(key: string, fn: () => Promise<T>): Promise<T>
  reset(): void
} {
  const inflight = new Map<string, Promise<unknown>>()

  return {
    run<T>(key: string, fn: () => Promise<T>): Promise<T> {
      const existing = inflight.get(key)
      if (existing) {
        metrics && (metrics.request_coalesced += 1)
        return existing as Promise<T>
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
