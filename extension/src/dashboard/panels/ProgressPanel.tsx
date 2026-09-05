import { useEffect, useMemo, useState } from 'react'
import type { PersonalizationInsight } from '@flowlary/shared'
import type { ProgressMetrics, ProgressRange } from '../../storage/learning/progress.ts'
import {
  categoryNeedsPractice,
  summarizeProgressRange,
} from '../../storage/learning/progress.ts'
import { INPUT_LEARNING_CATEGORIES, WRITING_LEARNING_CATEGORIES } from '@flowlary/shared'
import { clearLearningHistory, fetchProgress } from '../../popup/api.ts'
import { t } from '../../popup/i18n/index.ts'
import { ConfirmDialog } from '../../ui/shared.tsx'
import { getUpgradeUrl } from '../../config/upgrade.ts'
import { ProgressChartBlock } from '../components/ProgressCharts.tsx'
import { MistakeCard } from '../components/MistakeCard.tsx'

type ProgressPanelProps = {
  learningSummary?: string | null
  onOpenActivity: () => void
  onOpenPractice?: (targetPatternId?: string) => void
  /** When false, hide recurring-mistake / advanced sections (Free basic progress). */
  advanced?: boolean
}

function categoryLabel(category: string): string {
  return t(`learning.focus.${category}` as 'learning.focus.spelling')
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
  const [chartRange, setChartRange] = useState<ProgressRange>('all')
  const [view, setView] = useState<'list' | 'type'>('list')
  const [typeFilter, setTypeFilter] = useState<
    'all' | (typeof WRITING_LEARNING_CATEGORIES)[number] | (typeof INPUT_LEARNING_CATEGORIES)[number]
  >('all')
  const [historyFocus, setHistoryFocus] = useState<string | null>(null)

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

  const rangeSummary = useMemo(
    () => (metrics ? summarizeProgressRange(metrics, chartRange) : null),
    [metrics, chartRange],
  )

  const rangeStart = useMemo(() => {
    const now = Date.now()
    if (chartRange === '7d') return now - 7 * 24 * 60 * 60 * 1000
    if (chartRange === '30d') return now - 30 * 24 * 60 * 60 * 1000
    return 0
  }, [chartRange])

  const visibleMistakes = useMemo(() => {
    if (!metrics) return []
    return metrics.mistakes.filter((item) => {
      if (item.timestamp < rangeStart) return false
      if (typeFilter !== 'all' && item.category !== typeFilter) return false
      if (historyFocus && item.id !== historyFocus) return false
      return true
    })
  }, [metrics, rangeStart, typeFilter, historyFocus])

  if (loading) {
    return <p className="fl-loading" role="status">{t('progress.loading')}</p>
  }

  if (error || !metrics || !rangeSummary) {
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

  const leadingType = WRITING_LEARNING_CATEGORIES.reduce((best, type) =>
    rangeSummary.byType[type] > rangeSummary.byType[best] ? type : best,
  )
  const rateLabel = rangeSummary.rate != null ? rangeSummary.rate.toFixed(1) : '0.0'
  const trendWord =
    metrics.trend.direction === 'down'
      ? t('progress.focusImproving')
      : metrics.trend.direction === 'up'
        ? t('progress.focusRising')
        : t('progress.focusSteady')
  const vsLast =
    metrics.trend.direction === 'up'
      ? t('progress.needsPracticeVsLast')
      : metrics.trend.direction === 'down'
        ? t('progress.improvingVsLast')
        : t('progress.steadyVsLast')
  const topPattern = metrics.recurringPatterns[0] ?? null

  const grouped =
    view === 'type'
      ? [...WRITING_LEARNING_CATEGORIES, ...INPUT_LEARNING_CATEGORIES].map((type) => ({
          type,
          items: visibleMistakes.filter((item) => item.category === type),
        })).filter((group) => group.items.length > 0)
      : [{ type: 'all' as const, items: visibleMistakes }]

  return (
    <div className="fl-progress-page">
      {topPattern || rangeSummary.errors > 0 ? (
        <section className={`fl-dash-card fl-progress-focus fl-progress-focus-${leadingType}`}>
          <div className="fl-progress-focus-head">
            <h3 className="fl-section-label">{t('progress.focusTitle', { category: categoryLabel(leadingType) })}</h3>
            <span className={`fl-teach-badge fl-teach-${leadingType}`}>{categoryLabel(leadingType)}</span>
          </div>
          <p className="fl-card-desc">
            {t('progress.focusBody', {
              trend: trendWord,
              rate: rateLabel,
              category: categoryLabel(leadingType),
              count: String(rangeSummary.byType[leadingType]),
            })}
          </p>
          {topPattern ? (
            <p className="fl-progress-top-phrase">
              {t('progress.topPhrase', {
                original: topPattern.displayOriginal,
                corrected: topPattern.displayCorrected,
                count: String(topPattern.count),
              })}
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="fl-progress-toolbar">
        <div className="fl-progress-range" role="group" aria-label={t('progress.chartRange')}>
          {([
            ['7d', t('progress.range7d')],
            ['30d', t('progress.range30d')],
            ['all', t('progress.rangeAll')],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`fl-history-filter${chartRange === id ? ' is-active' : ''}`}
              onClick={() => setChartRange(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="fl-progress-range" role="group" aria-label={t('progress.byType')}>
          <button
            type="button"
            className={`fl-history-filter${view === 'list' ? ' is-active' : ''}`}
            onClick={() => setView('list')}
          >
            {t('progress.viewList')}
          </button>
          <button
            type="button"
            className={`fl-history-filter${view === 'type' ? ' is-active' : ''}`}
            onClick={() => setView('type')}
          >
            {t('progress.viewByType')}
          </button>
        </div>
      </div>

      <div className="fl-progress-hero">
        <article className="fl-progress-stat fl-progress-stat-hero">
          <p className="fl-progress-stat-label">{t('progress.errorsPer100')}</p>
          <p className="fl-progress-stat-value">{rangeSummary.rate != null ? rangeSummary.rate.toFixed(1) : '—'}</p>
          {metrics.state === 'insufficient_words' ? (
            <p className="fl-progress-stat-note">{t('progress.insufficientWords')}</p>
          ) : (
            <p className="fl-progress-stat-note">{vsLast}</p>
          )}
        </article>
        <article className="fl-progress-stat fl-progress-stat-hero">
          <p className="fl-progress-stat-label">{t('progress.mistakesLogged')}</p>
          <p className="fl-progress-stat-value">{rangeSummary.errors.toLocaleString()}</p>
          <p className="fl-progress-stat-note">
            {t('progress.wordsInRange', { count: String(rangeSummary.words) })}
          </p>
        </article>
      </div>

      <div className="fl-progress-skills">
        {WRITING_LEARNING_CATEGORIES.map((type) => (
          <article key={type} className={`fl-progress-skill fl-progress-skill-${type}`}>
            <div className="fl-progress-skill-head">
              <span className={`fl-teach-badge fl-teach-${type}`}>{categoryLabel(type)}</span>
            </div>
            <p className="fl-progress-stat-value">{rangeSummary.byType[type]}</p>
            <p className="fl-progress-stat-note">
              {rangeSummary.byType[type] > 0 && categoryNeedsPractice(metrics.charts.daily, type)
                ? t('progress.needsPractice')
                : t('progress.steadyVsLast')}
            </p>
          </article>
        ))}
      </div>

      <ProgressChartBlock
        daily={metrics.charts.daily}
        weekly={metrics.charts.weekly}
        range={chartRange}
      />

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

      {!advanced ? (
        <section className="fl-dash-card fl-progress-section fl-upgrade-teaser" role="status">
          <h3 className="fl-section-label">{t('progress.recurring')}</h3>
          <p className="fl-card-desc">{t('progress.advancedProOnly')}</p>
          <a className="fl-action-btn fl-action-btn-primary" href={getUpgradeUrl()} target="_blank" rel="noreferrer">
            {t('account.upgradeToPro')}
          </a>
        </section>
      ) : null}

      {advanced ? (
        <section className="fl-progress-mistakes" aria-labelledby="progress-recent-heading">
          <div className="fl-mistake-filters" role="tablist" aria-label={t('progress.recent')}>
            <button
              type="button"
              className={`fl-history-filter${typeFilter === 'all' && !historyFocus ? ' is-active' : ''}`}
              onClick={() => {
                setTypeFilter('all')
                setHistoryFocus(null)
              }}
            >
              {t('progress.filterAll')}
            </button>
            {WRITING_LEARNING_CATEGORIES.map((type) => (
              <button
                key={type}
                type="button"
                className={`fl-history-filter${typeFilter === type ? ' is-active' : ''}`}
                onClick={() => {
                  setTypeFilter(type)
                  setHistoryFocus(null)
                }}
              >
                {categoryLabel(type)} · {rangeSummary.byType[type]}
              </button>
            ))}
            {INPUT_LEARNING_CATEGORIES.map((type) => (
              <button
                key={type}
                type="button"
                className={`fl-history-filter${typeFilter === type ? ' is-active' : ''}`}
                onClick={() => {
                  setTypeFilter(type)
                  setHistoryFocus(null)
                }}
              >
                {categoryLabel(type)} · {metrics.byType[type]}
              </button>
            ))}
          </div>
          <div className="fl-progress-mistakes-head">
            <h3 id="progress-recent-heading" className="fl-section-label">
              {t('progress.recent')}
            </h3>
            <p className="fl-card-desc">{t('progress.repeatsNote')}</p>
          </div>
          {grouped.map((group) => (
            <div key={group.type} className="fl-mistake-group">
              {group.type !== 'all' ? (
                <h4 className={`fl-progress-type-group fl-teach-${group.type}`}>{categoryLabel(group.type)}</h4>
              ) : null}
              {group.items.map((item) => (
                <MistakeCard
                  key={item.id}
                  item={item}
                  onOpenHistory={(next) => setHistoryFocus(next.id)}
                  onPractice={onOpenPractice}
                />
              ))}
            </div>
          ))}
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
          </ul>
        </section>
      ) : null}

      <section className="fl-dash-card fl-progress-section" aria-labelledby="progress-next-heading">
        <h3 id="progress-next-heading" className="fl-section-label">{t('progress.nextStep')}</h3>
        <p className="fl-card-desc">{t('progress.practiceSoon')}</p>
        <button type="button" className="fl-action-btn" onClick={() => onOpenPractice?.()}>
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
