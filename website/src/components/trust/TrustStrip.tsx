import type { PublicProductStatsView } from '@flowlary/shared'
import { useI18n, useMessages } from '../../i18n/index.tsx'

type TrustStripProps = {
  stats: PublicProductStatsView
}

function formatCount(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value)
}

export function TrustStrip({ stats }: TrustStripProps) {
  const t = useMessages()
  const { locale } = useI18n()
  const copy = t.trust

  const items: { label: string; value: string; source?: string }[] = []

  if (stats.metricStates.registeredUsers === 'AVAILABLE' && stats.metrics.registeredUsers != null) {
    items.push({
      label: copy.registeredUsers,
      value: formatCount(stats.metrics.registeredUsers, locale),
    })
  }
  if (stats.metricStates.writingChecks === 'AVAILABLE' && stats.metrics.writingChecks != null) {
    items.push({
      label: copy.writingChecks,
      value: formatCount(stats.metrics.writingChecks, locale),
    })
  }
  if (stats.internalRating) {
    items.push({
      label: copy.internalRating,
      value: `${stats.internalRating.average}/5`,
      source: copy.internalRatingSource,
    })
  }
  if (stats.storeRatings?.chrome) {
    items.push({
      label: copy.chromeRating,
      value: `${stats.storeRatings.chrome.rating}/5`,
      source: copy.chromeRatingSource,
    })
  }

  if (items.length === 0) return null

  return (
    <section className="trust-strip" aria-labelledby="trust-strip-title">
      <div className="container">
        <h2 id="trust-strip-title" className="visually-hidden">
          {copy.title}
        </h2>
        <p className="trust-strip-lead">{copy.lead}</p>
        <dl className="trust-strip-grid">
          {items.map((item) => (
            <div key={item.label} className="trust-strip-item fl-surface-1">
              <dt>{item.label}</dt>
              <dd>
                <strong>{item.value}</strong>
                {item.source ? <span className="trust-source">{item.source}</span> : null}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
