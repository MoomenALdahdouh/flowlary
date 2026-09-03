import { Button, ConversionPanel, InstallFlowlaryButton, SectionHeading } from '../Ui.tsx'
import { Reveal } from '../Reveal.tsx'
import { PopupPreview } from '../demos/PopupPreview.tsx'
import { useMessages } from '../../i18n/index.tsx'

function splitTitle(title: string, highlight?: string) {
  if (!highlight) return { before: title, highlight: '', after: '' }
  const parts = title.split(highlight)
  if (parts.length === 1) return { before: title, highlight: '', after: '' }
  return { before: parts[0], highlight, after: parts.slice(1).join(highlight) }
}

export function AboutShowcase() {
  const t = useMessages()
  const a = t.about
  const titleParts = splitTitle(a.title, a.titleHighlight)

  return (
    <div className="xp-about ab-page">
      <header className="xp-hero ab-hero" aria-labelledby="ab-hero-title">
        <div className="container ab-hero-inner">
          <Reveal>
            <p className="xp-hero-badge">
              <span className="xp-hero-badge-dot" aria-hidden="true" />
              {a.kicker}
            </p>
            <h1 id="ab-hero-title" className="mh-display xp-hero-title">
              {titleParts.before}
              {titleParts.highlight ? (
                <span className="xp-gradient-text">{titleParts.highlight}</span>
              ) : null}
              {titleParts.after}
            </h1>
            <p className="lead mh-hero-lead">{a.lead}</p>
          </Reveal>
        </div>
      </header>

      <section className="xp-page-section">
        <div className="container xp-page-shell">
          <Reveal>
            <SectionHeading
              kicker={a.story.kicker}
              title={a.story.title}
              lead={a.story.lead}
              titleId="ab-story-title"
            />
            <div className="ab-story-grid">
              <ul className="ab-problems">
                {a.story.problems.map((item) => (
                  <li key={item.title}>
                    <strong>{item.title}</strong>
                    {item.body}
                  </li>
                ))}
              </ul>
              <article className="ab-philosophy-card">
                <p className="kicker">{a.story.philosophyKicker}</p>
                <h3>{a.story.philosophyTitle}</h3>
                <p>{a.story.philosophyBody}</p>
              </article>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="xp-page-section">
        <div className="container xp-page-shell">
          <Reveal>
            <div className="xp-split-section">
              <div className="xp-split-copy">
                <SectionHeading
                  kicker={a.preview.kicker}
                  title={a.preview.title}
                  lead={a.preview.body}
                  titleId="ab-preview-title"
                />
                <div className="btn-row">
                  <Button to="/features">{t.cta.exploreFeatures}</Button>
                </div>
              </div>
              <div className="xp-split-visual ab-preview-wrap">
                <PopupPreview />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="xp-page-section is-soft">
        <div className="container xp-page-shell">
          <Reveal>
            <SectionHeading
              kicker={a.principles.kicker}
              title={a.principles.title}
              lead={a.principles.lead}
              titleId="ab-principles-title"
            />
            <div className="ab-principles">
              {a.principles.items.map((item) => (
                <article key={item.title} className="ab-principle">
                  <strong>{item.title}</strong>
                  <span>{item.body}</span>
                </article>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="xp-page-section">
        <div className="container xp-page-shell is-narrow">
          <Reveal>
            <article className="ab-trust-card">
              <h2>{a.trust.title}</h2>
              <p>{a.trust.body}</p>
              <p className="ab-trust-site">
                {a.trust.siteLabel}{' '}
                <a href={`https://${a.trust.siteValue}`}>{a.trust.siteValue}</a>
              </p>
            </article>
          </Reveal>
        </div>
      </section>

      <ConversionPanel
        titleId="ab-final-title"
        title={a.final.title}
        lead={a.final.lead}
        primary={<InstallFlowlaryButton />}
        secondary={
          <Button variant="secondary" to="/features">
            {a.final.secondary}
          </Button>
        }
      />
    </div>
  )
}
