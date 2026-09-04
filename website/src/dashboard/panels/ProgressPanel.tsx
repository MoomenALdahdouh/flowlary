import { useMemo, useState } from 'react'
import { Button } from '../../components/Ui.tsx'
import { WritingLabLink } from '../components/WritingLabLink.tsx'
import { clearRemoteLearningEvents } from '../../account/learningEventsClient.ts'
import type { DashboardCopy } from '../types.ts'
import { computeWebProgress } from '../services/learningData.ts'
import type { WebLearningBundle } from '../services/learningData.ts'
import { ProgressChartBlock } from '../components/ProgressCharts.tsx'
import { MistakeCard } from '../components/MistakeCard.tsx'
import {
  categoryNeedsPractice,
  summarizeProgressRange,
  type ProgressRange,
} from '../learning/progress.ts'
import { WRITING_LEARNING_CATEGORIES } from '@flowlary/shared'

type ProgressPanelProps = {
  bundle: WebLearningBundle
  copy: DashboardCopy
  advanced: boolean
  onRefresh: () => void
  onOpenPractice: (target?: string) => void
  onOpenLab: () => void
}

function categoryLabel(type: string, copy: DashboardCopy): string {
  if (type === 'spelling') return copy.practice.focusSpelling
  if (type === 'grammar') return copy.practice.focusGrammar
  return copy.practice.focusWording
}

export function ProgressPanel({ bundle, copy, advanced, onRefresh, onOpenPractice, onOpenLab }: ProgressPanelProps) {
  const [chartRange, setChartRange] = useState<ProgressRange>('all')
  const [view, setView] = useState<'list' | 'type'>('list')
  const [typeFilter, setTypeFilter] = useState<'all' | (typeof WRITING_LEARNING_CATEGORIES)[number]>('all')
  const [historyFocus, setHistoryFocus] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)
  const metrics = useMemo(() => computeWebProgress(bundle), [bundle])
  const rangeSummary = useMemo(() => summarizeProgressRange(metrics, chartRange), [metrics, chartRange])

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
          <WritingLabLink compact onOpen={onOpenLab} />
        </article>
      </div>
    )
  }

  const rangeStart = (() => {
    const now = Date.now()
    if (chartRange === '7d') return now - 7 * 24 * 60 * 60 * 1000
    if (chartRange === '30d') return now - 30 * 24 * 60 * 60 * 1000
    return 0
  })()

  const visibleMistakes = metrics.mistakes.filter((item) => {
    if (item.timestamp < rangeStart) return false
    if (typeFilter !== 'all' && item.category !== typeFilter) return false
    if (historyFocus && item.id !== historyFocus) return false
    return true
  })

  const leadingType = WRITING_LEARNING_CATEGORIES.reduce((best, type) =>
    rangeSummary.byType[type] > rangeSummary.byType[best] ? type : best,
  )
  const trendWord =
    metrics.trend.direction === 'down'
      ? copy.progress.focusImproving
      : metrics.trend.direction === 'up'
        ? copy.progress.focusRising
        : copy.progress.focusSteady
  const vsLast =
    metrics.trend.direction === 'up'
      ? copy.progress.needsPracticeVsLast
      : metrics.trend.direction === 'down'
        ? copy.progress.improvingVsLast
        : copy.progress.steadyVsLast
  const topPattern = metrics.recurringPatterns[0] ?? null
  const grouped =
    view === 'type'
      ? WRITING_LEARNING_CATEGORIES.map((type) => ({
          type,
          items: visibleMistakes.filter((item) => item.category === type),
        })).filter((group) => group.items.length > 0)
      : [{ type: 'all' as const, items: visibleMistakes }]

  return (
    <div className="wd-panel-stack">
      <header className="wd-panel-head">
        <h2>{copy.progress.title}</h2>
        <p className="wd-lead">{copy.progress.lead}</p>
      </header>

      {topPattern || rangeSummary.errors > 0 ? (
        <article className={`wd-card wd-progress-focus wd-progress-focus-${leadingType}`}>
          <h3>{copy.progress.focusTitle.replace('{category}', categoryLabel(leadingType, copy))}</h3>
          <p>
            {copy.progress.focusBody
              .replace('{trend}', trendWord)
              .replace('{rate}', rangeSummary.rate != null ? rangeSummary.rate.toFixed(1) : '0.0')
              .replace('{category}', categoryLabel(leadingType, copy))
              .replace('{count}', String(rangeSummary.byType[leadingType]))}
          </p>
          {topPattern ? (
            <p className="wd-progress-top-phrase">
              {copy.progress.topPhrase
                .replace('{original}', topPattern.displayOriginal)
                .replace('{corrected}', topPattern.displayCorrected)
                .replace('{count}', String(topPattern.count))}
            </p>
          ) : null}
        </article>
      ) : null}

      <div className="wd-progress-toolbar">
        <div className="wd-chart-tabs" role="group">
          {([
            ['7d', copy.progress.chart7d],
            ['30d', copy.progress.chart30d],
            ['all', copy.progress.chartAll],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={chartRange === id ? 'is-active' : ''}
              onClick={() => setChartRange(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="wd-chart-tabs" role="group">
          <button type="button" className={view === 'list' ? 'is-active' : ''} onClick={() => setView('list')}>
            {copy.progress.viewList}
          </button>
          <button type="button" className={view === 'type' ? 'is-active' : ''} onClick={() => setView('type')}>
            {copy.progress.viewByType}
          </button>
        </div>
      </div>

      <section className="wd-stats wd-stats-hero">
        <article className="wd-stat">
          <span>{copy.progress.errorsPer100}</span>
          <strong>{rangeSummary.rate != null ? rangeSummary.rate.toFixed(1) : '-'}</strong>
          <em>{vsLast}</em>
        </article>
        <article className="wd-stat">
          <span>{copy.progress.mistakesLogged}</span>
          <strong>{rangeSummary.errors.toLocaleString()}</strong>
          <em>{copy.progress.wordsInRange.replace('{count}', String(rangeSummary.words))}</em>
        </article>
      </section>

      <section className="wd-skill-sparks wd-category-cards">
        {WRITING_LEARNING_CATEGORIES.map((type) => (
          <article key={type} className={`wd-stat wd-cat-${type}`}>
            <span>{categoryLabel(type, copy)}</span>
            <strong>{rangeSummary.byType[type]}</strong>
            <em>
              {rangeSummary.byType[type] > 0 && categoryNeedsPractice(metrics.charts.daily, type)
                ? copy.progress.needsPractice
                : copy.progress.steadyVsLast}
            </em>
          </article>
        ))}
      </section>

      <article className="wd-card">
        <ProgressChartBlock
          daily={metrics.charts.daily}
          weekly={metrics.charts.weekly}
          skills={metrics.charts.skills}
          range={chartRange}
          onRangeChange={setChartRange}
          labels={{
            chart7d: copy.progress.chart7d,
            chart30d: copy.progress.chart30d,
            chartAll: copy.progress.chartAll,
            chartRate: copy.progress.chartRate,
            chartByType: copy.progress.chartByType,
          }}
        />
      </article>

      {advanced ? (
        <section className="wd-mistakes">
          <div className="wd-chart-tabs" role="tablist">
            <button
              type="button"
              className={typeFilter === 'all' && !historyFocus ? 'is-active' : ''}
              onClick={() => {
                setTypeFilter('all')
                setHistoryFocus(null)
              }}
            >
              {copy.progress.filterAll}
            </button>
            {WRITING_LEARNING_CATEGORIES.map((type) => (
              <button
                key={type}
                type="button"
                className={typeFilter === type ? 'is-active' : ''}
                onClick={() => {
                  setTypeFilter(type)
                  setHistoryFocus(null)
                }}
              >
                {categoryLabel(type, copy)} · {rangeSummary.byType[type]}
              </button>
            ))}
          </div>
          <h3>{copy.progress.recent}</h3>
          <p className="wd-muted">{copy.progress.repeatsNote}</p>
          {grouped.map((group) => (
            <div key={group.type} className="wd-mistake-group">
              {group.items.map((item) => (
                <MistakeCard
                  key={item.id}
                  item={item}
                  copy={copy}
                  onOpenHistory={(next) => setHistoryFocus(next.id)}
                  onPractice={onOpenPractice}
                />
              ))}
            </div>
          ))}
        </section>
      ) : (
        <article className="wd-card">
          <h3>{copy.progress.recurring}</h3>
          <WritingLabLink compact onOpen={onOpenLab} />
        </article>
      )}

      <div className="wd-actions">
        <Button type="button" variant="secondary" onClick={() => onOpenPractice()}>
          {copy.practice.startSession}
        </Button>
        <Button type="button" variant="ghost" disabled={clearing} onClick={() => void onClearHistory()}>
          {copy.progress.clearHistory}
        </Button>
      </div>
    </div>
  )
}
