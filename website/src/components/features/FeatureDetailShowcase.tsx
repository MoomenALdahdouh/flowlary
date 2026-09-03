import type { ReactNode } from 'react'
import { Button, ConversionPanel, InstallFlowlaryButton, SectionHeading } from '../Ui.tsx'
import { Reveal } from '../Reveal.tsx'
import { useMessages } from '../../i18n/index.tsx'

type Fact = { title: string; body: ReactNode }

type FeatureDetailShowcaseProps = {
  pageClass?: string
  kicker: string
  title: string
  titleHighlight?: string
  lead: string
  metaLine?: string
  primaryFacts: Fact[]
  demo?: ReactNode
  demoFirst?: boolean
  secondary?: ReactNode
  secondaryTitle?: string
  secondaryLead?: string
}

function splitTitle(title: string, highlight?: string) {
  if (!highlight) return { before: title, highlight: '', after: '' }
  const parts = title.split(highlight)
  if (parts.length === 1) return { before: title, highlight: '', after: '' }
  return { before: parts[0], highlight, after: parts.slice(1).join(highlight) }
}

function FactList({ items }: { items: Fact[] }) {
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

export function FeatureDetailShowcase({
  pageClass = '',
  kicker,
  title,
  titleHighlight,
  lead,
  metaLine,
  primaryFacts,
  demo,
  demoFirst = false,
  secondary,
  secondaryTitle,
  secondaryLead,
}: FeatureDetailShowcaseProps) {
  const t = useMessages()
  const final = t.featuresPage.final
  const titleParts = splitTitle(title, titleHighlight)

  const copyBlock = (
    <div className="xp-split-copy fd-copy">
      {metaLine ? <p className="fd-meta">{metaLine}</p> : null}
      <FactList items={primaryFacts} />
    </div>
  )

  const visualBlock = demo ? <div className="xp-split-visual fd-visual">{demo}</div> : null

  return (
    <div className={`xp-feature-detail fd-page ${pageClass}`.trim()}>
      <header className="xp-hero fd-hero" aria-labelledby="fd-hero-title">
        <div className="container fd-hero-inner">
          <Reveal>
            <p className="xp-hero-badge">
              <span className="xp-hero-badge-dot" aria-hidden="true" />
              {kicker}
            </p>
            <h1 id="fd-hero-title" className="mh-display xp-hero-title">
              {titleParts.before}
              {titleParts.highlight ? (
                <span className="xp-gradient-text">{titleParts.highlight}</span>
              ) : null}
              {titleParts.after}
            </h1>
            <p className="lead mh-hero-lead">{lead}</p>
          </Reveal>
        </div>
      </header>

      <section className="xp-page-section">
        <div className="container">
          <Reveal>
            <div className={`xp-split-section${demoFirst ? ' is-reverse' : ''}`}>
              {demoFirst ? (
                <>
                  {visualBlock}
                  {copyBlock}
                </>
              ) : (
                <>
                  {copyBlock}
                  {visualBlock}
                </>
              )}
            </div>
          </Reveal>
        </div>
      </section>

      {secondary ? (
        <section className="xp-page-section is-soft">
          <div className="container xp-page-shell">
            <Reveal>
              {secondaryTitle ? (
                <SectionHeading title={secondaryTitle} lead={secondaryLead} titleId="fd-secondary-title" />
              ) : null}
              <div className="fd-secondary">{secondary}</div>
            </Reveal>
          </div>
        </section>
      ) : null}

      <ConversionPanel
        titleId="fd-final-title"
        title={final.title}
        lead={final.lead}
        primary={<InstallFlowlaryButton />}
        secondary={<Button variant="secondary" to="/try">{final.secondary}</Button>}
      />
    </div>
  )
}
