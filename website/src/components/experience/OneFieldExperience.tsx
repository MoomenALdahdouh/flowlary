import { useMemo } from 'react'
import { STORY_HOLD } from '../../hooks/demoPhases.ts'
import { useScrollStory } from '../../hooks/useScrollStory.ts'
import { useTypingReveal } from '../../hooks/useTypingReveal.ts'
import {
  useHeroDemoSequence,
  type HeroDemoSequence,
} from '../../hooks/useHeroDemoSequence.ts'
import { PRIMARY_LAYOUT_EXAMPLE, MARKETING_LAYOUT_EXAMPLE } from '../../lib/layoutDemo.ts'
import { useI18n, useMessages } from '../../i18n/index.tsx'
import { FidelityBadge } from '../Ui.tsx'
import { ProductScene, WritingField } from './ProductScene.tsx'
import {
  WRITING_HELP_FIX as WRITING_WRONG,
  WRITING_HELP_FIXED as WRITING_FIXED,
  WRITING_HELP_FIX as WRITING_FIX,
} from './WritingHelpScene.tsx'
import { TRANSLATION_RESULT, TRANSLATION_SOURCE } from './TranslationScene.tsx'

type CapabilityStep =
  | 'layout-type'
  | 'layout-fix'
  | 'writing-wrong'
  | 'writing-fix'
  | 'translate-ar'
  | 'translate-en'

type Mode = 'layout' | 'writing' | 'translate'

function capabilityStorySteps(typed: string) {
  return [
    { id: 'layout-type', holdMs: typed.length * STORY_HOLD.typeChar + STORY_HOLD.typingPause },
    { id: 'layout-fix', holdMs: STORY_HOLD.mode },
    { id: 'writing-wrong', holdMs: STORY_HOLD.mode },
    { id: 'writing-fix', holdMs: STORY_HOLD.mode },
    { id: 'translate-ar', holdMs: STORY_HOLD.mode },
    { id: 'translate-en', holdMs: STORY_HOLD.result },
  ]
}

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

function renderWritingWrong() {
  const needle = 'send'
  const idx = WRITING_WRONG.indexOf(needle)
  if (idx < 0) return WRITING_WRONG
  return (
    <>
      {WRITING_WRONG.slice(0, idx)}
      <span className="xp-mark-wrong">{needle}</span>
      {WRITING_WRONG.slice(idx + needle.length)}
    </>
  )
}

function stepMode(stepId: string): Mode {
  if (stepId.startsWith('writing')) return 'writing'
  if (stepId.startsWith('translate')) return 'translate'
  return 'layout'
}

/** Auto sequential one-field story — single field transforms, no controls. */
export function OneFieldStory() {
  const t = useMessages()
  const { direction, locale } = useI18n()
  const copy = t.experience.oneField
  const home = t.marketingHome.oneField
  const { typed, intended } = PRIMARY_LAYOUT_EXAMPLE

  const storySteps = useMemo(() => capabilityStorySteps(typed), [typed])
  const story = useScrollStory(storySteps)
  const stepId = (story.stepId as CapabilityStep) || 'layout-type'
  const mode = stepMode(stepId)

  const layoutText = useTypingReveal(typed, story.started && stepId === 'layout-type')

  const tabs: { id: Mode; label: string; accent: string }[] = useMemo(
    () => [
      { id: 'layout', label: copy.tabs.layout, accent: 'magenta' },
      { id: 'writing', label: copy.tabs.writing, accent: 'cyan' },
      { id: 'translate', label: copy.tabs.translate, accent: 'magenta' },
    ],
    [copy.tabs],
  )

  const glow = mode === 'layout' ? 'magenta' : mode === 'writing' ? 'cyan' : 'mixed'

  const fieldValue =
    stepId === 'layout-type'
      ? layoutText
      : stepId === 'layout-fix'
        ? intended
        : stepId === 'writing-wrong'
          ? renderWritingWrong()
          : stepId === 'writing-fix'
            ? renderWritingFixed()
            : stepId === 'translate-ar'
              ? TRANSLATION_SOURCE
              : TRANSLATION_RESULT

  const fieldDir =
    stepId === 'layout-fix' || stepId === 'translate-ar' ? 'rtl' : 'ltr'

  const fieldLang =
    stepId === 'layout-fix'
      ? 'ar'
      : stepId === 'translate-ar'
        ? 'ar'
        : stepId === 'translate-en'
          ? 'en'
          : 'en'

  const status =
    stepId === 'layout-type'
      ? t.experience.keyboardFix.status.input
      : stepId === 'layout-fix'
        ? t.experience.keyboardFix.status.result
        : stepId === 'writing-wrong'
          ? t.experience.writingHelp.status.detect
          : stepId === 'writing-fix'
            ? t.experience.writingHelp.status.result
            : stepId === 'translate-ar'
              ? t.experience.translation.status.interpret
              : t.experience.translation.status.result

  return (
    <div ref={story.ref} className="xp-one-field xp-one-field-story" dir={direction} lang={locale}>
      <div className="xp-one-field-tabs" role="presentation" aria-hidden="true">
        {tabs.map((tab) => (
          <span
            key={tab.id}
            className={`xp-one-field-tab xp-accent-${tab.accent}${mode === tab.id ? ' is-active' : ''}`}
          >
            {tab.label}
          </span>
        ))}
      </div>

      <div className="xp-one-field-panel">
        <ProductScene url={t.demos.browser.pageUrl} size="hero" glow={glow}>
          <WritingField
            value={fieldValue}
            dir={fieldDir}
            lang={fieldLang}
            focused={stepId === 'layout-type' || stepId === 'writing-wrong' || stepId === 'translate-ar'}
          >
            {stepId === 'layout-fix' ? (
              <p className="xp-result-chip xp-result-success">{t.experience.keyboardFix.resultLabel}</p>
            ) : null}
            {stepId === 'writing-fix' ? (
              <p className="xp-result-chip xp-result-success">{t.experience.writingHelp.actionLabel}</p>
            ) : null}
            {stepId === 'translate-ar' ? (
              <>
                <p className="xp-detection xp-detection-lang">{t.experience.translation.detection.arabic}</p>
                <p className="xp-detection xp-detection-complete">{t.experience.translation.detection.complete}</p>
              </>
            ) : null}
            {stepId === 'translate-en' ? (
              <p className="xp-action-chip xp-action-translate">{t.experience.translation.actionLabel}</p>
            ) : null}
          </WritingField>
          <p className="xp-scene-caption" role="status">
            {status}
          </p>
        </ProductScene>
      </div>

      <div className="xp-lang-bridge" aria-hidden="true">
        <span className="xp-lang-bridge-ar">{home.langArabic}</span>
        <span className="xp-lang-bridge-line" />
        <span className="xp-lang-bridge-en">{home.langEnglish}</span>
      </div>

      <p className="xp-one-field-caption">{copy.caption}</p>
    </div>
  )
}

/** Try section — automatic translation story in one field. */
export function TryTranslationStory() {
  const t = useMessages()
  const { direction, locale } = useI18n()
  const copy = t.experience.translation

  const storySteps = useMemo(
    () => [
      { id: 'input', holdMs: STORY_HOLD.typingPause + 400 },
      { id: 'detect', holdMs: STORY_HOLD.detect },
      { id: 'interpret', holdMs: STORY_HOLD.interpret },
      { id: 'action', holdMs: STORY_HOLD.action },
      { id: 'result', holdMs: STORY_HOLD.result },
    ],
    [],
  )

  const story = useScrollStory(storySteps)
  const stepId = story.stepId || 'input'
  const translated = stepId === 'action' || stepId === 'result'

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

  return (
    <div ref={story.ref} className="xp-try-translation-story" dir={direction} lang={locale}>
      <ProductScene url={t.demos.browser.pageUrl} size="hero" glow="mixed">
        <WritingField
          value={translated ? TRANSLATION_RESULT : TRANSLATION_SOURCE}
          dir={translated ? 'ltr' : 'rtl'}
          lang={translated ? 'en' : 'ar'}
          focused={stepId === 'input'}
        >
          {stepId === 'detect' ? (
            <p className="xp-detection xp-detection-lang">{copy.detection.arabic}</p>
          ) : null}
          {stepId === 'interpret' ? (
            <p className="xp-detection xp-detection-complete">{copy.detection.complete}</p>
          ) : null}
          {stepId === 'action' ? (
            <p className="xp-action-chip xp-action-translate">{copy.actionLabel}</p>
          ) : null}
          {stepId === 'result' ? (
            <p className="xp-result-chip xp-result-success">{copy.resultLabel}</p>
          ) : null}
        </WritingField>
        <p className="xp-scene-caption" role="status">
          {status}
        </p>
      </ProductScene>
    </div>
  )
}

/** Hero landing — Base44 parity: 3-step sequences per mode with typing + status chips. */
export function HeroLandingPreview() {
  const t = useMessages()
  const { direction, locale } = useI18n()
  const hero = t.marketingHome.hero
  const { typed, intended } = MARKETING_LAYOUT_EXAMPLE

  const sequences = useMemo<HeroDemoSequence[]>(
    () => [
      {
        id: 'fix',
        accent: 'magenta',
        badge: 'FIX',
        steps: [
          { text: typed, state: 'error' },
          { text: typed, state: 'correcting' },
          { text: intended, state: 'corrected' },
        ],
      },
      {
        id: 'write',
        accent: 'cyan',
        badge: 'WRITE',
        steps: [
          { text: 'I need send the report', state: 'error' },
          { text: 'I need send the report', state: 'correcting' },
          { text: 'I need to send the report.', state: 'corrected' },
        ],
      },
      {
        id: 'translate',
        accent: 'magenta',
        badge: 'TRANSLATE',
        steps: [
          { text: 'أحتاج إلى إرسال التقرير', state: 'idle' },
          { text: 'أحتاج إلى إرسال التقرير', state: 'correcting' },
          { text: 'I need to send the report.', state: 'corrected' },
        ],
      },
    ],
    [intended, typed],
  )

  const { seqIdx, stepIdx, displayText, currentSeq, currentStep, pickSequence } =
    useHeroDemoSequence(sequences)

  const seqT = hero.seq[currentSeq.id as keyof typeof hero.seq]
  const accentColor =
    currentSeq.accent === 'magenta' ? 'var(--fl-brand-magenta)' : 'var(--fl-brand-cyan)'

  const textColor =
    currentStep.state === 'error'
      ? 'var(--fl-brand-magenta)'
      : currentStep.state === 'correcting'
        ? 'var(--fl-brand-magenta)'
        : currentStep.state === 'corrected'
          ? 'var(--fl-brand-cyan)'
          : 'var(--fl-muted)'

  const isRtl =
    currentSeq.id === 'translate' && stepIdx === 0
      ? true
      : currentSeq.id === 'fix' && currentStep.state === 'corrected'

  const isArabicFont =
    (currentSeq.id === 'translate' && stepIdx === 0) ||
    (currentSeq.id === 'fix' && currentStep.state === 'corrected')

  return (
    <div className="xp-hero-preview xp-hero-landing xp-hero-sequence" dir={direction} lang={locale}>
      <div className="xp-hero-landing-glow" aria-hidden="true" />
      <div className="xp-hero-landing-stage xp-one-field-swap" key={`${seqIdx}-${stepIdx}`}>
        <ProductScene url={t.demos.browser.pageUrl} size="hero" glow={currentSeq.accent === 'purple' ? 'mixed' : currentSeq.accent === 'cyan' ? 'cyan' : 'magenta'}>
          <div className="xp-hero-translate-panel">
            <div className="xp-hero-translate-meta">
              <span
                className={`xp-hero-mode-tag xp-hero-mode-tag-${currentSeq.id}`}
                style={{ color: accentColor, borderColor: `color-mix(in srgb, ${accentColor} 25%, transparent)` }}
              >
                {currentSeq.badge}
              </span>
              <span className="xp-hero-mode-hint">{seqT.hints[stepIdx]}</span>
              <FidelityBadge mode="simulated" />
            </div>

            <div className="xp-hero-sequence-field" dir={isRtl ? 'rtl' : 'ltr'}>
              <span
                className="xp-hero-sequence-text"
                style={{
                  color: textColor,
                  fontFamily: isArabicFont ? 'var(--fl-font-arabic)' : undefined,
                  textDecoration: currentStep.state === 'error' ? 'underline' : 'none',
                  textDecorationStyle: 'wavy',
                  textDecorationColor: 'var(--fl-brand-magenta)',
                }}
              >
                {displayText}
              </span>
              <span className="xp-cursor" aria-hidden="true" />
            </div>

            {currentStep.state === 'correcting' ? (
              <div className="xp-hero-working" role="status">
                <span className="xp-hero-working-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
                {hero.working}
              </div>
            ) : null}

            {currentStep.state === 'corrected' ? (
              <div className="xp-hero-done" role="status">
                <span className="xp-hero-done-icon" aria-hidden="true">✓</span>
                {hero.doneStill}
              </div>
            ) : null}
          </div>
        </ProductScene>
      </div>

      <div className="xp-hero-landing-tabs" role="tablist" aria-label={t.experience.oneField.tablistLabel}>
        {sequences.map((seq, i) => (
          <button
            key={seq.id}
            type="button"
            role="tab"
            aria-selected={seqIdx === i}
            className={`xp-one-field-tab xp-accent-${seq.accent}${seqIdx === i ? ' is-active' : ''}`}
            onClick={() => pickSequence(i)}
          >
            {hero.seq[seq.id as keyof typeof hero.seq].label}
          </button>
        ))}
        <span className="xp-hero-landing-explore xp-hero-auto-hint">{hero.autoExplore}</span>
      </div>
    </div>
  )
}

/** Keyboard-fix typing story for compact embeds. */
export function HeroProductStory({ compact = false }: { compact?: boolean }) {
  const t = useMessages()
  const { direction, locale } = useI18n()
  const copy = t.experience.keyboardFix
  const { typed, intended } = PRIMARY_LAYOUT_EXAMPLE

  const storySteps = useMemo(
    () => [
      { id: 'typing', holdMs: typed.length * STORY_HOLD.typeChar + STORY_HOLD.typingPause },
      { id: 'detect', holdMs: STORY_HOLD.detect },
      { id: 'interpret', holdMs: STORY_HOLD.interpret },
      { id: 'action', holdMs: STORY_HOLD.action },
      { id: 'result', holdMs: STORY_HOLD.result },
    ],
    [typed],
  )

  const story = useScrollStory(storySteps)
  const typing = useTypingReveal(typed, story.started && story.stepId === 'typing')
  const mapped = story.stepId === 'action' || story.stepId === 'result'
  const display = story.stepId === 'typing' ? typing : mapped ? intended : typed
  const stepId =
    story.stepId === 'typing'
      ? 'input'
      : (story.stepId as 'detect' | 'interpret' | 'action' | 'result')

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

  return (
    <div
      ref={story.ref}
      className={`xp-hero-preview xp-hero-story${compact ? ' is-compact' : ''}`}
      dir={direction}
      lang={locale}
    >
      <div className="xp-hero-preview-glow" aria-hidden="true" />
      <ProductScene
        url={t.demos.browser.pageUrl}
        size={compact ? 'large' : 'hero'}
        glow="mixed"
      >
        <WritingField
          value={display}
          dir={mapped ? 'rtl' : 'ltr'}
          lang={mapped ? 'ar' : 'en'}
          focused={stepId === 'input'}
        >
          {stepId === 'detect' ? (
            <p className="xp-detection xp-detection-layout">{copy.detection.layoutMismatch}</p>
          ) : null}
          {stepId === 'interpret' ? (
            <p className="xp-detection xp-detection-intent">
              {copy.detection.intended.replace('{word}', intended)}
            </p>
          ) : null}
          {stepId === 'action' ? <p className="xp-action-chip xp-action-layout">{copy.actionLabel}</p> : null}
          {stepId === 'result' ? (
            <p className="xp-result-chip xp-result-success">{copy.resultLabel}</p>
          ) : null}
        </WritingField>
        <p className="xp-scene-caption" role="status">
          {status}
        </p>
      </ProductScene>
    </div>
  )
}

/** Try section wrapper with simulated badge */
export function TryProductStory() {
  return (
    <div className="xp-try-story">
      <TryTranslationStory />
    </div>
  )
}

/** @deprecated Use HeroProductStory */
export function HeroFieldPreview(props: { compact?: boolean }) {
  return <HeroProductStory {...props} />
}

/** @deprecated Use OneFieldStory on homepage */
export function OneFieldExperience() {
  return <OneFieldStory />
}
