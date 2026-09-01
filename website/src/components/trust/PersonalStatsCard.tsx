import { useEffect, useState } from 'react'
import type { AccountPersonalStatsView } from '@flowlary/shared'
import { fetchAccountStatistics } from '../../trust/client.ts'
import { useMessages } from '../../i18n/index.tsx'

export function PersonalStatsCard() {
  const t = useMessages()
  const copy = t.trust.personal
  const [stats, setStats] = useState<AccountPersonalStatsView | null>(null)

  useEffect(() => {
    void fetchAccountStatistics().then(setStats)
  }, [])

  if (!stats) return null

  const items = [
    [copy.writingChecks, stats.writingChecksUsed],
    [copy.corrections, stats.corrections],
    [copy.translations, stats.translations],
    [copy.layoutChecks, stats.layoutChecks],
    [copy.learningEvents, stats.learningEvents],
    [copy.practiceSessions, stats.practiceSessions],
    [copy.activeDays, stats.activeDays],
    [copy.meaningfulUse, stats.meaningfulUseCount],
    [copy.firstWin, stats.firstWinCompleted ? 'Yes' : 'No'],
    [copy.creditsToday, stats.creditsUsedToday],
  ] as const

  return (
    <article className="wd-card" aria-labelledby="wd-personal-stats-title">
      <h3 id="wd-personal-stats-title">{copy.title}</h3>
      <dl className="wd-stats-grid">
        {items.map(([label, value]) => (
          <div key={label} className="wd-stat-card fl-surface-1">
            <dt>{label}</dt>
            <dd>
              <strong>{String(value)}</strong>
            </dd>
          </div>
        ))}
      </dl>
    </article>
  )
}
