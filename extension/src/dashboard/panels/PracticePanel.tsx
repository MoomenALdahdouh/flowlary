import { useCallback, useEffect, useRef, useState } from 'react'
import {
  PRACTICE_ITEMS_PER_SESSION,
  PRACTICE_SESSION_VERSION,
  countWords,
  practiceTargetPatternId,
  type CorrectionResponse,
  type LearningEventCategory,
  type PracticeFocus,
  type PracticeRecommendation,
  type PracticeSessionRecord,
  type PracticeTargetPattern,
  type TargetPracticeProgression,
} from '@flowlary/shared'
import { buildPracticeExercise } from '../../storage/learning/practice/prompts.ts'
import { selectPracticeSessionTarget, resolvePracticeSessionTargetById, type PracticeSessionTarget } from '../../storage/learning/practice/targetSelection.ts'
import { createPracticeSessionId } from '../../storage/learning/practice/sessions.ts'
import {
  recordPracticeAccepted,
  recordPracticeDetected,
  recordPracticeRejected,
} from '../../features/learning/recordCorrectionLearning.ts'
import {
  fetchPracticeHome,
  requestPracticeCorrection,
  savePracticeSession,
} from '../../popup/api.ts'
import { t } from '../../popup/i18n/index.ts'
import { ConfirmDialog } from '../../ui/shared.tsx'
import { getUpgradeUrl } from '../../config/upgrade.ts'
import type { ExtensionStatus } from '../../messaging/types.ts'
import {
  canRecordPracticeAction,
  canStartPracticeCheckAction,
  isActivePracticeCheck,
  practiceCorrectionErrorKey,
  resolvePracticeCheckAvailability,
  type PracticeCheckKey,
} from './practiceAvailability.ts'
import { CorrectionHighlight } from '../components/CorrectionHighlight.tsx'

type PracticePanelProps = {
  status?: ExtensionStatus | null
  onOpenOverview: () => void
  onOpenProgress?: () => void
  /** Trial/Pro plan tier — used for upgrade messaging only. */
  fullAccess?: boolean
  /** Deep-link target from dashboard hash (#practice?target=category:token). */
  initialTargetPatternId?: string
}

type View = 'home' | 'focus' | 'session' | 'complete'

type SessionMetrics = {
  itemsAttempted: number
  itemsCompleted: number
  correctionsDetected: number
  correctionsAccepted: number
  correctionsRejected: number
  wordsWritten: number
  patternsReviewed: number
}

function categoryLabel(category: LearningEventCategory): string {
  return t(`learning.focus.${category}` as 'learning.focus.spelling')
}

function progressionForPattern(
  progressions: TargetPracticeProgression[],
  pattern: PracticeTargetPattern | undefined,
): TargetPracticeProgression | null {
  if (!pattern) return null
  const targetId = practiceTargetPatternId(pattern)
  return progressions.find((item) => item.targetPatternId === targetId) ?? null
}

function progressionMessage(progression: TargetPracticeProgression): string {
  if (progression.evidenceQuality === 'insufficient' && progression.state !== 'needs_attention') {
    return t('practice.progression.insufficient')
  }
  const key = `practice.progression.${progression.state}` as
    | 'practice.progression.improving'
    | 'practice.progression.stable'
    | 'practice.progression.practicing'
    | 'practice.progression.needs_attention'
    | 'practice.progression.new'
    | 'practice.progression.insufficient'
  return t(key)
}

function applyCorrectedText(text: string, response: CorrectionResponse): string {
  let next = text
  for (const change of response.changes) {
    const idx = next.indexOf(change.original)
    if (idx !== -1) {
      next = next.slice(0, idx) + change.corrected + next.slice(idx + change.original.length)
    }
  }
  return next
}

function correctionErrorMessage(error: string): string {
  switch (practiceCorrectionErrorKey(error)) {
    case 'consent_required':
      return t('practice.consentRequired')
    case 'usage_exhausted':
      return t('practice.correctionUsageExhausted')
    case 'account_changed':
      return t('practice.correctionAccountChanged')
    case 'rate_limited':
      return t('practice.correctionRateLimited')
    case 'network':
      return t('practice.correctionNetwork')
    default:
      return t('practice.correctionError')
  }
}

export function PracticePanel({
  status = null,
  onOpenOverview,
  onOpenProgress,
  fullAccess = true,
  initialTargetPatternId,
}: PracticePanelProps) {
  const availability = resolvePracticeCheckAvailability(status)

  const [view, setView] = useState<View>('home')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recommendation, setRecommendation] = useState<PracticeRecommendation | null>(null)
  const [recurringTargets, setRecurringTargets] = useState<PracticeTargetPattern[]>([])
  const [targetProgressions, setTargetProgressions] = useState<TargetPracticeProgression[]>([])
  const [sessionProgression, setSessionProgression] = useState<TargetPracticeProgression | null>(null)

  const [focusChoice, setFocusChoice] = useState<PracticeFocus>('recommended')
  const [sessionId, setSessionId] = useState('')
  const [startedAt, setStartedAt] = useState(0)
  const [focus, setFocus] = useState<LearningEventCategory>('grammar')
  const [targetPattern, setTargetPattern] = useState<PracticeTargetPattern | undefined>()
  const [sessionTargeted, setSessionTargeted] = useState(false)
  const [itemIndex, setItemIndex] = useState(0)
  const [prompt, setPrompt] = useState('')
  const [userText, setUserText] = useState('')
  const [checking, setChecking] = useState(false)
  const [correction, setCorrection] = useState<CorrectionResponse | null>(null)
  const [correctionError, setCorrectionError] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<SessionMetrics>({
    itemsAttempted: 0,
    itemsCompleted: 0,
    correctionsDetected: 0,
    correctionsAccepted: 0,
    correctionsRejected: 0,
    wordsWritten: 0,
    patternsReviewed: 0,
  })
  const [exitOpen, setExitOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const detectedRecordedRef = useRef(false)
  const actionRecordedRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const checkingHeldRef = useRef(false)
  const activeCheckRef = useRef<PracticeCheckKey | null>(null)
  const finishingRef = useRef(false)
  const deepLinkConsumedRef = useRef(false)

  const loadHome = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const home = await fetchPracticeHome()
      setRecommendation(home.recommendation)
      setRecurringTargets(home.recurringTargets ?? [])
      setTargetProgressions(home.targetProgressions ?? [])
    } catch {
      setError(t('practice.loadError'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (view === 'home') void loadHome()
  }, [view, loadHome])

  function rollbackAttemptMetrics(trimmed: string) {
    const wordDelta = countWords(trimmed)
    setMetrics((current) => ({
      ...current,
      itemsAttempted: Math.max(0, current.itemsAttempted - 1),
      wordsWritten: Math.max(0, current.wordsWritten - wordDelta),
    }))
  }

  function resetItemState(nextPrompt: string) {
    setPrompt(nextPrompt)
    setUserText('')
    setCorrection(null)
    setCorrectionError(null)
    detectedRecordedRef.current = false
    actionRecordedRef.current = false
    activeCheckRef.current = null
    abortRef.current?.abort()
    abortRef.current = null
  }

  function beginSessionWithTarget(sessionTarget: PracticeSessionTarget, choice: PracticeFocus) {
    const id = createPracticeSessionId()
    const now = Date.now()
    finishingRef.current = false
    setSessionProgression(null)
    setSessionId(id)
    setStartedAt(now)
    setFocusChoice(choice)
    setFocus(sessionTarget.focus)
    setTargetPattern(sessionTarget.pattern)
    setSessionTargeted(sessionTarget.targeted)
    setItemIndex(0)
    setMetrics({
      itemsAttempted: 0,
      itemsCompleted: 0,
      correctionsDetected: 0,
      correctionsAccepted: 0,
      correctionsRejected: 0,
      wordsWritten: 0,
      patternsReviewed: sessionTarget.targeted ? 1 : 0,
    })
    resetItemState(
      buildPracticeExercise(sessionTarget.focus, sessionTarget.pattern, 0, sessionTarget.targeted).prompt,
    )
    setView('session')
  }

  function beginSession(choice: PracticeFocus) {
    if (!recommendation || !availability.canStartSession) return
    const sessionTarget = selectPracticeSessionTarget(choice, recommendation, recurringTargets)
    beginSessionWithTarget(sessionTarget, choice)
  }

  useEffect(() => {
    if (
      deepLinkConsumedRef.current ||
      !initialTargetPatternId?.trim() ||
      view !== 'home' ||
      loading ||
      !recommendation ||
      !availability.canStartSession
    ) {
      return
    }
    const sessionTarget = resolvePracticeSessionTargetById(initialTargetPatternId, recurringTargets)
    if (!sessionTarget) return
    deepLinkConsumedRef.current = true
    beginSessionWithTarget(sessionTarget, sessionTarget.focus)
  }, [
    initialTargetPatternId,
    view,
    loading,
    recommendation,
    recurringTargets,
    availability.canStartSession,
  ])

  function batchIdForItem(index: number): string {
    return `practice-${sessionId}-${index}`
  }

  async function finishSession(finalMetrics: SessionMetrics) {
    if (finishingRef.current) return
    finishingRef.current = true
    setSaving(true)
    const record: PracticeSessionRecord = {
      id: sessionId,
      version: PRACTICE_SESSION_VERSION,
      startedAt,
      completedAt: Date.now(),
      focus: focusChoice,
      targetPattern,
      itemsAttempted: finalMetrics.itemsAttempted,
      itemsCompleted: finalMetrics.itemsCompleted,
      correctionsDetected: finalMetrics.correctionsDetected,
      correctionsAccepted: finalMetrics.correctionsAccepted,
      correctionsRejected: finalMetrics.correctionsRejected,
      wordsWritten: finalMetrics.wordsWritten,
      status: 'completed',
    }
    try {
      await savePracticeSession(record)
      if (sessionTargeted && targetPattern) {
        try {
          const home = await fetchPracticeHome()
          const targetId = practiceTargetPatternId(targetPattern)
          setSessionProgression(
            home.targetProgressions?.find((item) => item.targetPatternId === targetId) ?? null,
          )
        } catch {
          setSessionProgression(null)
        }
      } else {
        setSessionProgression(null)
      }
    } catch {
      /* session metrics already recorded as learning events */
    } finally {
      setSaving(false)
      setMetrics(finalMetrics)
      setView('complete')
    }
  }

  function advanceItem(finalMetrics: SessionMetrics, nextIndex: number) {
    if (nextIndex >= PRACTICE_ITEMS_PER_SESSION) {
      void finishSession(finalMetrics)
      return
    }
    setItemIndex(nextIndex)
    resetItemState(buildPracticeExercise(focus, targetPattern, nextIndex, sessionTargeted).prompt)
    setMetrics(finalMetrics)
  }

  async function checkWriting() {
    const trimmed = userText.trim()
    if (!canStartPracticeCheckAction(checking, checkingHeldRef.current, Boolean(trimmed))) return
    if (!availability.canCheckWriting) {
      setCorrectionError(
        availability.blockReason === 'usage_exhausted'
          ? t('practice.correctionUsageExhausted')
          : t('practice.aiCreditsUnavailable'),
      )
      return
    }

    checkingHeldRef.current = true
    setChecking(true)
    setCorrectionError(null)

    const checkKey: PracticeCheckKey = { sessionId, itemIndex }
    activeCheckRef.current = checkKey
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const nextMetrics = {
      ...metrics,
      itemsAttempted: metrics.itemsAttempted + 1,
      wordsWritten: metrics.wordsWritten + countWords(trimmed),
    }
    setMetrics(nextMetrics)

    try {
      const result = await requestPracticeCorrection(trimmed, controller.signal)
      if (
        !isActivePracticeCheck(checkKey, activeCheckRef.current, controller.signal.aborted)
      ) {
        return
      }

      if (result.ok === false) {
        if (result.aborted) {
          rollbackAttemptMetrics(trimmed)
          return
        }
        rollbackAttemptMetrics(trimmed)
        setCorrectionError(correctionErrorMessage(result.error))
        return
      }

      const response = result.data
      if (response.changes.length === 0) {
        advanceItem(
          { ...nextMetrics, itemsCompleted: nextMetrics.itemsCompleted + 1 },
          itemIndex + 1,
        )
        return
      }

      if (!detectedRecordedRef.current) {
        recordPracticeDetected(batchIdForItem(itemIndex), trimmed, response)
        detectedRecordedRef.current = true
        setMetrics((current) => ({
          ...current,
          correctionsDetected: current.correctionsDetected + response.changes.length,
        }))
      }
      setCorrection(response)
    } catch {
      if (isActivePracticeCheck(checkKey, activeCheckRef.current, controller.signal.aborted)) {
        rollbackAttemptMetrics(trimmed)
        setCorrectionError(t('practice.correctionError'))
      }
    } finally {
      checkingHeldRef.current = false
      setChecking(false)
    }
  }

  function handleAccept() {
    if (!canRecordPracticeAction(actionRecordedRef.current, Boolean(correction))) return
    actionRecordedRef.current = true
    const trimmed = userText.trim()
    recordPracticeAccepted(batchIdForItem(itemIndex), trimmed, correction!)
    const nextText = applyCorrectedText(trimmed, correction!)
    const finalMetrics = {
      ...metrics,
      itemsCompleted: metrics.itemsCompleted + 1,
      correctionsAccepted: metrics.correctionsAccepted + correction!.changes.length,
    }
    setUserText(nextText)
    setCorrection(null)
    advanceItem(finalMetrics, itemIndex + 1)
  }

  function handleReject() {
    if (!canRecordPracticeAction(actionRecordedRef.current, Boolean(correction))) return
    actionRecordedRef.current = true
    recordPracticeRejected(batchIdForItem(itemIndex), userText.trim(), correction!)
    const finalMetrics = {
      ...metrics,
      itemsCompleted: metrics.itemsCompleted + 1,
      correctionsRejected: metrics.correctionsRejected + correction!.changes.length,
    }
    setCorrection(null)
    advanceItem(finalMetrics, itemIndex + 1)
  }

  function availabilityNotice(): string | null {
    if (availability.blockReason === 'usage_exhausted') {
      return t('practice.aiCreditsUnavailable')
    }
    if (availability.blockReason === 'consent_required') {
      return t('practice.consentRequired')
    }
    if (availability.blockReason === 'account_required' || availability.blockReason === 'signed_out') {
      return t('connection.authRequired')
    }
    if (availability.canStartSession) {
      return t('practice.creditNotice', { credits: String(availability.creditsRemaining) })
    }
    return null
  }

  const notice = availabilityNotice()
  const canStart = availability.canStartSession

  if (loading && view === 'home') {
    return <p className="fl-loading" role="status">{t('practice.loading')}</p>
  }

  if (error && view === 'home') {
    return (
      <div className="fl-dash-card fl-practice" role="alert">
        <p className="fl-error">{error}</p>
        <div className="fl-practice-actions">
          <button type="button" className="fl-action-btn" onClick={() => void loadHome()}>
            {t('errors.retry')}
          </button>
        </div>
      </div>
    )
  }

  if (view === 'home' && !loading && !recommendation) {
    return (
      <div className="fl-dash-card fl-practice">
        <div className="fl-empty-state" role="status">
          <h3 className="fl-empty-title">{t('practice.emptyTitle')}</h3>
          <p className="fl-empty-desc">{t('practice.emptyBody')}</p>
        </div>
        <div className="fl-practice-actions">
          <button type="button" className="fl-action-btn" onClick={() => void loadHome()}>
            {t('errors.retry')}
          </button>
          <button type="button" className="fl-link-btn" onClick={onOpenOverview}>
            {t('practice.backOverview')}
          </button>
        </div>
      </div>
    )
  }

  if (view === 'home' && recommendation) {
    return (
      <div className="fl-practice-page">
        {!fullAccess ? (
          <div className="fl-dash-card fl-upgrade-teaser" role="status">
            <h3 className="fl-section-label">{t('practice.fullProTitle')}</h3>
            <p className="fl-card-desc">{t('practice.fullProBody')}</p>
            <a className="fl-action-btn fl-action-btn-primary" href={getUpgradeUrl()} target="_blank" rel="noreferrer">
              {t('practice.upgradeForMoreCredits')}
            </a>
          </div>
        ) : null}
        {notice ? (
          <div className="fl-dash-card fl-practice" role="status">
            <p className="fl-card-desc">{notice}</p>
          </div>
        ) : null}
        {recommendation.state === 'none' ? (
          <div className="fl-dash-card fl-practice">
            <div className="fl-empty-state" role="status">
              <h3 className="fl-empty-title">{t('practice.emptyTitle')}</h3>
              <p className="fl-empty-desc">{t('practice.emptyBody')}</p>
            </div>
            <div className="fl-practice-actions">
              <button type="button" className="fl-action-btn" onClick={onOpenOverview}>
                {t('practice.backOverview')}
              </button>
              {onOpenProgress ? (
                <button type="button" className="fl-link-btn" onClick={onOpenProgress}>
                  {t('practice.viewProgress')}
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="fl-dash-card fl-practice">
            {recommendation.state === 'emerging' ? (
              <div className="fl-empty-state" role="status">
                <h3 className="fl-empty-title">{t('practice.emergingTitle')}</h3>
                <p className="fl-empty-desc">{t('practice.emergingBody')}</p>
              </div>
            ) : (
              <section aria-labelledby="practice-recommended-heading">
                <h3 id="practice-recommended-heading" className="fl-section-label">
                  {t('practice.recommendedTitle')}
                </h3>
                {recommendation.pattern ? (
                  <>
                    <p className="fl-practice-recommendation">
                      <strong>{categoryLabel(recommendation.pattern.category)}</strong>
                      <span>
                        {t('practice.recommendedPattern', {
                          original: recommendation.pattern.displayOriginal,
                          corrected: recommendation.pattern.displayCorrected,
                        })}
                      </span>
                    </p>
                    {(() => {
                      const progression = progressionForPattern(
                        targetProgressions,
                        recommendation.pattern,
                      )
                      if (!progression || progression.practiceAttempts === 0) return null
                      return (
                        <p className="fl-card-desc fl-practice-progression-hint">
                          {progressionMessage(progression)}
                        </p>
                      )
                    })()}
                  </>
                ) : recommendation.focus ? (
                  <p className="fl-practice-recommendation">
                    <strong>{categoryLabel(recommendation.focus)}</strong>
                    <span>
                      {t('practice.recommendedCategory', {
                        category: categoryLabel(recommendation.focus),
                      })}
                    </span>
                  </p>
                ) : null}
              </section>
            )}

            <div className="fl-practice-actions">
              {recommendation.state === 'ready' ? (
                <button
                  type="button"
                  className="fl-action-btn"
                  disabled={!canStart}
                  onClick={() => beginSession('recommended')}
                >
                  {t('practice.practiceThis')}
                </button>
              ) : null}
              <button
                type="button"
                className="fl-link-btn"
                disabled={!canStart}
                onClick={() => setView('focus')}
              >
                {t('practice.chooseFocus')}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (view === 'focus') {
    const choices: { id: PracticeFocus; label: string; desc: string }[] = [
      {
        id: 'recommended',
        label: t('practice.focusRecommended'),
        desc: t('practice.focusRecommendedDesc'),
      },
      {
        id: 'spelling',
        label: categoryLabel('spelling'),
        desc: t('practice.focusSpellingDesc'),
      },
      {
        id: 'grammar',
        label: categoryLabel('grammar'),
        desc: t('practice.focusGrammarDesc'),
      },
      {
        id: 'wording',
        label: categoryLabel('wording'),
        desc: t('practice.focusWordingDesc'),
      },
    ]

    return (
      <div className="fl-practice-page">
        <div className="fl-dash-card fl-practice">
          <h3 className="fl-section-label">{t('practice.focusTitle')}</h3>
          {notice ? <p className="fl-card-desc">{notice}</p> : null}
          <ul className="fl-practice-focus-list" role="list">
            {choices.map((choice) => (
              <li key={choice.id}>
                <button
                  type="button"
                  className={`fl-practice-focus-btn${focusChoice === choice.id ? ' is-selected' : ''}`}
                  aria-pressed={focusChoice === choice.id}
                  onClick={() => setFocusChoice(choice.id)}
                >
                  <span className="fl-practice-focus-label">{choice.label}</span>
                  <span className="fl-practice-focus-desc">{choice.desc}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="fl-practice-actions">
            <button
              type="button"
              className="fl-action-btn"
              disabled={!recommendation || !canStart}
              onClick={() => beginSession(focusChoice)}
            >
              {t('practice.startSession')}
            </button>
            <button type="button" className="fl-link-btn" onClick={() => setView('home')}>
              {t('practice.backOverview')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (view === 'complete') {
    return (
      <div className="fl-practice-page">
        <div className="fl-dash-card fl-practice fl-practice-complete">
          <h3 className="fl-empty-title">{t('practice.completeTitle')}</h3>
          <ul className="fl-practice-summary-list" role="list">
            <li>{t('practice.completeFocus', { category: categoryLabel(focus) })}</li>
            <li>{t('practice.completeWords', { count: String(metrics.wordsWritten) })}</li>
            <li>
              {t('practice.completePatterns', {
                count: String(metrics.patternsReviewed),
              })}
            </li>
            <li>
              {t('practice.completeAccepted', {
                count: String(metrics.correctionsAccepted),
              })}
            </li>
          </ul>
          {sessionProgression && sessionProgression.practiceAttempts > 0 ? (
            <>
              <p className="fl-card-desc">{progressionMessage(sessionProgression)}</p>
              {sessionProgression.cleanAttempts > 0 ? (
                <p className="fl-card-desc">
                  {t('practice.progression.cleanAttempts', {
                    count: String(sessionProgression.cleanAttempts),
                  })}
                </p>
              ) : null}
            </>
          ) : null}
          <p className="fl-card-desc">{t('practice.completeReinforce')}</p>
          <div className="fl-practice-actions">
            {onOpenProgress ? (
              <button type="button" className="fl-action-btn" onClick={onOpenProgress}>
                {t('practice.completeViewProgress')}
              </button>
            ) : null}
            <button
              type="button"
              className="fl-link-btn"
              disabled={saving}
              onClick={() => {
                setView('home')
                void loadHome()
              }}
            >
              {t('practice.practiceAgain')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fl-practice-page">
      <div className="fl-dash-card fl-practice fl-practice-session">
        <div className="fl-practice-session-head">
          <p className="fl-practice-session-meta" aria-live="polite">
            {t('practice.sessionProgress', {
              current: String(itemIndex + 1),
              total: String(PRACTICE_ITEMS_PER_SESSION),
            })}
          </p>
          <button type="button" className="fl-link-btn" onClick={() => setExitOpen(true)}>
            {t('practice.exitSession')}
          </button>
        </div>

        <p className="fl-practice-prompt">
          <span className="fl-section-label">{t('practice.promptLabel')}</span>
          {prompt}
        </p>

        {sessionTargeted && targetPattern ? (
          <p className="fl-card-desc" role="status">
            {t('practice.targetedEvidence', {
              category: categoryLabel(targetPattern.category),
              count: String(targetPattern.count),
            })}
          </p>
        ) : null}

        <label className="fl-practice-write-label" htmlFor="fl-practice-textarea">
          {t('practice.writeLabel')}
        </label>
        <textarea
          id="fl-practice-textarea"
          className="fl-practice-textarea"
          value={userText}
          rows={6}
          disabled={Boolean(correction) || checking}
          onChange={(event) => setUserText(event.target.value)}
        />
        <p className="fl-practice-word-count" aria-live="polite">
          {t('practice.wordCount', { count: String(countWords(userText)) })}
        </p>

        {correctionError ? (
          <p className="fl-error" role="alert">
            {correctionError}
          </p>
        ) : null}

        {correction && correction.changes.length > 0 ? (
          <section className="fl-practice-feedback" aria-live="polite">
            <h4 className="fl-section-label">{t('practice.correctionsFound')}</h4>
            <CorrectionHighlight
              original={correction.originalText}
              corrected={correction.correctedText}
              changes={correction.changes}
              className="fl-practice-highlight"
            />
            <ul className="fl-practice-change-list">
              {correction.changes.map((change, index) => (
                <li key={`${change.original}-${index}`} className={`fl-practice-change fl-teach-${change.type}`}>
                  <span className={`fl-teach-badge fl-teach-${change.type}`}>
                    {categoryLabel(change.type)}
                  </span>
                  <span className="fl-progress-pattern-pair">
                    <del>{change.original || '∅'}</del>
                    <ins>{change.corrected || '∅'}</ins>
                  </span>
                </li>
              ))}
            </ul>
            <div className="fl-practice-actions">
              <button type="button" className="fl-action-btn" onClick={handleAccept}>
                {t('practice.acceptAll')}
              </button>
              <button type="button" className="fl-link-btn" onClick={handleReject}>
                {t('practice.rejectAll')}
              </button>
            </div>
          </section>
        ) : (
          <div className="fl-practice-actions">
            <button
              type="button"
              className="fl-action-btn"
              disabled={checking || !userText.trim() || !availability.canCheckWriting}
              onClick={() => void checkWriting()}
            >
              {checking ? t('practice.checking') : t('practice.checkWriting')}
            </button>
          </div>
        )}

        <ConfirmDialog
          open={exitOpen}
          title={t('practice.exitConfirmTitle')}
          description={t('practice.exitConfirmDesc')}
          confirmLabel={t('practice.exitConfirmAction')}
          onCancel={() => setExitOpen(false)}
          onConfirm={() => {
            setExitOpen(false)
            abortRef.current?.abort()
            activeCheckRef.current = null
            setView('home')
          }}
        />
      </div>
    </div>
  )
}
