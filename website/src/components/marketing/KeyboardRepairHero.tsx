import { useCallback, useEffect, useState } from 'react'
import { FidelityBadge } from '../Ui.tsx'
import { useMessages } from '../../i18n/index.tsx'
import { MARKETING_LAYOUT_EXAMPLE } from '../../lib/layoutDemo.ts'

type Phase = 'typing' | 'detected' | 'done'

export function KeyboardRepairHero() {
  const copy = useMessages().marketingHome.hero.repairDemo
  const wrong = MARKETING_LAYOUT_EXAMPLE.typed
  const fixed = MARKETING_LAYOUT_EXAMPLE.intended
  const [phase, setPhase] = useState<Phase>('typing')
  const [typed, setTyped] = useState('')

  const reset = useCallback(() => {
    setPhase('typing')
    setTyped('')
  }, [])

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setTyped(wrong)
      setPhase('done')
      return
    }

    if (phase === 'typing') {
      if (typed.length < wrong.length) {
        const timer = window.setTimeout(() => setTyped(wrong.slice(0, typed.length + 1)), 90)
        return () => window.clearTimeout(timer)
      }
      const timer = window.setTimeout(() => setPhase('detected'), 500)
      return () => window.clearTimeout(timer)
    }

    if (phase === 'detected') {
      const timer = window.setTimeout(() => setPhase('done'), 700)
      return () => window.clearTimeout(timer)
    }

    const timer = window.setTimeout(reset, 3200)
    return () => window.clearTimeout(timer)
  }, [phase, typed, wrong, reset])

  const showFixed = phase === 'done'

  return (
    <div className="kr-hero">
      <div className="kr-hero-badge-row">
        <FidelityBadge mode="simulated" />
      </div>
      <div className="kr-hero-frame">
        <div className="kr-hero-chrome" aria-hidden="true">
          <span className="kr-hero-dot" />
          <span className="kr-hero-dot" />
          <span className="kr-hero-dot" />
          <span className="kr-hero-url">{copy.url}</span>
        </div>
        <div className="kr-hero-body">
          <p className="kr-hero-meta">{copy.composeLabel}</p>
          <p className="kr-hero-to">
            <span>{copy.toLabel}</span> {copy.toValue}
          </p>
          <div className={`kr-hero-field${showFixed ? ' is-fixed' : phase === 'detected' ? ' is-detecting' : ''}`}>
            <p className="kr-hero-text" dir={showFixed ? 'rtl' : 'ltr'} lang={showFixed ? 'ar' : 'en'}>
              {showFixed ? fixed : typed}
              {phase === 'typing' ? <span className="kr-hero-caret" aria-hidden="true" /> : null}
            </p>
          </div>
          <p className="kr-hero-status">
            {phase === 'typing' ? copy.statusTyping : phase === 'detected' ? copy.statusDetected : copy.statusDone}
          </p>
        </div>
      </div>
    </div>
  )
}
