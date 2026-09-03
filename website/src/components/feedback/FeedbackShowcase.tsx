import { Link } from 'react-router-dom'
import { FeedbackHub } from './FeedbackHub.tsx'
import { Button, ConversionPanel, SectionHeading } from '../Ui.tsx'
import { Reveal } from '../Reveal.tsx'
import { useMessages } from '../../i18n/index.tsx'

function splitTitle(title: string, highlight?: string) {
  if (!highlight) return { before: title, highlight: '', after: '' }
  const parts = title.split(highlight)
  if (parts.length === 1) return { before: title, highlight: '', after: '' }
  return { before: parts[0], highlight, after: parts.slice(1).join(highlight) }
}

type FeedbackShowcaseProps = {
  initialTab?: 'feedback' | 'features' | 'support'
}

export function FeedbackShowcase({ initialTab = 'feedback' }: FeedbackShowcaseProps) {
  const t = useMessages()
  const f = t.feedback
  const titleParts = splitTitle(f.title, f.titleHighlight)
  const activePath = initialTab === 'features' ? 'features' : 'feedback'

  return (
    <div className="fb-page xp-feedback">
      <header className="fb-hero xp-hero" aria-labelledby="feedback-hero-title">
        <div className="container fb-hero-inner">
          <Reveal>
            <p className="xp-hero-badge">
              <span className="xp-hero-badge-dot" aria-hidden="true" />
              {f.kicker}
            </p>
            <h1 id="feedback-hero-title" className="fb-hero-title mh-display xp-hero-title">
              {titleParts.before}
              {titleParts.highlight ? (
                <span className="xp-gradient-text">{titleParts.highlight}</span>
              ) : null}
              {titleParts.after}
            </h1>
            <p className="fb-hero-lead mh-hero-lead">{f.lead}</p>
            <ul className="fb-trust-row" aria-label={f.pathsKicker}>
              {f.heroTrust.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Reveal>
        </div>
      </header>

      <section className="fb-path-band" aria-labelledby="feedback-paths-title">
        <div className="container">
          <Reveal>
            <SectionHeading
              kicker={f.pathsKicker}
              title={f.pathsTitle}
              titleId="feedback-paths-title"
            />
            <div className="fb-path-grid">
              <Link
                to="/feedback"
                className={`fb-path-card fb-path-accent-cyan${activePath === 'feedback' ? ' is-active' : ''}`}
              >
                <span className="fb-path-icon" aria-hidden="true">
                  <svg viewBox="0 0 20 20" fill="none">
                    <path d="M4 6.5h12M4 10h8M4 13.5h10" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
                  </svg>
                </span>
                <h2>{f.tabs.feedback}</h2>
                <p>{f.ratingLead}</p>
              </Link>
              <Link
                to="/feedback?tab=features"
                className={`fb-path-card fb-path-accent-purple${activePath === 'features' ? ' is-active' : ''}`}
              >
                <span className="fb-path-icon" aria-hidden="true">
                  <svg viewBox="0 0 20 20" fill="none">
                    <path
                      d="M10 3.5 12.5 8l4.5.65-3.25 3.2.75 4.4L10 14.3 5.5 16.25l.75-4.4L3 8.65 7.5 8 10 3.5Z"
                      stroke="currentColor"
                      strokeWidth="1.25"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <h2>{f.tabs.features}</h2>
                <p>{f.featuresLead}</p>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="fb-workspace">
        <div className="container fb-workspace-inner">
          <Reveal>
            <div className="fb-workspace-shell">
              <FeedbackHub initialTab={initialTab} />
            </div>
          </Reveal>
        </div>
      </section>

      <ConversionPanel
        titleId="feedback-final-cta"
        title={f.finalTitle}
        lead={f.finalLead}
        highlight={f.finalHighlight}
        primary={<Button to="/support">{f.supportAction}</Button>}
        secondary={<Button to="/contact" variant="secondary">{f.contactAction}</Button>}
      />
    </div>
  )
}
