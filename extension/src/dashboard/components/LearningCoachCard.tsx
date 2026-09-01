import { useCallback, useState } from 'react'
import type { LearningCoachAction, LearningCoachMode, LearningCoachResult } from '@flowlary/shared'
import { t } from '../../popup/i18n/index.ts'
import { flowlaryStorage } from '../../storage/index.ts'
import { resolveLearningCoach } from '../../storage/learning/coach/resolveLearningCoach.ts'
import { AiErrorRecovery } from '../../ui/AiErrorRecovery.tsx'

const COACH_LOAD_TIMEOUT_MS = 20_000

async function loadLearningCoach(
  mode: LearningCoachMode,
  question?: string,
): Promise<LearningCoachResult> {
  return Promise.race([
    resolveLearningCoach(flowlaryStorage, mode, question ?? null),
    new Promise<LearningCoachResult>((_, reject) => {
      window.setTimeout(() => reject(new Error('coach_timeout')), COACH_LOAD_TIMEOUT_MS)
    }),
  ])
}

type LearningCoachCardProps = {
  signedIn: boolean
  onOpenPractice: (targetPatternId?: string) => void
  onOpenProgress: () => void
  onOpenReport: () => void
  onOpenAccount: () => void
}

const PRESET_MODES: { id: LearningCoachMode; labelKey: string }[] = [
  { id: 'focus', labelKey: 'learningCoach.promptFocus' },
  { id: 'recurring_error', labelKey: 'learningCoach.promptRecurring' },
  { id: 'improving', labelKey: 'learningCoach.promptImproving' },
  { id: 'practice_help', labelKey: 'learningCoach.promptPractice' },
]

function actionLabel(action: LearningCoachAction): string {
  switch (action.kind) {
    case 'practice_pattern':
      return t('learningCoach.actionPractice')
    case 'practice_focus':
      return t('learningCoach.actionPracticeFocus')
    case 'view_progress':
      return t('learningCoach.actionProgress')
    case 'open_report':
      return t('learningCoach.actionReport')
    default:
      return t('learningCoach.actionKeepWriting')
  }
}

export function LearningCoachCard({
  signedIn,
  onOpenPractice,
  onOpenProgress,
  onOpenReport,
  onOpenAccount,
}: LearningCoachCardProps) {
  const [result, setResult] = useState<LearningCoachResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [question, setQuestion] = useState('')
  const [lastRequest, setLastRequest] = useState<{ mode: LearningCoachMode; question?: string } | null>(
    null,
  )

  const runCoach = useCallback(async (mode: LearningCoachMode, customQuestion?: string) => {
    setLoading(true)
    setError(false)
    setLastRequest({ mode, question: customQuestion })
    try {
      const data = await loadLearningCoach(mode, customQuestion)
      setResult(data)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  function handleAction(action: LearningCoachAction) {
    switch (action.kind) {
      case 'practice_pattern':
        onOpenPractice(action.targetPatternId)
        break
      case 'practice_focus':
        onOpenPractice()
        break
      case 'view_progress':
        onOpenProgress()
        break
      case 'open_report':
        onOpenReport()
        break
      default:
        break
    }
  }

  if (!signedIn) {
    return (
      <section className="fl-dash-card fl-learning-coach" aria-labelledby="learning-coach-heading">
        <h3 id="learning-coach-heading" className="fl-section-label">
          {t('learningCoach.title')}
        </h3>
        <p className="fl-card-desc">{t('learningCoach.signIn')}</p>
        <button type="button" className="fl-link-btn" onClick={onOpenAccount}>
          {t('account.signIn')}
        </button>
      </section>
    )
  }

  return (
    <section className="fl-dash-card fl-learning-coach" aria-labelledby="learning-coach-heading">
      <h3 id="learning-coach-heading" className="fl-section-label">
        {t('learningCoach.title')}
      </h3>
      <p className="fl-card-desc">{t('learningCoach.lead')}</p>

      <div className="fl-learning-coach-prompts" role="group" aria-label={t('learningCoach.promptsAria')}>
        {PRESET_MODES.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="fl-learning-coach-prompt-btn"
            disabled={loading}
            onClick={() => void runCoach(preset.id)}
          >
            {t(preset.labelKey as 'learningCoach.promptFocus')}
          </button>
        ))}
      </div>

      <form
        className="fl-learning-coach-ask"
        onSubmit={(event) => {
          event.preventDefault()
          const trimmed = question.trim()
          if (!trimmed || loading) return
          void runCoach('custom', trimmed)
        }}
      >
        <label className="visually-hidden" htmlFor="learning-coach-question">
          {t('learningCoach.questionLabel')}
        </label>
        <input
          id="learning-coach-question"
          type="text"
          className="fl-learning-coach-input"
          value={question}
          placeholder={t('learningCoach.questionPlaceholder')}
          maxLength={500}
          disabled={loading}
          onChange={(event) => setQuestion(event.target.value)}
        />
        <button type="submit" className="fl-action-btn" disabled={loading || !question.trim()}>
          {loading ? t('learningCoach.asking') : t('learningCoach.ask')}
        </button>
      </form>

      {error ? (
        <div className="fl-error" role="alert">
          <p>{t('learningCoach.unavailable')}</p>
          <AiErrorRecovery
            onRetry={
              lastRequest
                ? () => void runCoach(lastRequest.mode, lastRequest.question)
                : undefined
            }
          />
        </div>
      ) : null}

      {result ? (
        <div className="fl-learning-coach-response" aria-live="polite">
          <p className="fl-learning-coach-summary">{result.response.summary}</p>

          {result.response.observations.length > 0 ? (
            <ul className="fl-learning-coach-list" role="list">
              {result.response.observations.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}

          {result.response.explanations.length > 0 ? (
            <div className="fl-learning-coach-explanations">
              <p className="fl-daily-brief-label">{t('learningCoach.explanationsTitle')}</p>
              <ul className="fl-learning-coach-list" role="list">
                {result.response.explanations.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.response.recommendations.length > 0 ? (
            <div className="fl-learning-coach-recommendations">
              <p className="fl-daily-brief-label">{t('learningCoach.recommendationsTitle')}</p>
              <ul className="fl-learning-coach-list" role="list">
                {result.response.recommendations.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.response.actions.length > 0 ? (
            <div className="fl-learning-coach-actions">
              {result.response.actions.map((action, index) => (
                <button
                  key={`${action.kind}-${action.targetPatternId ?? action.focus ?? index}`}
                  type="button"
                  className="fl-action-btn"
                  onClick={() => handleAction(action)}
                >
                  {actionLabel(action)}
                </button>
              ))}
            </div>
          ) : null}

          <p className="fl-card-desc fl-learning-coach-meta">
            {result.aiUsed
              ? t('learningCoach.aiEnhanced')
              : result.aiAvailable
                ? result.limitReached
                  ? t('learningCoach.limitReached')
                  : t('learningCoach.deterministicNote')
                : t('learningCoach.proHint')}
            {result.fromCache ? ` ${t('learningCoach.fromCache')}` : ''}
          </p>
        </div>
      ) : null}
    </section>
  )
}
