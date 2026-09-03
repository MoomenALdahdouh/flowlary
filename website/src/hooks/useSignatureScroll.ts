import { useCallback, useRef, useState } from 'react'
import { useRafScroll } from './useRafScroll.ts'

/** Scroll-driven stage index + within-stage progress. Disabled when `enabled` is false. */
export function useSignatureScroll(stageCount: number, enabled = true) {
  const containerRef = useRef<HTMLElement | null>(null)
  const [activeStage, setActiveStage] = useState(0)
  const [showFixed, setShowFixed] = useState(false)
  const stageRef = useRef(0)
  const fixedRef = useRef(false)

  const updateFromScroll = useCallback(() => {
    const container = containerRef.current
    if (!container || stageCount <= 0) return

    const rect = container.getBoundingClientRect()
    const viewH = window.innerHeight
    const totalScrollable = rect.height - viewH
    if (totalScrollable <= 0) return

    const progress = Math.max(0, Math.min(1, -rect.top / totalScrollable))
    const idx = Math.min(stageCount - 1, Math.floor(progress * stageCount))
    const stageProgress = progress * stageCount - idx

    // Hysteresis reduces flip-flop near the threshold (scroll anchoring jitter).
    let nextFixed = fixedRef.current
    if (stageProgress > 0.42) nextFixed = true
    else if (stageProgress < 0.32) nextFixed = false

    if (idx !== stageRef.current) {
      stageRef.current = idx
      setActiveStage(idx)
    }
    if (nextFixed !== fixedRef.current) {
      fixedRef.current = nextFixed
      setShowFixed(nextFixed)
    }
  }, [stageCount])

  useRafScroll(updateFromScroll, enabled && stageCount > 0)

  const setActiveStageManual = useCallback((index: number) => {
    stageRef.current = index
    setActiveStage(index)
  }, [])

  const setShowFixedManual = useCallback((value: boolean) => {
    fixedRef.current = value
    setShowFixed(value)
  }, [])

  return {
    containerRef,
    activeStage,
    showFixed,
    setActiveStage: setActiveStageManual,
    setShowFixed: setShowFixedManual,
  }
}
