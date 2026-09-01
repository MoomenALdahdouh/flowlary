import { useCallback, useState } from 'react'
import { SHORTCUTS } from '../../config.ts'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion.ts'
import { useInView } from '../../hooks/useInView.ts'
import { useDemoSequence, type Later } from '../../hooks/useDemoSequence.ts'
import { DEMO_HOLD } from '../../hooks/demoPhases.ts'
import { useI18n, useMessages } from '../../i18n/index.tsx'
import { DemoCaption } from './ComposeFrame.tsx'

const INPUT = 'lvpfh'
const OUTPUT = 'مرحبا'

type Phase = 'result' | 'input' | 'convert'

export function SpeedBoxDemo({ compact = false }: { compact?: boolean }) {
  const t = useMessages()
  const { direction, locale } = useI18n()
  const d = t.demos.speedbox
  const reduced = usePrefersReducedMotion()
  const { ref, inView } = useInView<HTMLDivElement>()
  const [phase, setPhase] = useState<Phase>('result')

  const run = useCallback((later: Later) => {
    const t1 = DEMO_HOLD.stable
    const t2 = t1 + DEMO_HOLD.input
    const t3 = t2 + DEMO_HOLD.process

    setPhase('result')
    later(() => setPhase('input'), t1)
    later(() => setPhase('convert'), t2)
    later(() => setPhase('result'), t3)
    later(() => run(later), t3 + DEMO_HOLD.loopGap)
  }, [])

  useDemoSequence(Boolean(inView && !reduced), run)

  const showInput = phase === 'input' || phase === 'convert' || phase === 'result'
  const showOutput = phase === 'convert' || phase === 'result'

  const status =
    phase === 'result' ? d.status.done : phase === 'convert' ? d.status.convert : d.status.input

  return (
    <figure ref={ref} className={compact ? 'compact-demo' : undefined} dir={direction} lang={locale}>
      <div className={`speed-panel${phase === 'convert' ? ' is-busy' : ''}`} aria-hidden="true">
        <header>
          <span>{t.features.items[4].title}</span>
          <span dir="ltr">{SHORTCUTS.speedBox.mac}</span>
        </header>
        <p className="muted" dir="ltr">
          {d.layoutPair}
        </p>
        <div className="speed-field">
          <span className="speed-label">{t.playground.field.input}</span>
          <div className="speed-output" dir="ltr">
            {showInput ? INPUT : ''}
          </div>
        </div>
        <div className="speed-field">
          <span className="speed-label">{phase === 'convert' ? d.converting : t.playground.field.result}</span>
          <div className="speed-output" dir="rtl">
            {showOutput ? OUTPUT : ''}
          </div>
        </div>
        <p className="compose-status">{status}</p>
      </div>
      {compact ? null : <DemoCaption />}
    </figure>
  )
}
