import { useEffect, useState } from 'react'
import type { PersonalizationInsight } from '@flowlary/shared'
import type { ProgressMetrics } from '../../storage/learning/progress.ts'
import { INPUT_LEARNING_CATEGORIES, WRITING_LEARNING_CATEGORIES } from '@flowlary/shared'
import { clearLearningHistory, fetchProgress } from '../../popup/api.ts'
import { t } from '../../popup/i18n/index.ts'
import { ConfirmDialog } from '../../ui/shared.tsx'
import { getUpgradeUrl } from '../../config/upgrade.ts'
import { ProgressChartBlock } from '../components/ProgressCharts.tsx'

type ProgressPanelProps = {
  learningSummary?: string | null
  onOpenActivity: () => void
  onOpenPractice?: () => void
  /** When false, hide recurring-mistake / advanced sections (Free basic progress). */
  advanced?: boolean
}

function categoryLabel(category: string): string {
  return t(`learning.focus.${category}` as 'learning.focus.spelling')
}

function trendText(metrics: ProgressMetrics): string {
  const { trend } = metrics
  if (trend.label === 'not_enough_data') return t('progress.trendInsufficient')
  if (trend.direction === 'down' && trend.percent != null) {
    return t('progress.trendImproved', { percent: String(trend.percent) })
  }
  if (trend.direction === 'up' && trend.percent != null) {
    return t('progress.trendIncreased', { percent: String(trend.percent) })
  }
  if (trend.direction === 'flat') return t('progress.trendFlat')
  return t('progress.trendInsufficient')
}

function insightText(insight: PersonalizationInsight): string {
  switch (insight.id) {
    case 'building_profile':
      return t('personalization.buildingProfile')
    case 'user_focus': {
      const categories = (insight.params?.categories ?? '')
        .split(',')
        .map((value) => categoryLabel(value.trim()))
        .filter(Boolean)
        .join(', ')
      return t('personalization.userFocus', { categories })
    }
    case 'system_focus':
      return t('personalization.systemFocus', {
        category: categoryLabel(insight.params?.category ?? ''),
      })
    case 'recurring_pattern':
      return t('personalization.recurringPattern', {
        category: categoryLabel(insight.params?.category ?? ''),
        original: insight.params?.original ?? '',
        corrected: insight.params?.corrected ?? '',
        count: insight.params?.count ?? '2',
      })
    case 'trend_improved':
      return t('personalization.trendImproved', { percent: insight.params?.percent ?? '0' })
    case 'trend_increased':
      return t('personalization.trendIncreased', { percent: insight.params?.percent ?? '0' })
    case 'input_layout_focus':
      return t('personalization.inputLayoutFocus')
    default:
      return ''
  }
}

export function ProgressPanel({
  learningSummary,
  onOpenActivity,
  onOpenPractice,
  advanced = true,
}: ProgressPanelProps) {
  const [metrics, setMetrics] = useState<ProgressMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [clearOpen, setClearOpen] = useState(false)
  const [clearBusy, setClearBusy] = useState(false)
  const [chartRange, setChartRange] = useState<'7d' | '30d'>('7d')

  useEffect(() => {
    let active = true
    void fetchProgress()
      .then((data) => {
        if (active) setMetrics(data)
      })
      .catch(() => {
        if (active) setError(t('errors.loadSettings'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  if (loading) {
    return <p className="fl-loading" role="status">{t('progress.loading')}</p>
  }

  if (error || !metrics) {
    return (
      <div className="fl-dash-card fl-progress" role="alert">
        <p className="fl-error">{error ?? t('errors.loadSettings')}</p>
      </div>
    )
  }

  if (metrics.state === 'empty') {
    return (
      <div className="fl-dash-card fl-progress">
        {learningSummary ? (
          <p className="fl-card-desc">
            {t('progress.learningContext', { language: learningSummary.split(' · ')[0] ?? 'English' })}
          </p>
        ) : null}
        <div className="fl-empty-state" role="status">
          <h3 className="fl-empty-title">{t('progress.buildingTitle')}</h3>
          <p className="fl-empty-desc">{t('progress.buildingBody')}</p>
        </div>
        <p className="fl-card-desc">{t('progress.activityNote')}</p>
        <button type="button" className="fl-link-btn" onClick={onOpenActivity}>
          {t('progress.viewActivity')}
        </button>
      </div>
    )
  }

  return (
    <div className="fl-progress-page">
      <section className="fl-dash-card fl-progress-section" aria-labelledby="progress-summary-heading">
        <h3 id="progress-summary-heading" className="fl-section-label">{t('progress.summary')}</h3>
        <div className="fl-progress-stats">
          <article className="fl-progress-stat">
            <p className="fl-progress-stat-label">{t('progress.wordsWritten')}</p>
            <p className="fl-progress-stat-value">{metrics.wordsWritten.toLocaleString()}</p>
          </article>
          <article className="fl-progress-stat">
            <p className="fl-progress-stat-label">{t('progress.uniqueErrors')}</p>
            <p className="fl-progress-stat-value">{metrics.errorCount.toLocaleString()}</p>
          </article>
          <article className="fl-progress-stat">
            <p className="fl-progress-stat-label">{t('progress.errorsPer100')}</p>
            <p className="fl-progress-stat-value">
              {metrics.errorsPer100Words != null ? metrics.errorsPer100Words.toFixed(1) : '—'}
            </p>
          </article>
        </div>
        {metrics.state === 'insufficient_words' ? (
          <p className="fl-card-desc" role="status">{t('progress.insufficientWords')}</p>
        ) : null}
      </section>

      {metrics.charts ? (
        <ProgressChartBlock
          daily={metrics.charts.daily}
          weekly={metrics.charts.weekly}
          skills={metrics.charts.skills}
          range={chartRange}
          onRange={setChartRange}
        />
      ) : null}

      <section className="fl-dash-card fl-progress-section" aria-labelledby="progress-trend-heading">
        <h3 id="progress-trend-heading" className="fl-section-label">{t('progress.improvement')}</h3>
        <p className="fl-progress-trend" role="status">{trendText(metrics)}</p>
      </section>

      {metrics.personalization && metrics.personalization.insights.length > 0 ? (
        <section className="fl-dash-card fl-progress-section" aria-labelledby="progress-personalization-heading">
          <h3 id="progress-personalization-heading" className="fl-section-label">
            {t('progress.personalizationTitle')}
          </h3>
          <ul className="fl-progress-insight-list">
            {metrics.personalization.insights.map((insight) => {
              const text = insightText(insight)
              if (!text) return null
              return (
                <li key={insight.id + (insight.params?.category ?? insight.params?.original ?? '')}>
                  {text}
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      <section className="fl-dash-card fl-progress-section" aria-labelledby="progress-type-heading">
        <h3 id="progress-type-heading" className="fl-section-label">{t('progress.byType')}</h3>
        <h4 className="fl-progress-type-group">{t('progress.writingGroup')}</h4>
        <ul className="fl-progress-type-list">
          {WRITING_LEARNING_CATEGORIES.map((type) => (
            <li key={type}>
              <span className={`fl-teach-badge fl-teach-${type}`}>{categoryLabel(type)}</span>
              <strong>
                {metrics.byType[type]}
                {metrics.byTypePercentWriting ? ` · ${metrics.byTypePercentWriting[type]}%` : ''}
              </strong>
            </li>
          ))}
        </ul>
        <h4 className="fl-progress-type-group">{t('progress.inputGroup')}</h4>
        <ul className="fl-progress-type-list">
          {INPUT_LEARNING_CATEGORIES.map((type) => (
            <li key={type}>
              <span className={`fl-teach-badge fl-teach-${type}`}>{categoryLabel(type)}</span>
              <strong>
                {metrics.byType[type]}
                {metrics.byTypePercentInput ? ` · ${metrics.byTypePercentInput[type]}%` : ''}
              </strong>
            </li>
          ))}
        </ul>
      </section>

      {advanced && metrics.recurringPatterns.length > 0 ? (
        <section className="fl-dash-card fl-progress-section" aria-labelledby="progress-patterns-heading">
          <h3 id="progress-patterns-heading" className="fl-section-label">{t('progress.recurring')}</h3>
          <ul className="fl-progress-pattern-list">
            {metrics.recurringPatterns.map((pattern) => (
              <li key={`${pattern.category}:${pattern.normalizedOriginal}`}>
                <span className={`fl-progress-pattern-type fl-teach-${pattern.category}`}>
                  {categoryLabel(pattern.category)}
                </span>
                <span className="fl-progress-pattern-pair">
                  {pattern.displayOriginal} → {pattern.displayCorrected}
                </span>
                <span className="fl-progress-pattern-count">{pattern.count}×</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!advanced ? (
        <section className="fl-dash-card fl-progress-section fl-upgrade-teaser" role="status">
          <h3 className="fl-section-label">{t('progress.recurring')}</h3>
          <p className="fl-card-desc">{t('progress.advancedProOnly')}</p>
          <a className="fl-action-btn fl-action-btn-primary" href={getUpgradeUrl()} target="_blank" rel="noreferrer">
            {t('account.upgradeToPro')}
          </a>
        </section>
      ) : null}

      {advanced && metrics.recentEvents.length > 0 ? (
        <section className="fl-dash-card fl-progress-section" aria-labelledby="progress-recent-heading">
          <h3 id="progress-recent-heading" className="fl-section-label">{t('progress.recent')}</h3>
          <ul className="fl-progress-recent-list">
            {metrics.recentEvents.map((event) => (
              <li key={event.id}>
                <span className={`fl-progress-pattern-type fl-teach-${event.category}`}>
                  {categoryLabel(event.category)}
                </span>
                <span className="fl-progress-pattern-pair">
                  {event.original} → {event.corrected}
                </span>
                <span className="fl-progress-pattern-count">{event.relativeLabel}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {metrics.practiceSummary.sessionsThisWeek > 0 ? (
        <section className="fl-dash-card fl-progress-section" aria-labelledby="progress-practice-heading">
          <h3 id="progress-practice-heading" className="fl-section-label">
            {t('progress.practiceThisWeek')}
          </h3>
          <ul className="fl-progress-type-list">
            <li>
              <span>{t('progress.practiceThisWeek')}</span>
              <strong>{t('progress.practiceSessionsWeek', { count: String(metrics.practiceSummary.sessionsThisWeek) })}</strong>
            </li>
            <li>
              <span>{t('progress.learningEvents')}</span>
              <strong>{t('progress.practiceItemsWeek', { count: String(metrics.practiceSummary.itemsThisWeek) })}</strong>
            </li>
            <li>
              <span>{t('progress.recurring')}</span>
              <strong>
                {t('progress.practicePatternsWeek', {
                  count: String(metrics.practiceSummary.patternsReviewedThisWeek),
                })}
              </strong>
            </li>
          </ul>
          <p className="fl-card-desc">{t('progress.activityNote')}</p>
        </section>
      ) : null}

      <section className="fl-dash-card fl-progress-section" aria-labelledby="progress-next-heading">
        <h3 id="progress-next-heading" className="fl-section-label">{t('progress.nextStep')}</h3>
        <p className="fl-card-desc">{t('progress.practiceSoon')}</p>
        <button type="button" className="fl-action-btn" onClick={onOpenPractice}>
          {t('progress.practiceCta')}
        </button>
      </section>

      <div className="fl-progress-foot">
        <p className="fl-card-desc">{t('progress.localNote')}</p>
        <button type="button" className="fl-link-btn" onClick={() => setClearOpen(true)}>
          {t('progress.clearLearning')}
        </button>
        <button type="button" className="fl-link-btn" onClick={onOpenActivity}>
          {t('progress.viewActivity')}
        </button>
      </div>

      <ConfirmDialog
        open={clearOpen}
        title={t('progress.clearConfirmTitle')}
        description={t('progress.clearConfirmDesc')}
        confirmLabel={t('progress.clearConfirmAction')}
        busy={clearBusy}
        onCancel={() => setClearOpen(false)}
        onConfirm={() => {
          setClearBusy(true)
          void clearLearningHistory()
            .then((next) => {
              setMetrics(next)
              setClearOpen(false)
            })
            .finally(() => setClearBusy(false))
        }}
      />
    </div>
  )
}

export function ProgressTeaser({
  onOpenProgress,
}: {
  onOpenProgress: () => void
}) {
  const [metrics, setMetrics] = useState<ProgressMetrics | null>(null)

  useEffect(() => {
    let active = true
    void fetchProgress()
      .then((data) => {
        if (active) setMetrics(data)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  if (!metrics || metrics.state !== 'ready') {
    return (
      <section className="fl-dash-card fl-progress-teaser" aria-labelledby="progress-teaser-heading">
        <h3 id="progress-teaser-heading" className="fl-section-label">{t('progress.teaserTitle')}</h3>
        <p className="fl-card-desc">{t('progress.teaserEmpty')}</p>
        <button type="button" className="fl-link-btn" onClick={onOpenProgress}>
          {t('progress.viewProgress')}
        </button>
      </section>
    )
  }

  return (
    <section className="fl-dash-card fl-progress-teaser" aria-labelledby="progress-teaser-heading">
      <h3 id="progress-teaser-heading" className="fl-section-label">{t('progress.teaserTitle')}</h3>
      <div className="fl-progress-stats fl-progress-stats-compact">
        <article className="fl-progress-stat">
          <p className="fl-progress-stat-label">{t('progress.wordsWritten')}</p>
          <p className="fl-progress-stat-value">{metrics.wordsWritten.toLocaleString()}</p>
        </article>
        <article className="fl-progress-stat">
          <p className="fl-progress-stat-label">{t('progress.errorsPer100')}</p>
          <p className="fl-progress-stat-value">{metrics.errorsPer100Words?.toFixed(1) ?? '—'}</p>
        </article>
      </div>
      <button type="button" className="fl-link-btn" onClick={onOpenProgress}>
        {t('progress.viewProgress')}
      </button>
    </section>
  )
}
