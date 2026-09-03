import type { ReactNode } from 'react'
import { SHORTCUTS, TRANSLATION_LANGUAGES } from '../../config.ts'
import { LiveTranslationDemo } from '../demos/ProductDemos.tsx'
import { BrowserStage } from '../product/BrowserStage.tsx'
import { Reveal } from '../Reveal.tsx'
import {
  Button,
  ConversionPanel,
  FactGrid,
  InstallFlowlaryButton,
  SectionHeading,
} from '../Ui.tsx'
import { useMessages } from '../../i18n/index.tsx'

function splitTitle(title: string, highlight?: string) {
  if (!highlight) return { before: title, highlight: '', after: '' }
  const parts = title.split(highlight)
  if (parts.length === 1) return { before: title, highlight: '', after: '' }
  return { before: parts[0], highlight, after: parts.slice(1).join(highlight) }
}

function splitKeys(combo: string): string[] {
  return combo.split(/(?=[⌘⇧⌥⌃])|\+/).filter(Boolean)
}

function KeyCombo({ mac, other }: { mac: string; other: string }) {
  return (
    <span className="fd-live-keys" aria-label={`${other} / ${mac}`}>
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

function FactList({ items }: { items: { title: string; body: ReactNode }[] }) {
  return (
    <dl className="fd-facts">
      {items.map((item) => (
        <div key={item.title} className="fd-fact">
          <dt>{item.title}</dt>
          <dd>{item.body}</dd>
        </div>
      ))}
    </dl>
  )
}

export function LiveTranslationShowcase() {
  const t = useMessages()
  const c = t.live
  const final = t.featuresPage.final
  const titleParts = splitTitle(c.title, c.titleHighlight)

  const primaryFacts = [
    { title: t.features.what, body: c.what },
    { title: t.features.why, body: c.why },
    { title: t.features.how, body: c.how },
    { title: t.features.mode, body: c.mode },
  ]

  return (
    <div className="xp-feature-detail fd-page fd-live">
      <header className="xp-hero fd-hero" aria-labelledby="fd-live-title">
        <div className="container fd-hero-inner fd-live-hero-inner">
          <Reveal>
            <p className="xp-hero-badge fd-live-badge">
              <span className="xp-hero-badge-dot" aria-hidden="true" />
              {c.kicker}
            </p>
            <h1 id="fd-live-title" className="mh-display xp-hero-title">
              {titleParts.before}
              {titleParts.highlight ? (
                <span className="fd-live-title-accent">{titleParts.highlight}</span>
              ) : null}
              {titleParts.after}
            </h1>
            <p className="lead mh-hero-lead">{c.lead}</p>
            <div className="fd-live-hero-meta">
              <p className="fd-meta">{c.optionalMeta}</p>
              <div className="fd-live-toggle-card">
                <div className="fd-live-toggle-copy">
                  <span className="fd-live-toggle-label">{c.toggleLabel}</span>
                  <span className="fd-live-toggle-note">{c.toggleNote}</span>
                </div>
                <div className="fd-live-toggle-ui" aria-hidden="true">
                  <span className="popup-toggle is-off" />
                  <span className="fd-live-toggle-state">{c.toggleOffLabel}</span>
                </div>
              </div>
            </div>
            <ul className="fd-live-trust" aria-label={c.trustAria}>
              {c.trust.map((item) => (
                <li key={item.label}>
                  <strong>{item.label}</strong>
                  <span>{item.detail}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </header>

      <section className="xp-page-section">
        <div className="container">
          <Reveal>
            <div className="xp-split-section is-reverse">
              <div className="xp-split-visual fd-visual">
                <BrowserStage url={t.demos.browser.activeTranslate}>
                  <LiveTranslationDemo />
                </BrowserStage>
              </div>
              <div className="xp-split-copy fd-copy">
                <FactList items={primaryFacts} />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="xp-page-section is-soft fd-live-steps-band" aria-labelledby="fd-live-steps-title">
        <div className="container xp-page-shell">
          <Reveal>
            <SectionHeading
              kicker={c.stepsKicker}
              title={c.stepsTitle}
              lead={c.stepsLead}
              titleId="fd-live-steps-title"
            />
            <ol className="fd-live-steps">
              {c.steps.map((step, index) => (
                <li key={step.title} className="fd-live-step">
                  <span className="fd-live-step-num" aria-hidden="true">
                    {index + 1}
                  </span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </section>

      <section className="xp-page-section" aria-labelledby="fd-live-compare-title">
        <div className="container xp-page-shell">
          <Reveal>
            <SectionHeading title={c.compareTitle} lead={c.compareLead} titleId="fd-live-compare-title" />
            <div className="fd-live-compare-grid">
              {c.compare.map((item) => (
                <article
                  key={item.title}
                  className={`fd-live-compare-card${'featured' in item && item.featured ? ' is-featured' : ''}`}
                >
                  <p className="fd-live-compare-kicker">{item.kicker}</p>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                  {'shortcut' in item && item.shortcut ? (
                    <p className="fd-live-compare-shortcut">
                      <KeyCombo {...SHORTCUTS.translate} />
                    </p>
                  ) : null}
                  <Button
                    variant={'featured' in item && item.featured ? 'primary' : 'secondary'}
                    to={item.href}
                    className="btn-sm"
                  >
                    {item.cta}
                  </Button>
                </article>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="xp-page-section is-soft" aria-labelledby="fd-live-use-title">
        <div className="container xp-page-shell">
          <Reveal>
            <SectionHeading title={c.useCasesTitle} lead={c.useCasesLead} titleId="fd-live-use-title" />
            <FactGrid items={c.useCases.map((item) => ({ title: item.title, body: item.body }))} />
          </Reveal>
        </div>
      </section>

      <section className="xp-page-section" aria-labelledby="fd-live-languages-title">
        <div className="container xp-page-shell">
          <Reveal>
            <SectionHeading
              title={c.languagesTitle}
              lead={c.languagesLead}
              titleId="fd-live-languages-title"
            />
            <div className="chip-list fd-live-languages">
              {TRANSLATION_LANGUAGES.map((lang) => (
                <span key={lang} className="chip">
                  {t.languages[lang]}
                </span>
              ))}
            </div>
            <p className="muted fd-live-languages-note">{c.languagesNote}</p>
          </Reveal>
        </div>
      </section>

      <section className="xp-page-section is-soft">
        <div className="container xp-page-shell">
          <Reveal>
            <div className="fd-secondary">
              <article className="fd-live-limits">
                <h2>{c.limitsTitle}</h2>
                <p>{c.limitsBody}</p>
              </article>
              <article className="fd-caution">
                <h2>{c.cautionTitle}</h2>
                <p>{c.cautionBody}</p>
              </article>
              <div className="fd-live-related">
                <h2 id="fd-live-related-title">{c.relatedTitle}</h2>
                <div className="btn-row">
                  {c.related.map((item) => (
                    <Button key={item.href} variant="secondary" to={item.href}>
                      {item.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <ConversionPanel
        titleId="fd-live-final-title"
        title={final.title}
        lead={final.lead}
        primary={<InstallFlowlaryButton />}
        secondary={<Button variant="secondary" to="/try">{final.secondary}</Button>}
      />
    </div>
  )
}
