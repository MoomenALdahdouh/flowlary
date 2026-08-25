export function createCoalescer<T>(): {
  run(key: string, fn: () => Promise<T>): Promise<T>
} {
  const inflight = new Map<string, Promise<T>>()

  return {
    run(key, fn) {
      const existing = inflight.get(key)
      if (existing) return existing
      const promise = fn().finally(() => {
        inflight.delete(key)
      })
      inflight.set(key, promise)
      return promise
    },
  }
}
