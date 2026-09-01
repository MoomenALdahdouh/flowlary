import { useCallback, useState } from 'react'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion.ts'
import { useInView } from '../../hooks/useInView.ts'
import { useDemoSequence, type Later } from '../../hooks/useDemoSequence.ts'
import { DEMO_HOLD } from '../../hooks/demoPhases.ts'
import { useI18n, useMessages } from '../../i18n/index.tsx'
import { ComposeFrame, DemoCaption } from './ComposeFrame.tsx'

const TYPED = 'lvpfh'
const INTENDED = 'مرحبا'

const STEP_KEYS = ['detect', 'classify', 'remap'] as const
type Phase = 'result' | 'input' | 'detect' | 'classify' | 'remap'

export function LayoutCorrectionDemo({ compact = false }: { compact?: boolean }) {
  const t = useMessages()
  const { direction, locale } = useI18n()
  const d = t.demos.layout
  const reduced = usePrefersReducedMotion()
  const { ref, inView } = useInView<HTMLDivElement>()
  const [phase, setPhase] = useState<Phase>('result')

  const run = useCallback((later: Later) => {
    const t1 = DEMO_HOLD.stable
    const t2 = t1 + DEMO_HOLD.input
    const t3 = t2 + DEMO_HOLD.analyze
    const t4 = t3 + DEMO_HOLD.step
    const t5 = t4 + DEMO_HOLD.process

    setPhase('result')
    later(() => setPhase('input'), t1)
    later(() => setPhase('detect'), t2)
    later(() => setPhase('classify'), t3)
    later(() => setPhase('remap'), t4)
    later(() => setPhase('result'), t5)
    later(() => run(later), t5 + DEMO_HOLD.loopGap)
  }, [])

  useDemoSequence(Boolean(inView && !reduced), run)

  const mapped = phase === 'remap' || phase === 'result'
  const stepIndex =
    phase === 'input' ? -1 : phase === 'detect' ? 0 : phase === 'classify' ? 1 : phase === 'remap' ? 2 : 3
  const visible = mapped ? INTENDED : TYPED

  const status =
    phase === 'input'
      ? d.status.input
      : phase === 'detect'
        ? d.status.detect
        : phase === 'classify'
          ? d.status.classify
          : phase === 'remap'
            ? d.status.remap
            : d.status.done

  return (
    <figure ref={ref} className={compact ? 'compact-demo' : undefined} dir={direction} lang={locale}>
      <ComposeFrame
        title={d.frameTitle}
        status={status}
        footer={
          <div className="layout-steps">
            {STEP_KEYS.map((key, index) => (
              <span key={key} className={`layout-step${index <= stepIndex ? ' is-on' : ''}`}>
                {d.steps[key]}
              </span>
            ))}
          </div>
        }
      >
        <p className="compose-text mono" dir={mapped ? 'rtl' : 'ltr'} lang={mapped ? 'ar' : 'en'}>
          {visible}
        </p>
        <p className="layout-legend">
          <span dir="ltr">
            {d.legendEnglish} {TYPED}
          </span>
          <span className="layout-arrow" aria-hidden="true">
            {direction === 'rtl' ? '←' : '→'}
          </span>
          <span dir="rtl">
            {d.legendArabic} {INTENDED}
          </span>
        </p>
      </ComposeFrame>
      {compact ? null : (
        <>
          <DemoCaption />
          <p className="mock-caption">
            {d.caption.replace('{typed}', TYPED).replace('{intended}', INTENDED)}
          </p>
        </>
      )}
    </figure>
  )
}
