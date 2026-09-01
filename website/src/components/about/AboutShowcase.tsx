import { Link } from 'react-router-dom'
import { Button, GetFlowlaryButton } from '../Ui.tsx'
import { Reveal } from '../Reveal.tsx'
import { PopupPreview } from '../demos/PopupPreview.tsx'
import { useMessages } from '../../i18n/index.tsx'
import { ProductProofSections } from '../trust/ProductProofSections.tsx'

export function AboutShowcase() {
  const t = useMessages()
  const a = t.about

  return (
    <div className="pp-page ab-page">
      <header className="pp-hero">
        <div className="container pp-hero-inner">
          <Reveal>
            <p className="kicker">{a.kicker}</p>
            <h1>{a.title}</h1>
            <p className="lead">{a.lead}</p>
          </Reveal>
        </div>
      </header>

      <section className="section">
        <div className="container">
          <Reveal>
            <div className="sp-section-head">
              <p className="kicker">{a.story.kicker}</p>
              <h2>{a.story.title}</h2>
              <p>{a.story.lead}</p>
            </div>
            <div className="ab-story-grid">
              <div>
                <ul className="ab-problems">
                  {a.story.problems.map((item) => (
                    <li key={item.title}>
                      <strong>{item.title}</strong>
                      {item.body}
                    </li>
                  ))}
                </ul>
              </div>
              <article className="pp-glass sp-card">
                <p className="kicker">{a.story.philosophyKicker}</p>
                <h3>{a.story.philosophyTitle}</h3>
                <p>{a.story.philosophyBody}</p>
              </article>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Reveal>
            <div className="sp-section-head">
              <p className="kicker">{a.capabilities.kicker}</p>
              <h2>{a.capabilities.title}</h2>
              <p>{a.capabilities.lead}</p>
            </div>
            <div className="ab-caps">
              {a.capabilities.items.map((item, index) => (
                <article
                  key={item.title}
                  className={`pp-glass ab-cap${index === 0 ? ' ab-cap-wide' : ''}`}
                >
                  <span className="ab-cap-num">{item.number}</span>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section">
        <div className="container split">
          <Reveal className="split-copy">
            <p className="kicker">{a.preview.kicker}</p>
            <h2>{a.preview.title}</h2>
            <p className="lead">{a.preview.body}</p>
            <div className="btn-row" style={{ marginTop: '1rem' }}>
              <Button to="/features">{t.cta.exploreFeatures}</Button>
            </div>
          </Reveal>
          <Reveal>
            <div className="ab-preview-wrap">
              <PopupPreview />
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Reveal>
            <div className="sp-section-head">
              <p className="kicker">{a.principles.kicker}</p>
              <h2>{a.principles.title}</h2>
              <p>{a.principles.lead}</p>
            </div>
            <div className="ab-principles">
              {a.principles.items.map((item) => (
                <article key={item.title} className="pp-glass ab-principle">
                  <strong>{item.title}</strong>
                  <span>{item.body}</span>
                </article>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <ProductProofSections />

      <section className="section">
        <div className="container">
          <Reveal>
            <article className="pp-glass ab-trust">
              <h2>{a.trust.title}</h2>
              <p>{a.trust.body}</p>
              <p className="muted" style={{ marginTop: '0.85rem', fontSize: '0.88rem' }}>
                {a.trust.siteLabel}{' '}
                <Link to="/">{a.trust.siteValue}</Link>
              </p>
            </article>
          </Reveal>
        </div>
      </section>

      <section className="pr-final container">
        <Reveal>
          <div className="pp-glass sp-contact">
            <h2>{a.final.title}</h2>
            <p>{a.final.lead}</p>
            <div className="btn-row">
              <GetFlowlaryButton />
              <Button variant="secondary" to="/features">
                {a.final.secondary}
              </Button>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  )
}
