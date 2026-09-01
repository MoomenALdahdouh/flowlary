import { Button, GetFlowlaryButton } from '../Ui.tsx'
import { Reveal } from '../Reveal.tsx'
import { BrowserStage } from '../product/BrowserStage.tsx'
import {
  CorrectionDemo,
  LayoutCorrectionDemo,
  TranslationDemo,
} from '../demos/ProductDemos.tsx'
import { PopupPreview } from '../demos/PopupPreview.tsx'
import { FeatureIcon } from './FeatureInteractive.tsx'
import { useMessages } from '../../i18n/index.tsx'

export function FeaturesShowcase() {
  const t = useMessages()
  const fp = t.featuresPage
  const journey = fp.journey
  const correction = fp.sections[0]
  const translation = fp.sections[1]
  const live = fp.sections[2]
  const layout = fp.sections[3]
  const speedBox = fp.sections[4]

  return (
    <div className="feat-page">
      <header className="feat-hero">
        <div className="container feat-hero-grid">
          <Reveal className="feat-hero-copy">
            <p className="kicker">{fp.kicker}</p>
            <h1>{fp.title}</h1>
            <p className="lead">{fp.lead}</p>
            <div className="btn-row feat-hero-actions">
              <GetFlowlaryButton />
              <Button variant="secondary" to="#feat-connected">
                {t.cta.secondary}
              </Button>
            </div>
          </Reveal>
          <Reveal className="feat-hero-proof reveal-d2">
            <PopupPreview compact />
          </Reveal>
        </div>
      </header>

      <nav className="feat-journey-nav" aria-label={fp.navAria}>
        <div className="container">
          <a href="#feat-write">{journey.write.label}</a>
          <a href="#feat-communicate">{journey.communicate.label}</a>
          <a href="#feat-learn">{journey.learn.label}</a>
        </div>
      </nav>

      <section id="feat-write" className="feat-section" aria-labelledby="feat-write-title">
        <div className="container feat-showcase">
          <Reveal className="feat-copy">
            <p className="kicker">{journey.write.label}</p>
            <h2 id="feat-write-title">{journey.write.title}</h2>
            <p className="feat-value">{journey.write.lead}</p>
            <ul className="feat-bullets">
              {correction.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
            </ul>
            <p className="feat-meta">{correction.meta}</p>
            <Button variant="link" to={correction.detailPath}>{correction.detailLabel}</Button>
          </Reveal>
          <Reveal className="feat-demo reveal-d2">
            <div className="feat-demo-surface">
              <BrowserStage url={t.demos.browser.activeCorrection}>
                <CorrectionDemo compact />
              </BrowserStage>
            </div>
          </Reveal>
        </div>
      </section>

      <section id="feat-communicate" className="feat-section feat-section-soft" aria-labelledby="feat-communicate-title">
        <div className="container">
          <Reveal className="feat-section-head">
            <p className="kicker">{journey.communicate.label}</p>
            <h2 id="feat-communicate-title">{journey.communicate.title}</h2>
            <p className="lead">{journey.communicate.lead}</p>
          </Reveal>
          <div className="feat-communication-grid">
            <Reveal className="feat-demo-surface">
              <BrowserStage url={t.demos.browser.activeTranslate}>
                <TranslationDemo compact />
              </BrowserStage>
              <FeatureLink copy={translation} />
            </Reveal>
            <Reveal className="feat-demo-surface reveal-d2">
              <LayoutCorrectionDemo compact />
              <FeatureLink copy={layout} />
            </Reveal>
          </div>
          <div className="feat-utility-list">
            <FeatureLink copy={live} />
            <FeatureLink copy={speedBox} />
          </div>
        </div>
      </section>

      <section id="feat-learn" className="feat-section" aria-labelledby="feat-learn-title">
        <div className="container feat-showcase is-flip">
          <Reveal className="feat-copy">
            <p className="kicker">{journey.learn.label}</p>
            <h2 id="feat-learn-title">{journey.learn.title}</h2>
            <p className="feat-value">{journey.learn.lead}</p>
            <ul className="feat-bullets">
              {journey.learn.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
            <p className="feat-meta">{journey.learn.note}</p>
            <Button variant="link" to="/pricing">{journey.learn.cta}</Button>
          </Reveal>
          <Reveal className="feat-learning-proof">
            <p>{journey.learn.previewLabel}</p>
            <ol>
              {journey.learn.steps.map((step, index) => (
                <li key={step}>
                  <span>{index + 1}</span>
                  <strong>{step}</strong>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </section>

      <section className="feat-built" aria-labelledby="feat-built-title">
        <div className="container">
          <Reveal className="feat-built-head">
            <p className="kicker">{fp.built.kicker}</p>
            <h2 id="feat-built-title">{fp.built.title}</h2>
            <p className="lead">{fp.built.lead}</p>
          </Reveal>
          <div className="feat-built-grid">
            {fp.built.items.map((item) => (
              <Reveal key={item.title}>
                <article className="feat-built-card">
                  <span className="feat-built-icon">
                    <FeatureIcon name={item.icon as 'history' | 'safety' | 'pause'} />
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="feat-connected" className="feat-flow" aria-labelledby="feat-flow-title">
        <div className="container">
          <Reveal>
            <p className="kicker">{fp.flow.kicker}</p>
            <h2 id="feat-flow-title">{fp.flow.title}</h2>
            <p className="lead">{fp.flow.lead}</p>
          </Reveal>
          <ol className="feat-flow-steps">
            {fp.flow.steps.map((step, index) => (
              <li key={step.title} className="feat-flow-step">
                <span className="feat-flow-num">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <strong>{step.title}</strong>
                  <span>{step.body}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="feat-final" aria-labelledby="feat-final-title">
        <div className="container">
          <Reveal>
            <div className="feat-final-panel">
              <h2 id="feat-final-title">{fp.final.title}</h2>
              <p className="lead">{fp.final.lead}</p>
              <div className="btn-row">
                <GetFlowlaryButton />
                <Button variant="secondary" to="/#try-flowlary">
                  {fp.final.secondary}
                </Button>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  )
}

function FeatureLink({
  copy,
}: {
  copy: {
    kicker: string
    title: string
    value: string
    detailPath: string
    detailLabel: string
  }
}) {
  return (
    <article className="feat-feature-link">
      <div>
        <p className="kicker">{copy.kicker}</p>
        <h3>{copy.title}</h3>
        <p>{copy.value}</p>
      </div>
      <Button variant="link" to={copy.detailPath}>{copy.detailLabel}</Button>
    </article>
  )
}
