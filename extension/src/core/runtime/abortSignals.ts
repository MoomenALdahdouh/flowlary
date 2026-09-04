export function mergeAbortSignals(signals: Array<AbortSignal | undefined | null>): AbortSignal {
  const live = signals.filter((signal): signal is AbortSignal => Boolean(signal))
  if (live.length === 0) return new AbortController().signal
  if (live.length === 1) return live[0]!
  const controller = new AbortController()
  for (const signal of live) {
    if (signal.aborted) {
      controller.abort()
      return controller.signal
    }
    signal.addEventListener('abort', () => controller.abort(), { once: true })
  }
  return controller.signal
}
