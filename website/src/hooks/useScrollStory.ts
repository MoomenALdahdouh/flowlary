import { useCallback, useEffect, useRef, useState } from 'react'
import { useInView } from './useInView.ts'
import { usePrefersReducedMotion } from './usePrefersReducedMotion.ts'

export type StoryStep = {
  id: string
  holdMs?: number
}

const DEFAULT_HOLD = 2000

/**
 * Scroll-triggered product story: starts when in view, advances automatically,
 * holds final state, no playback controls. Replays when re-entering viewport.
 */
export function useScrollStory(steps: StoryStep[], options?: { loop?: boolean }) {
  const loop = options?.loop ?? false
  const reduced = usePrefersReducedMotion()
  const { ref, inView } = useInView<HTMLDivElement>()
  const [index, setIndex] = useState(0)
  const [active, setActive] = useState(false)
  const timerRef = useRef<number | null>(null)
  const wasInViewRef = useRef(false)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const step = steps[index] ?? steps[0]
  const isLast = index >= steps.length - 1

  // Start or restart when entering viewport
  useEffect(() => {
    if (!inView) {
      wasInViewRef.current = false
      setActive(false)
      clearTimer()
      return
    }

    if (!wasInViewRef.current) {
      wasInViewRef.current = true
      clearTimer()
      if (reduced) {
        setIndex(steps.length - 1)
        setActive(true)
      } else {
        setIndex(0)
        setActive(true)
      }
    }
  }, [clearTimer, inView, reduced, steps.length])

  // Advance steps while playing in view
  useEffect(() => {
    if (!active || !inView || reduced) return
    if (isLast && !loop) return

    const hold = step?.holdMs ?? DEFAULT_HOLD
    timerRef.current = window.setTimeout(() => {
      setIndex((current) => {
        if (current >= steps.length - 1) return loop ? 0 : current
        return current + 1
      })
    }, hold)

    return clearTimer
  }, [active, clearTimer, inView, isLast, loop, reduced, step?.holdMs, index, steps.length])

  useEffect(() => clearTimer, [clearTimer])

  return {
    ref,
    inView,
    index,
    stepId: step?.id ?? steps[0]?.id ?? '',
    isLast,
    started: active && inView,
  }
}
