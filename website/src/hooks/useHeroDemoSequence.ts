import { useCallback, useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from './usePrefersReducedMotion.ts'

export type HeroDemoStep = {
  text: string
  state: 'error' | 'correcting' | 'corrected' | 'idle'
}

export type HeroDemoSequence = {
  id: string
  accent: string
  badge: string
  steps: HeroDemoStep[]
}

/**
 * Base44-style hero simulator: type each step, pause, advance sequence.
 * Clicking a sequence resets to its first step.
 */
export function useHeroDemoSequence(sequences: HeroDemoSequence[]) {
  const reduced = usePrefersReducedMotion()
  const [seqIdx, setSeqIdx] = useState(0)
  const [stepIdx, setStepIdx] = useState(0)
  const [displayText, setDisplayText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const timerRef = useRef<number | null>(null)

  const currentSeq = sequences[seqIdx] ?? sequences[0]
  const currentStep = currentSeq?.steps[stepIdx] ?? currentSeq?.steps[0]

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const typeText = useCallback(
    (target: string, onDone?: () => void) => {
      clearTimer()
      if (reduced) {
        setDisplayText(target)
        setIsTyping(false)
        onDone?.()
        return
      }

      setIsTyping(true)
      setDisplayText('')
      let i = 0
      const speed = target.length > 20 ? 45 : 60

      const type = () => {
        if (i <= target.length) {
          setDisplayText(target.slice(0, i))
          i += 1
          timerRef.current = window.setTimeout(type, speed + Math.random() * 30)
        } else {
          setIsTyping(false)
          onDone?.()
        }
      }

      timerRef.current = window.setTimeout(type, 300)
    },
    [clearTimer, reduced],
  )

  useEffect(() => {
    if (!currentStep) return

    typeText(currentStep.text, () => {
      const atLastStep = stepIdx >= currentSeq.steps.length - 1
      const hold = atLastStep ? 2800 : 1400
      timerRef.current = window.setTimeout(() => {
        if (!atLastStep) {
          setStepIdx((s) => s + 1)
        } else {
          setStepIdx(0)
          setSeqIdx((s) => (s + 1) % sequences.length)
        }
      }, hold)
    })

    return clearTimer
  }, [clearTimer, currentSeq.steps.length, currentStep, seqIdx, stepIdx, sequences.length, typeText])

  const pickSequence = useCallback(
    (index: number) => {
      clearTimer()
      setSeqIdx(index)
      setStepIdx(0)
    },
    [clearTimer],
  )

  return {
    seqIdx,
    stepIdx,
    displayText,
    isTyping,
    currentSeq,
    currentStep,
    pickSequence,
  }
}
