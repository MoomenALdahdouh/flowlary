import { Link } from 'react-router-dom'
import type { PublicFeatureRequestStat } from '@flowlary/shared'
import { Button } from '../Ui.tsx'
import { Reveal } from '../Reveal.tsx'
import { useMessages } from '../../i18n/index.tsx'

type FeatureRequestsProofProps = {
  items: PublicFeatureRequestStat[]
}

export function FeatureRequestsProof({ items }: FeatureRequestsProofProps) {
  const t = useMessages()
  const copy = t.trust.featureRequests
  if (items.length === 0) return null

  return (
    <section className="trust-features" aria-labelledby="trust-features-title">
      <div className="container">
        <Reveal>
          <h2 id="trust-features-title">{copy.title}</h2>
          <p className="hp-lead">{copy.lead}</p>
          <ul className="trust-feature-list">
            {items.slice(0, 5).map((item) => (
              <li key={item.id} className="trust-feature-item fl-surface-1">
                <div>
                  <strong>{item.title}</strong>
                  <span className="fb-badge">{copy.votes.replace('{count}', String(item.voteCount))}</span>
                </div>
              </li>
            ))}
          </ul>
          <div className="btn-row">
            <Button to="/feedback?tab=features">{copy.cta}</Button>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

export function BuiltWithUsersSection() {
  const t = useMessages()
  const copy = t.trust.builtWithUsers
  return (
    <section className="trust-built" aria-labelledby="trust-built-title">
      <div className="container">
        <Reveal>
          <article className="fl-surface-1 trust-built-card">
            <h2 id="trust-built-title">{copy.title}</h2>
            <p>{copy.lead}</p>
            <div className="btn-row">
              <Link className="btn btn-primary" to="/feedback">
                {copy.feedbackCta}
              </Link>
              <Link className="btn btn-secondary" to="/feedback?tab=features">
                {copy.featureCta}
              </Link>
            </div>
          </article>
        </Reveal>
      </div>
    </section>
  )
}
