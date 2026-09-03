import { useMemo } from 'react'
import { STORY_HOLD } from '../../hooks/demoPhases.ts'
import { useScrollStory } from '../../hooks/useScrollStory.ts'
import { useTypingReveal } from '../../hooks/useTypingReveal.ts'
import { PRIMARY_LAYOUT_EXAMPLE } from '../../lib/layoutDemo.ts'
import { useI18n, useMessages } from '../../i18n/index.tsx'
import { ProductScene, WritingField } from './ProductScene.tsx'
import {
  WRITING_HELP_FIXED as WRITING_FIXED,
  WRITING_HELP_FIX as WRITING_FIX,
} from './WritingHelpScene.tsx'
import { TRANSLATION_SOURCE } from './TranslationScene.tsx'

const PROBLEM_STORY = [
  { id: 'layout', holdMs: STORY_HOLD.mode + STORY_HOLD.transition },
  { id: 'writing', holdMs: STORY_HOLD.mode + STORY_HOLD.transition },
  { id: 'translate', holdMs: STORY_HOLD.result },
] as const

type ProblemMode = (typeof PROBLEM_STORY)[number]['id']

function renderWritingFixed() {
  const parts = WRITING_FIXED.split(new RegExp(`(${WRITING_FIX})`))
  return parts.map((part: string, index: number) =>
    part === WRITING_FIX ? (
      <mark key={index} className="xp-mark-fix">
        {part}
      </mark>
    ) : (
      <span key={index}>{part}</span>
    ),
  )
}

export function ProblemFieldStage() {
  const t = useMessages()
  const { direction, locale } = useI18n()
  const copy = t.marketingHome.problem
  const { typed, intended } = PRIMARY_LAYOUT_EXAMPLE

  const layoutStory = useMemo(
    () => [{ id: 'type', holdMs: typed.length * STORY_HOLD.typeChar + STORY_HOLD.typingPause }],
    [typed],
  )
  const story = useScrollStory([...layoutStory, ...PROBLEM_STORY])
  const mode: ProblemMode =
    story.stepId === 'writing' ? 'writing' : story.stepId === 'translate' ? 'translate' : 'layout'

  const layoutText = useTypingReveal(typed, story.started && story.stepId === 'type')
  const layoutFixed = story.stepId !== 'type' && mode === 'layout'

  const glow = mode === 'layout' ? 'magenta' : mode === 'writing' ? 'cyan' : 'mixed'

  return (
    <div ref={story.ref} className="xp-problem-stage" dir={direction} lang={locale}>
      <ProductScene url={t.demos.browser.pageUrl} size="hero" glow={glow}>
        {mode === 'layout' ? (
          <WritingField
            value={layoutFixed ? intended : layoutText}
            dir={layoutFixed ? 'rtl' : 'ltr'}
            lang={layoutFixed ? 'ar' : 'en'}
            focused={!layoutFixed}
          />
        ) : null}
        {mode === 'writing' ? (
          <WritingField value={renderWritingFixed()} dir="ltr" lang="en" />
        ) : null}
        {mode === 'translate' ? (
          <WritingField value={TRANSLATION_SOURCE} dir="rtl" lang="ar" focused />
        ) : null}
      </ProductScene>

      <div className="xp-problem-signals" role="list">
        {copy.items.map((item, index) => {
          const problem = item as { tag: string; body: string; accent: string }
          const active =
            (mode === 'layout' && index === 0) ||
            (mode === 'writing' && index === 1) ||
            (mode === 'translate' && index === 2)
          return (
            <article
              key={problem.tag}
              className={`xp-problem-signal xp-problem-signal-${problem.accent}${active ? ' is-active' : ''}`}
              role="listitem"
            >
              <span className="xp-problem-signal-ghost">{problem.tag}</span>
              <p>{problem.body}</p>
            </article>
          )
        })}
      </div>
    </div>
  )
}
