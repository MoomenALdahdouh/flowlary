import { useMemo } from 'react'
import { STEP_HOLD, STORY_HOLD } from '../../hooks/demoPhases.ts'
import { useScrollStory } from '../../hooks/useScrollStory.ts'
import { useTypingReveal } from '../../hooks/useTypingReveal.ts'
import { useSteppedDemo } from '../../hooks/useSteppedDemo.ts'
import { useInView } from '../../hooks/useInView.ts'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion.ts'
import { PRIMARY_LAYOUT_EXAMPLE } from '../../lib/layoutDemo.ts'
import { useI18n, useMessages } from '../../i18n/index.tsx'
import { FidelityBadge } from '../Ui.tsx'
import { ProductScene, WritingField } from './ProductScene.tsx'
import { DemoPhaseRail, SteppedDemoControls } from './SteppedDemoControls.tsx'

const LAB_STEPS = [
  { id: 'input', holdMs: STEP_HOLD.input },
  { id: 'detect', holdMs: STEP_HOLD.detect },
  { id: 'interpret', holdMs: STEP_HOLD.interpret },
  { id: 'action', holdMs: STEP_HOLD.action },
  { id: 'result', holdMs: STEP_HOLD.result },
] as const

export type ScenePresentation = 'story' | 'lab'

function keyboardStorySteps(typed: string) {
  return [
    { id: 'typing', holdMs: typed.length * STORY_HOLD.typeChar + STORY_HOLD.typingPause },
    { id: 'detect', holdMs: STORY_HOLD.detect },
    { id: 'interpret', holdMs: STORY_HOLD.interpret },
    { id: 'action', holdMs: STORY_HOLD.action },
    { id: 'result', holdMs: STORY_HOLD.result },
  ]
}

export function KeyboardFixScene({
  size = 'large',
  presentation = 'lab',
}: {
  size?: 'large' | 'hero' | 'default'
  presentation?: ScenePresentation
}) {
  const t = useMessages()
  const { direction, locale } = useI18n()
  const copy = t.experience.keyboardFix
  const reduced = usePrefersReducedMotion()
  const isLab = presentation === 'lab'
  const { typed, intended } = PRIMARY_LAYOUT_EXAMPLE

  const storySteps = useMemo(() => keyboardStorySteps(typed), [typed])
  const story = useScrollStory(storySteps)

  const { ref: labRef, inView } = useInView<HTMLDivElement>()
  const demo = useSteppedDemo({
    steps: [...LAB_STEPS],
    autoPlay: isLab && inView && !reduced,
    startPaused: isLab,
  })

  const ref = isLab ? labRef : story.ref
  const storyStep = story.stepId
  const labStep = LAB_STEPS[demo.index]?.id ?? 'input'
  const stepId = isLab ? labStep : storyStep === 'typing' ? 'input' : storyStep

  const typing = useTypingReveal(typed, !isLab && story.started && storyStep === 'typing')
  const mapped = stepId === 'action' || stepId === 'result'
  const display = isLab
    ? mapped
      ? intended
      : typed
    : storyStep === 'typing'
      ? typing
      : mapped
        ? intended
        : typed

  const status =
    stepId === 'input' || storyStep === 'typing'
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
    <div ref={ref} className={`xp-keyboard-fix xp-scene-presentation-${presentation}`} dir={direction} lang={locale}>
      {isLab ? (
        <div className="xp-scene-header">
          <FidelityBadge mode="simulated" />
          <DemoPhaseRail phases={phases} activeIndex={demo.index} />
        </div>
      ) : null}
      <ProductScene url={t.demos.browser.pageUrl} size={size} glow="magenta">
        <WritingField
          value={display}
          dir={mapped ? 'rtl' : 'ltr'}
          lang={mapped ? 'ar' : 'en'}
          focused={stepId === 'input' || storyStep === 'typing'}
          label={isLab ? copy.fieldLabel : undefined}
        >
          {stepId === 'detect' ? (
            <p className="xp-detection xp-detection-layout">{copy.detection.layoutMismatch}</p>
          ) : null}
          {stepId === 'interpret' ? (
            <p className="xp-detection xp-detection-intent">
              {copy.detection.intended.replace('{word}', intended)}
            </p>
          ) : null}
          {stepId === 'action' ? (
            <p className="xp-action-chip xp-action-layout">{copy.actionLabel}</p>
          ) : null}
          {stepId === 'result' ? (
            <p className="xp-result-chip xp-result-success">{copy.resultLabel}</p>
          ) : null}
        </WritingField>
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
