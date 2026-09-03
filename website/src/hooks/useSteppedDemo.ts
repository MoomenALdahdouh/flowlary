import { useCallback, useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from './usePrefersReducedMotion.ts'

export type DemoStep = {
  id: string
  /** Minimum ms this step stays visible when auto-playing */
  holdMs?: number
}

export type SteppedDemoOptions = {
  steps: DemoStep[]
  /** Auto-advance when playing (default true) */
  autoPlay?: boolean
  /** Loop back to start after last step */
  loop?: boolean
  /** Start playing when mounted / reset */
  startPaused?: boolean
}

const DEFAULT_HOLD = 2800

export function useSteppedDemo({
  steps,
  autoPlay = true,
  loop = false,
  startPaused = false,
}: SteppedDemoOptions) {
  const reduced = usePrefersReducedMotion()
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(!startPaused && autoPlay && !reduced)
  const timerRef = useRef<number | null>(null)

  const step = steps[index] ?? steps[0]
  const isFirst = index === 0
  const isLast = index >= steps.length - 1

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    clearTimer()
    setIndex(0)
    setPlaying(!startPaused && autoPlay && !reduced)
  }, [autoPlay, clearTimer, reduced, startPaused])

  const replay = useCallback(() => {
    clearTimer()
    setIndex(0)
    setPlaying(true)
  }, [clearTimer])

  const pause = useCallback(() => {
    clearTimer()
    setPlaying(false)
  }, [clearTimer])

  const play = useCallback(() => {
    setPlaying(true)
  }, [])

  const next = useCallback(() => {
    clearTimer()
    setIndex((current) => {
      if (current >= steps.length - 1) return loop ? 0 : current
      return current + 1
    })
  }, [clearTimer, loop, steps.length])

  const prev = useCallback(() => {
    clearTimer()
    setIndex((current) => Math.max(0, current - 1))
  }, [clearTimer])

  const goTo = useCallback(
    (target: number) => {
      clearTimer()
      setIndex(Math.max(0, Math.min(steps.length - 1, target)))
    },
    [clearTimer, steps.length],
  )

  useEffect(() => {
    if (!playing || reduced || steps.length <= 1) return

    const hold = step?.holdMs ?? DEFAULT_HOLD
    timerRef.current = window.setTimeout(() => {
      setIndex((current) => {
        if (current >= steps.length - 1) {
          if (loop) return 0
          setPlaying(false)
          return current
        }
        return current + 1
      })
    }, hold)

    return clearTimer
  }, [clearTimer, index, loop, playing, reduced, step?.holdMs, steps.length])

  useEffect(() => clearTimer, [clearTimer])

  return {
    index,
    step,
    stepCount: steps.length,
    playing,
    isFirst,
    isLast,
    play,
    pause,
    next,
    prev,
    reset,
    replay,
    goTo,
  }
}
