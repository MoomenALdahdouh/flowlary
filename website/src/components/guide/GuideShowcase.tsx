import { Link } from 'react-router-dom'
import { SHORTCUTS } from '../../config.ts'
import { Button, GetFlowlaryButton } from '../Ui.tsx'
import { Reveal } from '../Reveal.tsx'
import { useMessages } from '../../i18n/index.tsx'

function splitKeys(combo: string): string[] {
  return combo.split(/(?=[⌘⇧⌥⌃])|\+/).filter(Boolean)
}

function KeyCombo({ mac, other }: { mac: string; other: string }) {
  return (
    <span className="sp-keys" aria-label={`${other} / ${mac}`}>
      {splitKeys(other).map((key) => (
        <kbd key={`o-${key}`}>{key}</kbd>
      ))}
      <span className="visually-hidden"> or </span>
      {splitKeys(mac).map((key) => (
        <kbd key={`m-${key}`}>{key}</kbd>
      ))}
    </span>
  )
}

export function GuideShowcase() {
  const t = useMessages()
  const g = t.guide

  return (
    <div className="pp-page sp-page gd-page">
      <header className="pp-hero">
        <div className="container pp-hero-inner">
          <Reveal>
            <p className="kicker">{g.kicker}</p>
            <h1>{g.title}</h1>
            <p className="lead">{g.lead}</p>
            <div className="btn-row" style={{ marginTop: '1.25rem' }}>
              <GetFlowlaryButton />
              <Button variant="secondary" to="/support">
                {g.supportBannerAction}
              </Button>
            </div>
          </Reveal>
        </div>
      </header>

      <section className="sp-section" aria-labelledby="guide-steps-title">
        <div className="container">
          <Reveal>
            <div className="sp-section-head">
              <h2 id="guide-steps-title">{g.stepsTitle}</h2>
              <p>{g.stepsLead}</p>
            </div>
            <ol className="gd-steps">
              {g.steps.map((step, index) => (
                <li key={step.id} className="gd-step pp-glass">
                  <div className="gd-step-head">
                    <span className="gd-step-num" aria-hidden>
                      {index + 1}
                    </span>
                    <h3 id={`guide-step-${step.id}`}>{step.title}</h3>
                  </div>
                  <p>{step.body}</p>
                  {step.tip ? <p className="gd-tip">{step.tip}</p> : null}
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </section>

      <section className="sp-section" aria-labelledby="guide-shortcuts-title">
        <div className="container">
          <Reveal>
            <article className="pp-glass sp-card">
              <h2 id="guide-shortcuts-title">{g.shortcutsTitle}</h2>
              <p className="muted" style={{ marginTop: '0.5rem' }}>
                {g.shortcutsNote}
              </p>
              <div className="sp-shortcuts" style={{ marginTop: '1rem' }}>
                <div className="sp-shortcut">
                  <span>{t.support.shortcutTranslate}</span>
                  <KeyCombo {...SHORTCUTS.translate} />
                </div>
                <div className="sp-shortcut">
                  <span>{t.support.shortcutLayout}</span>
                  <KeyCombo {...SHORTCUTS.fixLayout} />
                </div>
                <div className="sp-shortcut">
                  <span>{t.support.shortcutSpeed}</span>
                  <KeyCombo {...SHORTCUTS.speedBox} />
                </div>
              </div>
            </article>
          </Reveal>
        </div>
      </section>

      <section className="sp-section" aria-labelledby="guide-next-title">
        <div className="container">
          <Reveal>
            <div className="sp-section-head">
              <h2 id="guide-next-title">{g.dashboardTitle}</h2>
            </div>
            <div className="gd-cards">
              {g.dashboardCards.map((card) => (
                <article key={card.href} className="pp-glass gd-card">
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                  <Link className="text-link" to={card.href}>
                    {card.label}
                  </Link>
                </article>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="gd-final container">
        <Reveal>
          <div className="pp-glass sp-contact">
            <h2>{g.finalTitle}</h2>
            <p>{g.finalLead}</p>
            <div className="btn-row">
              <GetFlowlaryButton />
              <Button variant="secondary" to="/support">
                {g.supportBanner}: {g.supportBannerAction}
              </Button>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  )
}
