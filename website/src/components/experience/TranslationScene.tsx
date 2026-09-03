import { useMemo } from 'react'
import { FidelityBadge } from '../Ui.tsx'
import { STEP_HOLD, STORY_HOLD } from '../../hooks/demoPhases.ts'
import { useScrollStory } from '../../hooks/useScrollStory.ts'
import { useSteppedDemo } from '../../hooks/useSteppedDemo.ts'
import { useInView } from '../../hooks/useInView.ts'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion.ts'
import { useI18n, useMessages } from '../../i18n/index.tsx'
import { ProductScene, WritingField } from './ProductScene.tsx'
import { DemoPhaseRail, SteppedDemoControls } from './SteppedDemoControls.tsx'
import type { ScenePresentation } from './KeyboardFixScene.tsx'

const SOURCE = 'أريد إرسال الفاتورة اليوم.'
const TRANSLATED = 'I want to send the invoice today.'

const LAB_STEPS = [
  { id: 'input', holdMs: STEP_HOLD.input },
  { id: 'detect', holdMs: STEP_HOLD.detect },
  { id: 'interpret', holdMs: STEP_HOLD.interpret },
  { id: 'action', holdMs: STEP_HOLD.action },
  { id: 'result', holdMs: STEP_HOLD.result },
] as const

const STORY_STEPS = [{ id: 'result', holdMs: STORY_HOLD.mode }] as const

export function TranslationScene({
  size = 'large',
  presentation = 'lab',
  storyPhase = 'full',
}: {
  size?: 'large' | 'hero' | 'default'
  presentation?: ScenePresentation
  storyPhase?: 'full' | 'snapshot'
}) {
  const t = useMessages()
  const { direction, locale } = useI18n()
  const copy = t.experience.translation
  const reduced = usePrefersReducedMotion()
  const isLab = presentation === 'lab'
  const isSnapshot = !isLab && storyPhase === 'snapshot'

  const story = useScrollStory([...STORY_STEPS])
  const { ref: labRef, inView } = useInView<HTMLDivElement>()
  const demo = useSteppedDemo({
    steps: [...LAB_STEPS],
    autoPlay: isLab && inView && !reduced,
    startPaused: isLab,
  })

  const ref = isLab ? labRef : story.ref
  const labStep = LAB_STEPS[demo.index]?.id ?? 'input'
  const stepId = isLab ? labStep : isSnapshot ? 'result' : story.stepId === 'result' ? 'result' : 'input'

  const translated = stepId === 'result'
  const showEnglish = stepId === 'action' || stepId === 'result'

  const status =
    stepId === 'input'
      ? copy.status.input
      : stepId === 'detect'
        ? copy.status.detect
        : stepId === 'interpret'
          ? copy.status.interpret
          : stepId === 'action'
            ? copy.status.action
            : copy.status.result

  const phases = useMemo(
    () => [
      { id: 'input', label: copy.phases.input },
      { id: 'detect', label: copy.phases.detect },
      { id: 'interpret', label: copy.phases.interpret },
      { id: 'action', label: copy.phases.action },
      { id: 'result', label: copy.phases.result },
    ],
    [copy.phases],
  )

  return (
    <div ref={ref} className={`xp-translation xp-scene-presentation-${presentation}`} dir={direction} lang={locale}>
      {isLab ? (
        <div className="xp-scene-header">
          <FidelityBadge mode="simulated" />
          <DemoPhaseRail phases={phases} activeIndex={demo.index} />
        </div>
      ) : null}
      <ProductScene url={t.demos.browser.pageUrl} size={size} glow="mixed">
        {showEnglish ? (
          <div className="xp-translate-stack">
            <WritingField value={SOURCE} dir="rtl" lang="ar" label={isLab ? copy.sourceLabel : undefined} />
            <div className="xp-translate-bridge" aria-hidden="true">
              <span className="xp-translate-arrow">↓</span>
              <span className="xp-action-chip xp-action-translate">{copy.actionLabel}</span>
            </div>
            <WritingField
              value={TRANSLATED}
              dir="ltr"
              lang="en"
              label={isLab ? copy.resultLabel : undefined}
              focused={translated}
            />
          </div>
        ) : (
          <WritingField
            value={SOURCE}
            dir="rtl"
            lang="ar"
            focused={stepId === 'input'}
            label={isLab ? copy.fieldLabel : undefined}
          >
            {stepId === 'detect' ? (
              <p className="xp-detection xp-detection-lang">{copy.detection.arabic}</p>
            ) : null}
            {stepId === 'interpret' ? (
              <p className="xp-detection xp-detection-complete">{copy.detection.complete}</p>
            ) : null}
          </WritingField>
        )}
        <p className={isLab ? 'xp-status-line' : 'xp-scene-caption'} role="status">
          {status}
        </p>
      </ProductScene>
      {isLab ? (
        <SteppedDemoControls
          playing={demo.playing}
          isFirst={demo.isFirst}
          isLast={demo.isLast}
          onPlay={demo.play}
          onPause={demo.pause}
          onNext={demo.next}
          onPrev={demo.prev}
          onReplay={demo.replay}
          onReset={demo.reset}
        />
      ) : null}
    </div>
  )
}

export { SOURCE as TRANSLATION_SOURCE, TRANSLATED as TRANSLATION_RESULT }
