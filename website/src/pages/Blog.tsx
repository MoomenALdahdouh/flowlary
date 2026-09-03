import { useMessages } from '../i18n/index.tsx'
import { Reveal } from '../components/Reveal.tsx'

export function BlogPage() {
  const t = useMessages()
  const titleParts = t.blog.title.split('Flowlary')
  return (
    <div className="xp-blog">
      <header className="xp-hero" aria-labelledby="blog-hero-title">
        <div className="container">
          <Reveal>
            <p className="xp-hero-badge">
              <span className="xp-hero-badge-dot" aria-hidden="true" />
              {t.blog.kicker}
            </p>
            <h1 id="blog-hero-title" className="mh-display xp-hero-title">
              {titleParts[0]}
              {titleParts.length > 1 ? <span className="xp-gradient-text">Flowlary</span> : null}
              {titleParts[1] ?? ''}
            </h1>
            <p className="lead mh-hero-lead">{t.blog.lead}</p>
          </Reveal>
        </div>
      </header>
      <section className="xp-page-section">
        <div className="container xp-page-shell is-narrow">
          <Reveal>
            <div className="empty-state">
              <p>{t.blog.empty}</p>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  )
}
