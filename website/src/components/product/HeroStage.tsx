import { useMessages, useI18n } from '../../i18n/index.tsx'
import { CorrectionDemo } from '../demos/CorrectionDemo.tsx'
import { BrowserStage } from './BrowserStage.tsx'

export function HeroStage() {
  const t = useMessages()
  const { direction, locale } = useI18n()

  return (
    <div className="hero-stage">
      <div className="hero-stage-glow" aria-hidden="true" />
      <div className="hero-stage-main">
        <BrowserStage url={t.demos.browser.pageUrl}>
          <div className="page-field-meta" aria-hidden="true" dir={direction} lang={locale}>
            <span>{t.demos.shared.activeField}</span>
            <span>{t.demos.shared.languageEnglish}</span>
          </div>
          <CorrectionDemo compact loop />
        </BrowserStage>
        <div className="hero-stage-float" aria-hidden="true">
          <span className="hero-stage-float-icon">
            <svg viewBox="0 0 16 16" fill="none">
              <path
                d="M3.5 8.2 6.4 11l6.1-6.2"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="hero-stage-float-copy">
            <strong>{t.demos.correction.status.done}</strong>
            <span>{t.home.heroNote}</span>
          </span>
        </div>
      </div>
    </div>
  )
}
