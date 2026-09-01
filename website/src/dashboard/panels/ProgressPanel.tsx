import { useMemo, useState } from 'react'
import { Button } from '../../components/Ui.tsx'
import { clearRemoteLearningEvents } from '../../account/learningEventsClient.ts'
import type { DashboardCopy } from '../types.ts'
import { computeWebProgress } from '../services/learningData.ts'
import type { WebLearningBundle } from '../services/learningData.ts'
import { ProgressChartBlock } from '../components/ProgressCharts.tsx'

type ProgressPanelProps = {
  bundle: WebLearningBundle
  copy: DashboardCopy
  advanced: boolean
  onRefresh: () => void
  onOpenPractice: () => void
}

export function ProgressPanel({ bundle, copy, advanced, onRefresh, onOpenPractice }: ProgressPanelProps) {
  const [chartRange, setChartRange] = useState<'7d' | '30d'>('7d')
  const [clearing, setClearing] = useState(false)
  const metrics = useMemo(() => computeWebProgress(bundle), [bundle])

  async function onClearHistory() {
    if (!window.confirm(copy.progress.clearConfirm)) return
    setClearing(true)
    await clearRemoteLearningEvents()
    setClearing(false)
    onRefresh()
  }

  if (metrics.state === 'empty') {
    return (
      <div className="wd-panel-stack">
        <header className="wd-panel-head">
          <h2>{copy.progress.title}</h2>
          <p className="wd-lead">{copy.progress.lead}</p>
        </header>
        <article className="wd-card wd-empty">
          <h3>{copy.progress.buildingTitle}</h3>
          <p>{copy.progress.buildingBody}</p>
          <Button to="/#writing-lab">{copy.overview.writingLab}</Button>
        </article>
      </div>
    )
  }

  const trendText =
    metrics.trend.direction === 'down' && metrics.trend.percent != null
      ? copy.progress.trendImproved.replace('{percent}', String(metrics.trend.percent))
      : metrics.trend.direction === 'up' && metrics.trend.percent != null
        ? copy.progress.trendIncreased.replace('{percent}', String(metrics.trend.percent))
        : metrics.trend.direction === 'flat'
          ? copy.progress.trendFlat
          : copy.progress.trendInsufficient

  return (
    <div className="wd-panel-stack">
      <header className="wd-panel-head">
        <h2>{copy.progress.title}</h2>
        <p className="wd-lead">{copy.progress.lead}</p>
      </header>

      <section className="wd-stats">
        <article className="wd-stat">
          <span>{copy.progress.wordsWritten}</span>
          <strong>{metrics.wordsWritten.toLocaleString()}</strong>
        </article>
        <article className="wd-stat">
          <span>{copy.progress.uniqueErrors}</span>
          <strong>{metrics.errorCount.toLocaleString()}</strong>
        </article>
        <article className="wd-stat">
          <span>{copy.progress.errorsPer100}</span>
          <strong>{metrics.errorsPer100Words != null ? metrics.errorsPer100Words.toFixed(1) : '—'}</strong>
        </article>
      </section>

      <article className="wd-card">
        <h3>{copy.progress.trend}</h3>
        <p>{trendText}</p>
        <ProgressChartBlock
          daily={metrics.charts.daily}
          weekly={metrics.charts.weekly}
          skills={metrics.charts.skills}
          range={chartRange}
          onRangeChange={setChartRange}
          labels={{ chart7d: copy.progress.chart7d, chart30d: copy.progress.chart30d }}
        />
      </article>

      {advanced && metrics.recurringPatterns.length > 0 ? (
        <article className="wd-card">
          <h3>{copy.progress.recurring}</h3>
          <ul className="wd-list">
            {metrics.recurringPatterns.map((pattern) => (
              <li key={`${pattern.category}:${pattern.normalizedOriginal}`}>
                <span className="wd-pattern-pair">
                  {pattern.displayOriginal} → {pattern.displayCorrected}
                </span>
                <span className="wd-muted"> · {pattern.count}× · {pattern.category}</span>
              </li>
            ))}
          </ul>
          <div className="wd-actions">
            <Button type="button" variant="secondary" onClick={onOpenPractice}>
              {copy.practice.startSession}
            </Button>
          </div>
        </article>
      ) : null}

      <div className="wd-actions">
        <Button type="button" variant="ghost" disabled={clearing} onClick={() => void onClearHistory()}>
          {copy.progress.clearHistory}
        </Button>
      </div>
    </div>
  )
}
