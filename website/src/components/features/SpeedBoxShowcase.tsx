import type { ReactNode } from 'react'
import { KEYBOARD_LAYOUTS, SHORTCUTS } from '../../config.ts'
import { SpeedBoxDemo } from '../demos/ProductDemos.tsx'
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
    <span className="fd-speedbox-keys" aria-label={`${other} / ${mac}`}>
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

export function SpeedBoxShowcase() {
  const t = useMessages()
  const c = t.speedBox
  const final = t.featuresPage.final
  const titleParts = splitTitle(c.title, c.titleHighlight)

  const primaryFacts = [
    { title: t.features.what, body: c.what },
    { title: t.features.why, body: c.why },
    { title: t.features.how, body: c.how },
    {
      title: t.features.mode,
      body: (
        <>
          {c.mode}{' '}
          <KeyCombo {...SHORTCUTS.speedBox} />
        </>
      ),
    },
  ]

  return (
    <div className="xp-feature-detail fd-page fd-speedbox">
      <header className="xp-hero fd-hero" aria-labelledby="fd-speedbox-title">
        <div className="container fd-hero-inner fd-speedbox-hero-inner">
          <Reveal>
            <p className="xp-hero-badge fd-speedbox-badge">
              <span className="xp-hero-badge-dot" aria-hidden="true" />
              {c.kicker}
            </p>
            <h1 id="fd-speedbox-title" className="mh-display xp-hero-title">
              {titleParts.before}
              {titleParts.highlight ? (
                <span className="fd-speedbox-title-accent">{titleParts.highlight}</span>
              ) : null}
              {titleParts.after}
            </h1>
            <p className="lead mh-hero-lead">{c.lead}</p>
            <div className="fd-speedbox-hero-meta">
              <p className="fd-meta">{c.metaLine}</p>
              <div className="fd-speedbox-shortcut-card">
                <span className="fd-speedbox-shortcut-label">{c.shortcutLabel}</span>
                <KeyCombo {...SHORTCUTS.speedBox} />
              </div>
            </div>
            <ul className="fd-speedbox-trust" aria-label={c.trustAria}>
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
                <div className="fd-speedbox-stage" aria-hidden="true">
                  <div className="fd-speedbox-stage-backdrop">
                    <div className="fd-speedbox-stage-page">
                      <span className="fd-speedbox-stage-bar" />
                      <span className="fd-speedbox-stage-line" />
                      <span className="fd-speedbox-stage-line is-short" />
                    </div>
                  </div>
                  <div className="fd-speedbox-stage-panel">
                    <SpeedBoxDemo />
                  </div>
                </div>
              </div>
              <div className="xp-split-copy fd-copy">
                <FactList items={primaryFacts} />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="xp-page-section is-soft fd-speedbox-steps-band" aria-labelledby="fd-speedbox-steps-title">
        <div className="container xp-page-shell">
          <Reveal>
            <SectionHeading
              kicker={c.stepsKicker}
              title={c.stepsTitle}
              lead={c.stepsLead}
              titleId="fd-speedbox-steps-title"
            />
            <ol className="fd-speedbox-steps">
              {c.steps.map((step, index) => (
                <li key={step.title} className="fd-speedbox-step">
                  <span className="fd-speedbox-step-num" aria-hidden="true">
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

      <section className="xp-page-section" aria-labelledby="fd-speedbox-compare-title">
        <div className="container xp-page-shell">
          <Reveal>
            <SectionHeading
              title={c.compareTitle}
              lead={c.compareLead}
              titleId="fd-speedbox-compare-title"
            />
            <div className="fd-speedbox-compare-grid">
              {c.compare.map((item) => (
                <article
                  key={item.title}
                  className={`fd-speedbox-compare-card${'featured' in item && item.featured ? ' is-featured' : ''}`}
                >
                  <p className="fd-speedbox-compare-kicker">{item.kicker}</p>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
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

      <section className="xp-page-section is-soft" aria-labelledby="fd-speedbox-use-title">
        <div className="container xp-page-shell">
          <Reveal>
            <SectionHeading title={c.useCasesTitle} lead={c.useCasesLead} titleId="fd-speedbox-use-title" />
            <FactGrid items={c.useCases.map((item) => ({ title: item.title, body: item.body }))} />
          </Reveal>
        </div>
      </section>

      <section className="xp-page-section" aria-labelledby="fd-speedbox-layouts-title">
        <div className="container xp-page-shell">
          <Reveal>
            <SectionHeading
              title={c.layoutsTitle}
              lead={c.layoutsLead}
              titleId="fd-speedbox-layouts-title"
            />
            <div className="chip-list fd-speedbox-layouts">
              {KEYBOARD_LAYOUTS.map((layout) => (
                <span key={layout.id} className="chip">
                  {t.layoutNames[layout.id]}
                </span>
              ))}
            </div>
            <p className="muted fd-speedbox-layouts-note">{c.layoutsNote}</p>
          </Reveal>
        </div>
      </section>

      <section className="xp-page-section is-soft">
        <div className="container xp-page-shell">
          <Reveal>
            <div className="fd-secondary">
              <article className="fd-caution">
                <h2>{c.notTitle}</h2>
                <p>{c.notBody}</p>
              </article>
              <div className="fd-speedbox-related">
                <h2 id="fd-speedbox-related-title">{c.relatedTitle}</h2>
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
        titleId="fd-speedbox-final-title"
        title={final.title}
        lead={final.lead}
        primary={<InstallFlowlaryButton />}
        secondary={<Button variant="secondary" to="/try">{final.secondary}</Button>}
      />
    </div>
  )
}
