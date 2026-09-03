import { useMemo, useState } from 'react'
import { useTypingReveal } from '../../hooks/useTypingReveal.ts'
import { MARKETING_LAYOUT_EXAMPLE } from '../../lib/layoutDemo.ts'
import { useI18n, useMessages } from '../../i18n/index.tsx'
import { TRANSLATION_RESULT } from './TranslationScene.tsx'

type WalkthroughAccent = 'magenta' | 'cyan'

type WalkthroughStep = {
  id: string
  badge: string
  accent: WalkthroughAccent
  title: string
  titleArabic: string
  lead: string
  actionLabel: string
  status: string
  fieldContent: string
  fieldFixed: string
  fieldDir: 'ltr' | 'rtl'
  fixedDir: 'ltr' | 'rtl'
}

function FieldDisplay({
  step,
  showFixed,
  typed,
}: {
  step: WalkthroughStep
  showFixed: boolean
  typed: string
}) {
  const text = showFixed ? step.fieldFixed : step.id === 'fix' ? typed : step.fieldContent
  const dir = showFixed ? step.fixedDir : step.fieldDir
  const isWrong = !showFixed && step.id !== 'flow'
  const isArabic =
    (step.id === 'fix' && showFixed) ||
    (step.id === 'translate' && !showFixed) ||
    (step.id === 'fix' && !showFixed && false)

  return (
    <p
      className={`xp-kb-field-text${showFixed ? ' is-fixed' : isWrong ? ' is-wrong' : ''}`}
      dir={dir}
      lang={dir === 'rtl' ? 'ar' : 'en'}
      style={{
        fontFamily: isArabic || (step.id === 'translate' && !showFixed) || (step.id === 'fix' && showFixed)
          ? 'var(--fl-font-arabic)'
          : undefined,
      }}
    >
      {text}
    </p>
  )
}

export function ActiveFieldWalkthrough() {
  const t = useMessages()
  const { direction, locale } = useI18n()
  const copy = t.marketingHome.keyboardFix
  const rawSteps = copy.steps
  const { typed, intended } = MARKETING_LAYOUT_EXAMPLE

  const steps = useMemo<WalkthroughStep[]>(
    () =>
      rawSteps.map((step) => {
        const accent = step.accent as WalkthroughAccent
        if (step.id === 'fix') {
          return {
            ...step,
            accent,
            fieldContent: typed,
            fieldFixed: intended,
            fieldDir: 'ltr' as const,
            fixedDir: 'rtl' as const,
          }
        }
        if (step.id === 'write') {
          return {
            ...step,
            accent,
            fieldContent: 'I need send the report today',
            fieldFixed: 'I need to send the report today.',
            fieldDir: 'ltr' as const,
            fixedDir: 'ltr' as const,
          }
        }
        if (step.id === 'translate') {
          return {
            ...step,
            accent,
            fieldContent: 'أحتاج إلى إرسال التقرير اليوم',
            fieldFixed: TRANSLATION_RESULT.replace('.', ' today.'),
            fieldDir: 'rtl' as const,
            fixedDir: 'ltr' as const,
          }
        }
        return {
          ...step,
          accent,
          fieldContent: 'I need to send the report today.',
          fieldFixed: 'I need to send the report today.',
          fieldDir: 'ltr' as const,
          fixedDir: 'ltr' as const,
        }
      }),
    [rawSteps, intended, typed],
  )

  const [activeStage, setActiveStage] = useState(0)

  const step = steps[activeStage] ?? steps[0]
  const layoutTyped = useTypingReveal(typed, activeStage === 0)

  return (
    <section
      className="xp-signature-scroll"
      aria-labelledby="xp-keyboard-title"
    >
      <div className="xp-signature-scroll-sticky">
        <div
          className={`xp-field-walkthrough xp-field-walkthrough-accent-${step.accent}`}
          dir={direction}
          lang={locale}
        >
          <p className="xp-keyboard-kicker">{copy.sectionKicker}</p>

          <div className="xp-split xp-keyboard-split">
            <div className="xp-split-copy xp-keyboard-copy">
              <ol className="xp-feature-stepper" aria-label={copy.stepperLabel}>
                {steps.map((s, index) => {
                  const num = index + 1
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        className={`xp-stepper-accent-${s.accent}${num === activeStage + 1 ? ' is-active' : ''}${num < activeStage + 1 ? ' is-done' : ''}`}
                        aria-label={`Go to stage ${num}: ${s.title}`}
                        onClick={() => setActiveStage(index)}
                      >
                        <span>{num}</span>
                      </button>
                    </li>
                  )
                })}
              </ol>
              <p className="xp-keyboard-badge">{step.badge}</p>
              <h2 id="xp-keyboard-title" className="xp-keyboard-title">
                <span>{step.title}</span>
                <span className="xp-keyboard-title-ar" lang="ar" dir="rtl">
                  {step.titleArabic}
                </span>
              </h2>
              <p className="mh-lead xp-keyboard-lead">{step.lead}</p>
            </div>

            <div
              className="xp-kb-field-mock xp-field-walkthrough-mock"
              aria-label={copy.ariaLabel.replace('{step}', step.title)}
            >
              <header className="xp-kb-field-head">
                <div className="xp-kb-field-file">
                  <span className="xp-kb-field-dot" aria-hidden="true" />
                  <span className="xp-kb-field-name">{copy.fileName}</span>
                </div>
                <span className="xp-kb-field-action-btn">{step.actionLabel}</span>
              </header>

              <div className="xp-kb-field-body">
                <span className="xp-kb-field-input-label">{copy.inputLabel}</span>
                <FieldDisplay step={step} showFixed={false} typed={layoutTyped} />
              </div>

              <footer className="xp-kb-field-foot">
                <span className="xp-kb-field-status-dot" aria-hidden="true" />
                <span role="status" aria-live="polite">
                  {step.status}
                </span>
              </footer>
            </div>
          </div>

          {activeStage === steps.length - 1 ? (
            <p className="xp-signature-final-line">{copy.finalLine}</p>
          ) : null}
        </div>
      </div>
    </section>
  )
}
