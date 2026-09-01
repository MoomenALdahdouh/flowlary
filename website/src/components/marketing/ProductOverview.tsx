import { Reveal } from '../Reveal.tsx'
import { SectionLabel } from './SectionLabel.tsx'
import { BrowserStage } from '../product/BrowserStage.tsx'
import { CorrectionDemo } from '../demos/CorrectionDemo.tsx'
import { useMessages, useI18n } from '../../i18n/index.tsx'

export function ProductOverview() {
  const t = useMessages()
  const { direction, locale } = useI18n()
  return (
    <section className="hp-concept" id="how" aria-labelledby="hp-concept-title">
      <div className="container hp-concept-grid">
        <Reveal>
          <SectionLabel>{t.home.conceptKicker}</SectionLabel>
          <h2 id="hp-concept-title" className="hp-title">
            {t.home.conceptTitle}
          </h2>
          <p className="hp-lead">{t.home.conceptLead}</p>
          <p id="hp-workflow-label" className="hp-workflow-title">
            {t.home.howTitle}
          </p>
          <ol className="hp-workflow" aria-labelledby="hp-workflow-label">
            {t.home.howSteps.map((step, index) => (
              <li key={step.title}>
                <span className="hp-workflow-num">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>
        <Reveal className="reveal-d2">
          <BrowserStage url={t.demos.browser.pageUrl} className="hp-concept-browser">
            <div className="hp-concept-overlay" dir={direction} lang={locale}>
              <span className="hp-concept-badge">{t.demos.shared.activeField}</span>
              <span className="hp-concept-badge tone-accent">{t.brand.name}</span>
            </div>
            <CorrectionDemo compact loop />
          </BrowserStage>
        </Reveal>
      </div>
    </section>
  )
}
