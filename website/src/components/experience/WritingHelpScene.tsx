import { useMemo, type ReactNode } from 'react'
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

const SOURCE = 'I want send the invoice today.'
const FIXED = 'I want to send the invoice today.'
const HIGHLIGHT = 'send'
const FIX = 'to send'

const LAB_STEPS = [
  { id: 'input', holdMs: STEP_HOLD.input },
  { id: 'detect', holdMs: STEP_HOLD.detect },
  { id: 'interpret', holdMs: STEP_HOLD.interpret },
  { id: 'action', holdMs: STEP_HOLD.action },
  { id: 'result', holdMs: STEP_HOLD.result },
] as const

const STORY_STEPS = [{ id: 'result', holdMs: STORY_HOLD.mode }] as const

function renderSentence(text: string, highlight?: string, fixed?: string): ReactNode {
  if (!highlight) return text
  const parts = text.split(new RegExp(`(${highlight}|${fixed ?? ''})`))
  return parts.map((part, index) => {
    if (part === highlight) {
      return (
        <mark key={index} className="xp-mark-error">
          {part}
        </mark>
      )
    }
    if (fixed && part === fixed) {
      return (
        <mark key={index} className="xp-mark-fix">
          {part}
        </mark>
      )
    }
    return <span key={index}>{part}</span>
  })
}

export function WritingHelpScene({
  size = 'large',
  presentation = 'lab',
  storyPhase = 'full',
}: {
  size?: 'large' | 'hero' | 'default'
  presentation?: ScenePresentation
  /** `snapshot` shows the corrected result for one-field carousel. */
  storyPhase?: 'full' | 'snapshot'
}) {
  const t = useMessages()
  const { direction, locale } = useI18n()
  const copy = t.experience.writingHelp
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

  const applied = stepId === 'action' || stepId === 'result'
  const display = applied ? FIXED : SOURCE

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
    <div ref={ref} className={`xp-writing-help xp-scene-presentation-${presentation}`} dir={direction} lang={locale}>
      {isLab ? (
        <div className="xp-scene-header">
          <FidelityBadge mode="simulated" />
          <DemoPhaseRail phases={phases} activeIndex={demo.index} />
        </div>
      ) : null}
      <ProductScene url={t.demos.browser.pageUrl} size={size} glow="cyan">
        <WritingField
          value={renderSentence(
            display,
            stepId === 'detect' || stepId === 'interpret' ? HIGHLIGHT : undefined,
            applied ? FIX : undefined,
          )}
          dir="ltr"
          lang="en"
          focused={stepId === 'input'}
          label={isLab ? copy.fieldLabel : undefined}
        >
          {stepId === 'detect' ? (
            <p className="xp-detection xp-detection-grammar">{copy.detection.grammar}</p>
          ) : null}
          {stepId === 'interpret' ? (
            <div className="xp-suggestion">
              <span className="xp-suggestion-label">{copy.suggestionLabel}</span>
              <span className="xp-suggestion-change">
                [{HIGHLIGHT}] → [{FIX}]
              </span>
            </div>
          ) : null}
          {stepId === 'action' ? (
            <p className="xp-action-chip xp-action-writing">{copy.actionLabel}</p>
          ) : null}
          {applied ? <p className="xp-result-chip xp-result-success">{copy.actionLabel}</p> : null}
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

export { SOURCE as WRITING_HELP_SOURCE, FIXED as WRITING_HELP_FIXED, HIGHLIGHT as WRITING_HELP_HIGHLIGHT, FIX as WRITING_HELP_FIX }
