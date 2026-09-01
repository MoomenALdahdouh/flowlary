import { useCallback, useState } from 'react'
import { SHORTCUTS } from '../../config.ts'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion.ts'
import { useInView } from '../../hooks/useInView.ts'
import { useDemoSequence, type Later } from '../../hooks/useDemoSequence.ts'
import { DEMO_HOLD } from '../../hooks/demoPhases.ts'
import { useI18n, useMessages } from '../../i18n/index.tsx'
import { ComposeFrame, DemoCaption } from './ComposeFrame.tsx'

export const TRANSLATION_SOURCE = 'كيف حالك اليوم؟'
export const TRANSLATION_TARGET = 'How are you today?'

type Phase = 'result' | 'input' | 'select' | 'shortcut' | 'apply'

export function TranslationDemo({ compact = false }: { compact?: boolean }) {
  const t = useMessages()
  const { direction, locale } = useI18n()
  const d = t.demos.translation
  const reduced = usePrefersReducedMotion()
  const { ref, inView } = useInView<HTMLDivElement>()
  const [phase, setPhase] = useState<Phase>('result')

  const run = useCallback((later: Later) => {
    const t1 = DEMO_HOLD.stable
    const t2 = t1 + DEMO_HOLD.input
    const t3 = t2 + DEMO_HOLD.step
    const t4 = t3 + DEMO_HOLD.step
    const t5 = t4 + DEMO_HOLD.process

    setPhase('result')
    later(() => setPhase('input'), t1)
    later(() => setPhase('select'), t2)
    later(() => setPhase('shortcut'), t3)
    later(() => setPhase('apply'), t4)
    later(() => setPhase('result'), t5)
    later(() => run(later), t5 + DEMO_HOLD.loopGap)
  }, [])

  useDemoSequence(Boolean(inView && !reduced), run)

  const translated = phase === 'apply' || phase === 'result'
  const selected = phase === 'select' || phase === 'shortcut' || phase === 'apply'

  const status =
    phase === 'result'
      ? d.status.done
      : phase === 'input'
        ? d.status.input
        : phase === 'select'
          ? d.status.select
          : phase === 'shortcut'
            ? d.status.shortcut
            : d.status.apply

  return (
    <figure ref={ref} className={compact ? 'compact-demo' : undefined} dir={direction} lang={locale}>
      <ComposeFrame title={d.frameTitle} status={status}>
        <p className="compose-text" dir={translated ? 'ltr' : 'rtl'} lang={translated ? 'en' : 'ar'}>
          <span className={selected && !translated ? 'demo-select' : undefined}>
            {translated ? TRANSLATION_TARGET : TRANSLATION_SOURCE}
          </span>
        </p>
        {phase === 'shortcut' || phase === 'apply' ? (
          <p className="demo-indicator">
            {t.popupPreview.actions.translate} <kbd dir="ltr">{SHORTCUTS.translate.mac}</kbd>
          </p>
        ) : null}
        {phase === 'result' ? <p className="demo-indicator is-ok">{d.writtenBack}</p> : null}
      </ComposeFrame>
      {compact ? null : (
        <>
          <DemoCaption />
          <p className="mock-caption">
            {d.caption
              .replace('{source}', TRANSLATION_SOURCE)
              .replace('{target}', TRANSLATION_TARGET)}
          </p>
        </>
      )}
    </figure>
  )
}
