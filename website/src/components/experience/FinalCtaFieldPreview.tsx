import { useMemo } from 'react'
import { useAlternatingTypewriter } from '../../hooks/useAlternatingTypewriter.ts'
import { useI18n, useMessages } from '../../i18n/index.tsx'
import { FidelityBadge } from '../Ui.tsx'

export function FinalCtaFieldPreview() {
  const t = useMessages()
  const { direction, locale } = useI18n()
  const copy = t.marketingHome.final

  const steps = useMemo(
    () => copy.demoSteps.map((s) => ({ text: s.text })),
    [copy.demoSteps],
  )

  const { stepIdx, displayText, cursor } = useAlternatingTypewriter(steps)
  const step = copy.demoSteps[stepIdx] ?? copy.demoSteps[0]
  const accentColor =
    step.accent === 'magenta' ? 'var(--fl-brand-magenta)' : 'var(--fl-brand-cyan)'

  return (
    <div className="xp-final-preview-wrap" dir={direction} lang={locale}>
      <div className="xp-final-preview-glow" aria-hidden="true" />
      <div className="xp-final-type-demo">
        <header className="xp-final-type-head">
          <span className="xp-final-type-label">{copy.demoLabels[stepIdx] ?? copy.demoLabels[0]}</span>
          <FidelityBadge mode="simulated" />
        </header>
        <div
          className="xp-final-type-field"
          dir={stepIdx === 1 ? 'rtl' : 'ltr'}
          style={{
            color: accentColor,
            fontFamily: stepIdx === 1 ? 'var(--fl-font-arabic)' : undefined,
          }}
        >
          {displayText}
          {cursor ? <span className="xp-cursor" aria-hidden="true" /> : null}
        </div>
      </div>
    </div>
  )
}
