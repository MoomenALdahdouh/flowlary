import { useCallback, useEffect, useState } from 'react'
import { FidelityBadge } from '../Ui.tsx'
import { useMessages } from '../../i18n/index.tsx'

const SCENARIOS = [
  {
    host: 'mail.google.com',
    typed: 'lgh hgkhs',
    fixed: 'أنا هنا',
    dirTyped: 'ltr' as const,
    dirFixed: 'rtl' as const,
  },
  {
    host: 'docs.google.com',
    typed: 'I recieved the report yesturday',
    fixed: 'I received the report yesterday',
    dirTyped: 'ltr' as const,
    dirFixed: 'ltr' as const,
  },
  {
    host: 'web.whatsapp.com',
    typed: 'See you tomorrow at the meeting',
    fixed: 'أراك غداً في الاجتماع',
    dirTyped: 'ltr' as const,
    dirFixed: 'rtl' as const,
  },
]

type Phase = 'typing' | 'ready' | 'applied'

export function InFieldCycleDemo() {
  const t = useMessages()
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('typing')
  const [typed, setTyped] = useState('')
  const scenario = SCENARIOS[index]

  const reset = useCallback((nextIndex: number) => {
    setIndex(nextIndex)
    setPhase('typing')
    setTyped('')
  }, [])

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setTyped(scenario.fixed)
      setPhase('applied')
      return
    }
    if (phase === 'typing') {
      if (typed.length < scenario.typed.length) {
        const timer = window.setTimeout(() => setTyped(scenario.typed.slice(0, typed.length + 1)), 70)
        return () => window.clearTimeout(timer)
      }
      const timer = window.setTimeout(() => setPhase('ready'), 450)
      return () => window.clearTimeout(timer)
    }
    if (phase === 'ready') {
      const timer = window.setTimeout(() => setPhase('applied'), 900)
      return () => window.clearTimeout(timer)
    }
    const timer = window.setTimeout(() => reset((index + 1) % SCENARIOS.length), 2200)
    return () => window.clearTimeout(timer)
  }, [phase, typed, scenario, index, reset])

  const shown = phase === 'applied' ? scenario.fixed : typed
  const dir = phase === 'applied' ? scenario.dirFixed : scenario.dirTyped

  return (
    <div className="if-cycle">
      <div className="if-cycle-badge">
        <FidelityBadge mode="simulated" />
      </div>
      <div className="kr-hero-frame">
        <div className="kr-hero-chrome" aria-hidden="true">
          <span className="kr-hero-dot" />
          <span className="kr-hero-dot" />
          <span className="kr-hero-dot" />
          <span className="kr-hero-url">{scenario.host}</span>
        </div>
        <div className="kr-hero-body">
          <p className="kr-hero-meta">{t.marketingHome.bolt.inFieldKicker}</p>
          <div className={`kr-hero-field${phase === 'applied' ? ' is-fixed' : phase === 'ready' ? ' is-detecting' : ''}`}>
            <p className="kr-hero-text" dir={dir}>
              {shown}
              {phase === 'typing' ? <span className="kr-hero-caret" aria-hidden="true" /> : null}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
