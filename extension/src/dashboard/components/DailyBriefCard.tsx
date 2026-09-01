import { useEffect, useState } from 'react'
import type { DailyLearningBrief } from '@flowlary/shared'
import { t } from '../../popup/i18n/index.ts'
import { flowlaryStorage } from '../../storage/index.ts'
import { resolveDailyLearningBrief } from '../../storage/learning/brief/resolveDailyBrief.ts'
import { AiErrorRecovery } from '../../ui/AiErrorRecovery.tsx'

const BRIEF_LOAD_TIMEOUT_MS = 20_000

async function loadDailyBrief(): Promise<DailyLearningBrief> {
  return Promise.race([
    resolveDailyLearningBrief(flowlaryStorage),
    new Promise<DailyLearningBrief>((_, reject) => {
      window.setTimeout(() => reject(new Error('brief_timeout')), BRIEF_LOAD_TIMEOUT_MS)
    }),
  ])
}

type DailyBriefCardProps = {
  signedIn: boolean
  onOpenPractice: (targetPatternId?: string) => void
  onOpenProgress: () => void
  onOpenAccount: () => void
}

function categoryLabel(category: string): string {
  return t(`learning.focus.${category}` as 'learning.focus.spelling')
}

function summaryText(brief: DailyLearningBrief): string {
  if (brief.state === 'signed_out') return t('dailyBrief.signIn')
  if (brief.state === 'empty') return t('dailyBrief.empty')
  if (brief.state === 'insufficient') return t('dailyBrief.insufficient')

  if (brief.recurringPattern) {
    return t('dailyBrief.recurringSummary', {
      original: brief.recurringPattern.displayOriginal,
      corrected: brief.recurringPattern.displayCorrected,
      count: String(brief.recurringPattern.count),
    })
  }

  if (brief.hasRecentWriting && brief.focusCategory) {
    return t('dailyBrief.focusSummary', {
      category: categoryLabel(brief.focusCategory),
    })
  }

  return t('dailyBrief.readyDefault')
}

function improvementText(brief: DailyLearningBrief): string | null {
  if (!brief.improvement) return null
  if (brief.improvement.direction === 'down') {
    return t('dailyBrief.improved', { percent: String(brief.improvement.percent) })
  }
  return t('dailyBrief.increased', { percent: String(brief.improvement.percent) })
}

function actionLabel(brief: DailyLearningBrief): string {
  switch (brief.recommendedAction.kind) {
    case 'practice_pattern':
    case 'practice_focus':
      return t('dailyBrief.practiceThis')
    case 'keep_writing':
      return t('dailyBrief.keepWriting')
    default:
      return t('dailyBrief.viewProgress')
  }
}

export function DailyBriefCard({
  signedIn,
  onOpenPractice,
  onOpenProgress,
  onOpenAccount,
}: DailyBriefCardProps) {
  const [brief, setBrief] = useState<DailyLearningBrief | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!signedIn) {
      setBrief(null)
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    setError(false)
    void loadDailyBrief()
      .then((data) => {
        if (active) setBrief(data)
      })
      .catch(() => {
        if (active) setError(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [signedIn, reloadKey])

  if (!signedIn) {
    return (
      <section className="fl-dash-card fl-daily-brief" aria-labelledby="daily-brief-heading">
        <h3 id="daily-brief-heading" className="fl-section-label">
          {t('dailyBrief.title')}
        </h3>
        <p className="fl-card-desc">{t('dailyBrief.signIn')}</p>
        <button type="button" className="fl-link-btn" onClick={onOpenAccount}>
          {t('account.signIn')}
        </button>
      </section>
    )
  }

  if (loading) {
    return (
      <section className="fl-dash-card fl-daily-brief" aria-labelledby="daily-brief-heading">
        <h3 id="daily-brief-heading" className="fl-section-label">
          {t('dailyBrief.title')}
        </h3>
        <p className="fl-loading" role="status">
          {t('dailyBrief.loading')}
        </p>
      </section>
    )
  }

  if (error || !brief) {
    return (
      <section className="fl-dash-card fl-daily-brief" aria-labelledby="daily-brief-heading">
        <h3 id="daily-brief-heading" className="fl-section-label">
          {t('dailyBrief.title')}
        </h3>
        <p className="fl-card-desc">{t('dailyBrief.unavailable')}</p>
        <AiErrorRecovery onRetry={() => setReloadKey((value) => value + 1)} />
      </section>
    )
  }

  const improvement = improvementText(brief)

  return (
    <section className="fl-dash-card fl-daily-brief" aria-labelledby="daily-brief-heading">
      <h3 id="daily-brief-heading" className="fl-section-label">
        {t('dailyBrief.title')}
      </h3>
      <p className="fl-card-desc">{summaryText(brief)}</p>

      {brief.focusCategory && brief.state === 'ready' ? (
        <div className="fl-daily-brief-focus">
          <p className="fl-daily-brief-label">{t('dailyBrief.focusLabel')}</p>
          <p className="fl-daily-brief-value">{categoryLabel(brief.focusCategory)}</p>
        </div>
      ) : null}

      {brief.recurringPattern ? (
        <div className="fl-daily-brief-pattern">
          <p className="fl-daily-brief-pattern-pair">
            {brief.recurringPattern.displayOriginal} → {brief.recurringPattern.displayCorrected}
          </p>
          <p className="fl-card-desc">
            {t('dailyBrief.seenCount', { count: String(brief.recurringPattern.count) })}
          </p>
        </div>
      ) : null}

      {improvement ? <p className="fl-card-desc">{improvement}</p> : null}

      {brief.targetProgression ? (
        <p className="fl-card-desc">
          {brief.targetProgression.state === 'stable'
            ? t('dailyBrief.progressionStable', {
                corrected: brief.targetProgression.displayCorrected,
              })
            : t('dailyBrief.progressionImproving', {
                corrected: brief.targetProgression.displayCorrected,
              })}
        </p>
      ) : null}

      {brief.limitReached ? (
        <p className="fl-card-desc fl-daily-brief-limit">{t('dailyBrief.limitReached')}</p>
      ) : null}

      <div className="fl-daily-brief-actions">
        {brief.recommendedAction.kind === 'keep_writing' ? (
          <p className="fl-card-desc">{actionLabel(brief)}</p>
        ) : (
          <button
            type="button"
            className="fl-action-btn"
            onClick={() => {
              if (brief.recommendedAction.kind === 'practice_pattern') {
                onOpenPractice(brief.recommendedAction.targetPatternId)
                return
              }
              if (brief.recommendedAction.kind === 'practice_focus') {
                onOpenPractice()
                return
              }
              if (brief.recommendedAction.kind === 'view_progress') {
                onOpenProgress()
              }
            }}
          >
            {actionLabel(brief)}
          </button>
        )}
        <button type="button" className="fl-link-btn" onClick={onOpenProgress}>
          {t('dailyBrief.viewProgress')}
        </button>
      </div>
    </section>
  )
}
