import { useCallback, useState } from 'react'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion.ts'
import { useInView } from '../../hooks/useInView.ts'
import { useDemoSequence, type Later } from '../../hooks/useDemoSequence.ts'
import { DEMO_HOLD } from '../../hooks/demoPhases.ts'
import { useI18n, useMessages } from '../../i18n/index.tsx'
import { ComposeFrame, DemoCaption } from './ComposeFrame.tsx'

const LIVE_SOURCE = 'How are you'
const LIVE_TARGET = 'كيف حالك؟'

const LIVE_STEPS = ['off', 'enable', 'input', 'pause', 'apply', 'result'] as const
type Phase = (typeof LIVE_STEPS)[number]

export function LiveTranslationDemo({ compact = false }: { compact?: boolean }) {
  const t = useMessages()
  const { direction, locale } = useI18n()
  const d = t.demos.live
  const reduced = usePrefersReducedMotion()
  const { ref, inView } = useInView<HTMLDivElement>()
  const [phase, setPhase] = useState<Phase>('off')

  const run = useCallback((later: Later) => {
    const t1 = DEMO_HOLD.stable
    const t2 = t1 + DEMO_HOLD.step
    const t3 = t2 + DEMO_HOLD.input
    const t4 = t3 + DEMO_HOLD.analyze
    const t5 = t4 + DEMO_HOLD.process
    const t6 = t5 + DEMO_HOLD.stable

    setPhase('off')
    later(() => setPhase('enable'), t1)
    later(() => setPhase('input'), t2)
    later(() => setPhase('pause'), t3)
    later(() => setPhase('apply'), t4)
    later(() => setPhase('result'), t5)
    later(() => setPhase('off'), t6)
    later(() => run(later), t6 + DEMO_HOLD.loopGap)
  }, [])

  useDemoSequence(Boolean(inView && !reduced), run)

  const liveOn = phase !== 'off'
  const translated = phase === 'apply' || phase === 'result'
  const visible =
    phase === 'off' || phase === 'enable' ? LIVE_SOURCE : translated ? LIVE_TARGET : LIVE_SOURCE

  const status =
    phase === 'off'
      ? d.status.off
      : phase === 'enable'
        ? d.status.enable
        : phase === 'input'
          ? d.status.input
          : phase === 'pause'
            ? d.status.pause
            : phase === 'apply'
              ? d.status.apply
              : d.status.done

  return (
    <figure ref={ref} className={compact ? 'compact-demo' : undefined} dir={direction} lang={locale}>
      <div className="live-toolbar" aria-hidden="true">
        <span>{d.toolbarTitle}</span>
        <span className={`popup-toggle${liveOn ? '' : ' is-off'}`} />
        <span className={`live-flag${liveOn ? ' is-on' : ''}`}>
          {liveOn ? d.toggleOn : d.toggleOff}
        </span>
      </div>
      <ComposeFrame title={d.frameTitle} status={status}>
        <p className="compose-text" dir={translated ? 'rtl' : 'ltr'} lang={translated ? 'ar' : 'en'}>
          {visible}
        </p>
      </ComposeFrame>
      {compact ? null : (
        <>
          <DemoCaption />
          <p className="mock-caption">
            {d.caption.replace('{source}', LIVE_SOURCE).replace('{target}', LIVE_TARGET)}
          </p>
        </>
      )}
    </figure>
  )
}
