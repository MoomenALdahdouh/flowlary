import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion.ts'
import { useInView } from '../../hooks/useInView.ts'
import { useDemoSequence, type Later } from '../../hooks/useDemoSequence.ts'
import { DEMO_HOLD } from '../../hooks/demoPhases.ts'
import { useI18n, useMessages } from '../../i18n/index.tsx'
import { ComposeFrame, DemoCaption } from './ComposeFrame.tsx'

export const CORRECTION_SOURCE = 'I recieved the mesage yesterday'
export const CORRECTION_FIXED = 'I received the message yesterday.'

const FIXES = [
  { from: 'recieved', to: 'received' },
  { from: 'mesage', to: 'message' },
]

type Phase = 'result' | 'input' | 'detect' | 'apply'

export function CorrectionDemo({
  compact = false,
  loop = false,
}: {
  compact?: boolean
  loop?: boolean
}) {
  const t = useMessages()
  const { direction, locale } = useI18n()
  const d = t.demos.correction
  const reduced = usePrefersReducedMotion()
  const { ref, inView } = useInView<HTMLDivElement>(!loop)
  const [phase, setPhase] = useState<Phase>('result')

  const run = useCallback(
    (later: Later) => {
      const t1 = DEMO_HOLD.stable
      const t2 = t1 + DEMO_HOLD.input
      const t3 = t2 + DEMO_HOLD.analyze
      const t4 = t3 + DEMO_HOLD.process

      setPhase('result')
      later(() => setPhase('input'), t1)
      later(() => setPhase('detect'), t2)
      later(() => setPhase('apply'), t3)
      later(() => setPhase('result'), t4)
      if (loop) later(() => run(later), t4 + DEMO_HOLD.loopGap)
    },
    [loop],
  )

  useDemoSequence(Boolean(inView && !reduced), run)

  const applied = phase === 'apply' || phase === 'result'
  const display = applied ? CORRECTION_FIXED : CORRECTION_SOURCE

  const nodes = useMemo(() => {
    const parts: ReactNode[] = []
    display.split(/(\s+)/).forEach((word, index) => {
      const plain = word.replace(/[.]/g, '')
      const error = FIXES.find((item) => item.from === plain)
      const fix = FIXES.find((item) => item.to === plain)
      if (error && phase === 'detect') {
        parts.push(
          <span key={index} className="demo-mark is-error">
            {word}
          </span>,
        )
      } else if (fix && applied) {
        parts.push(
          <span key={index} className={`demo-mark is-ok${phase === 'result' ? ' is-settled' : ''}`}>
            {word}
          </span>,
        )
      } else {
        parts.push(<span key={index}>{word}</span>)
      }
    })
    return parts
  }, [applied, display, phase])

  const status =
    phase === 'input'
      ? d.status.input
      : phase === 'detect'
        ? d.status.analyze
        : phase === 'apply'
          ? d.status.correct
          : d.status.done

  return (
    <figure ref={ref} className={compact ? 'compact-demo' : undefined} dir={direction} lang={locale}>
      <ComposeFrame title={d.frameTitle} status={status}>
        <p className="compose-text" dir="ltr" lang="en">
          {nodes}
        </p>
        {phase === 'detect' ? <p className="demo-indicator">{d.indicators.ready}</p> : null}
        {phase === 'apply' ? <p className="demo-indicator">{d.indicators.applying}</p> : null}
        {phase === 'result' ? <p className="demo-indicator is-ok">{d.indicators.corrected}</p> : null}
      </ComposeFrame>
      {compact ? null : (
        <>
          <DemoCaption />
          <p className="mock-caption">
            {d.caption.replace('{source}', CORRECTION_SOURCE).replace('{fixed}', CORRECTION_FIXED)}
          </p>
        </>
      )}
    </figure>
  )
}
