import { useCallback, useEffect, useState } from 'react'
import { STORY_HOLD } from '../../hooks/demoPhases.ts'
import { useScrollStory } from '../../hooks/useScrollStory.ts'
import { MARKETING_LAYOUT_EXAMPLE } from '../../lib/layoutDemo.ts'
import { useI18n, useMessages } from '../../i18n/index.tsx'
import { TRANSLATION_RESULT, TRANSLATION_SOURCE } from './TranslationScene.tsx'
import {
  WRITING_HELP_FIX,
  WRITING_HELP_FIXED,
  WRITING_HELP_HIGHLIGHT,
  WRITING_HELP_SOURCE,
} from './WritingHelpScene.tsx'

type CapabilityMode = 'layout' | 'writing' | 'translate'

const AUTO_STORY = [
  { id: 'layout', holdMs: STORY_HOLD.mode + 800 },
  { id: 'writing', holdMs: STORY_HOLD.mode },
  { id: 'translate', holdMs: STORY_HOLD.mode + STORY_HOLD.transition },
] as const

function WritingBeforeText() {
  const text = WRITING_HELP_SOURCE
  const idx = text.indexOf(WRITING_HELP_HIGHLIGHT)
  if (idx < 0) return text
  return (
    <>
      {text.slice(0, idx)}
      <span className="xp-cap-wrong-mark">{WRITING_HELP_HIGHLIGHT}</span>
      {text.slice(idx + WRITING_HELP_HIGHLIGHT.length)}
    </>
  )
}

function WritingAfterText() {
  const text = WRITING_HELP_FIXED
  const idx = text.indexOf(WRITING_HELP_FIX)
  if (idx < 0) return text
  return (
    <>
      {text.slice(0, idx)}
      <strong>{WRITING_HELP_FIX}</strong>
      {text.slice(idx + WRITING_HELP_FIX.length)}
    </>
  )
}

function CapabilitySimulation({ mode }: { mode: CapabilityMode }) {
  const t = useMessages()
  const copy = t.marketingHome.oneField
  const { typed, intended } = MARKETING_LAYOUT_EXAMPLE

  return (
    <div className="xp-cap-sim" aria-label={copy.simAriaLabel}>
      <header className="xp-cap-sim-head">
        <span className="xp-cap-sim-meta">{copy.simHeader}</span>
        <span className="xp-cap-sim-badge">{copy.simBadge}</span>
      </header>

      <div className="xp-cap-sim-fields">
        <div className="xp-cap-sim-block">
          <span className="xp-cap-sim-label">{copy.beforeLabel}</span>
          <div
            className={`xp-cap-sim-field is-before xp-cap-accent-${mode}`}
            dir={mode === 'translate' ? 'rtl' : 'ltr'}
            lang={mode === 'translate' ? 'ar' : 'en'}
          >
            {mode === 'layout' ? (
              <span className="xp-cap-wrong-mark">{typed}</span>
            ) : null}
            {mode === 'writing' ? <WritingBeforeText /> : null}
            {mode === 'translate' ? TRANSLATION_SOURCE : null}
          </div>
        </div>

        <div className="xp-cap-sim-bridge" aria-hidden="true">
          <span className="xp-cap-sim-arrow">↓</span>
          <span className="xp-cap-sim-brand">{copy.bridgeBrand}</span>
        </div>

        <div className="xp-cap-sim-block">
          <span className="xp-cap-sim-label">{copy.afterLabel}</span>
          <div
            className={`xp-cap-sim-field is-after xp-cap-accent-${mode}`}
            dir={mode === 'layout' || mode === 'translate' ? (mode === 'layout' ? 'rtl' : 'ltr') : 'ltr'}
            lang={mode === 'layout' ? 'ar' : mode === 'translate' ? 'en' : 'en'}
          >
            {mode === 'layout' ? intended : null}
            {mode === 'writing' ? <WritingAfterText /> : null}
            {mode === 'translate' ? TRANSLATION_RESULT : null}
          </div>
        </div>
      </div>
    </div>
  )
}

export function CapabilitiesShowcase() {
  const t = useMessages()
  const { direction, locale } = useI18n()
  const copy = t.marketingHome.oneField
  const [mode, setMode] = useState<CapabilityMode>('layout')
  const [userPicked, setUserPicked] = useState(false)

  const story = useScrollStory([...AUTO_STORY])

  useEffect(() => {
    if (userPicked) return
    const next = story.stepId as CapabilityMode
    if (next === 'layout' || next === 'writing' || next === 'translate') {
      setMode(next)
    }
  }, [story.stepId, userPicked])

  const pickMode = useCallback((next: CapabilityMode) => {
    setUserPicked(true)
    setMode(next)
  }, [])

  const tabs: { id: CapabilityMode; label: string; accent: string }[] = [
    { id: 'layout', label: copy.tabs.fix, accent: 'magenta' },
    { id: 'writing', label: copy.tabs.write, accent: 'cyan' },
    { id: 'translate', label: copy.tabs.translate, accent: 'magenta' },
  ]

  const item = copy.items[mode]

  return (
    <div ref={story.ref} className="xp-capabilities-showcase" dir={direction} lang={locale}>
      <div className="xp-capabilities-tabs" role="tablist" aria-label={copy.tablistLabel}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={mode === tab.id}
            className={`xp-capabilities-tab xp-accent-${tab.accent}${mode === tab.id ? ' is-active' : ''}`}
            onClick={() => pickMode(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="xp-capabilities-stage xp-capabilities-swap" key={mode}>
        <article className={`xp-cap-card xp-cap-accent-${mode}`}>
          <span className="xp-cap-card-badge">{item.badge}</span>
          <h3 className="xp-cap-card-title">
            <span>{item.title}</span>
            <span className="xp-cap-card-title-ar" lang="ar" dir="rtl">
              {item.titleArabic}
            </span>
          </h3>
          <p className="xp-cap-card-body">{item.body}</p>
          <p className="xp-cap-card-foot">
            <span className="xp-cap-card-foot-icon" aria-hidden="true">
              ◎
            </span>
            {item.footnote}
          </p>
        </article>

        <CapabilitySimulation mode={mode} />
      </div>

      <div className="xp-lang-bridge xp-capabilities-bridge" aria-hidden="true">
        <span className="xp-lang-bridge-ar">{copy.langArabic}</span>
        <span className="xp-lang-bridge-center">↔ {copy.bilingualLabel}</span>
        <span className="xp-lang-bridge-en">{copy.langEnglish}</span>
      </div>
    </div>
  )
}
