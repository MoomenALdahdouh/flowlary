import { useCallback, useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from './usePrefersReducedMotion.ts'

/** Alternating typewriter loop (Base44 FinalCTA parity). */
export function useAlternatingTypewriter(steps: { text: string }[], holdMs = 2000) {
  const reduced = usePrefersReducedMotion()
  const [stepIdx, setStepIdx] = useState(0)
  const [displayText, setDisplayText] = useState('')
  const [cursor, setCursor] = useState(true)
  const timerRef = useRef<number | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    const blink = window.setInterval(() => setCursor((v) => !v), 530)
    return () => window.clearInterval(blink)
  }, [])

  const typeText = useCallback(
    (target: string, onDone?: () => void) => {
      clearTimer()
      if (reduced) {
        setDisplayText(target)
        onDone?.()
        return
      }

      setDisplayText('')
      let i = 0
      const type = () => {
        if (i <= target.length) {
          setDisplayText(target.slice(0, i))
          i += 1
          timerRef.current = window.setTimeout(type, 70 + Math.random() * 40)
        } else {
          onDone?.()
        }
      }
      timerRef.current = window.setTimeout(type, 300)
    },
    [clearTimer, reduced],
  )

  useEffect(() => {
    const step = steps[stepIdx]
    if (!step) return

    typeText(step.text, () => {
      timerRef.current = window.setTimeout(() => {
        setStepIdx((s) => (s + 1) % steps.length)
      }, holdMs)
    })

    return clearTimer
  }, [clearTimer, holdMs, stepIdx, steps, typeText])

  return { stepIdx, displayText, cursor }
}
