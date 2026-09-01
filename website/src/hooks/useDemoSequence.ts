import { useEffect, useRef } from 'react'

export type Later = (fn: () => void, ms: number) => void

/** Run a timed demo sequence while `active`. Timers are cleared on disable/unmount. */
export function useDemoSequence(active: boolean, run: (later: Later) => void) {
  const runRef = useRef(run)
  runRef.current = run

  useEffect(() => {
    if (!active) return

    const timers: number[] = []
    let cancelled = false

    const later: Later = (fn, ms) => {
      timers.push(
        window.setTimeout(() => {
          if (!cancelled) fn()
        }, ms),
      )
    }

    runRef.current(later)

    return () => {
      cancelled = true
      timers.forEach((id) => window.clearTimeout(id))
    }
  }, [active])
}
