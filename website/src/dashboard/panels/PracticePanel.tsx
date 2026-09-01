import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  PRACTICE_ITEMS_PER_SESSION,
  PRACTICE_SESSION_VERSION,
  countWords,
  practiceTargetPatternId,
  type CorrectionResponse,
  type LearningEventCategory,
  type PracticeFocus,
  type PracticeSessionRecord,
  type PracticeTargetPattern,
} from '@flowlary/shared'
import { buildPracticeExercise } from '../learning/practice/prompts.ts'
import { resolvePracticeSessionTargetById } from '../learning/practice/targetSelection.ts'
import { createPracticeSessionId } from '../learning/practice/sessions.ts'
import { syncPracticeLearningEvent } from '../services/webPracticeLearning.ts'
import { requestWebCorrection } from '../../account/aiClient.ts'
import { Button } from '../../components/Ui.tsx'
import type { DashboardCopy } from '../types.ts'
import {
  computeWebPracticeHome,
  saveWebPracticeSession,
  type WebLearningBundle,
} from '../services/learningData.ts'

type PracticePanelProps = {
  bundle: WebLearningBundle
  accountId: string
  copy: DashboardCopy
  initialTargetPatternId?: string
  onRefresh: () => void
}

type View = 'home' | 'session' | 'complete'

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

export function PracticePanel({
  bundle,
  accountId,
  copy,
  initialTargetPatternId,
  onRefresh,
}: PracticePanelProps) {
  const home = useMemo(() => computeWebPracticeHome(bundle), [bundle])
  const [view, setView] = useState<View>('home')
  const [focus, setFocus] = useState<PracticeFocus>('recommended')
  const [target, setTarget] = useState<PracticeTargetPattern | undefined>()
  const [itemIndex, setItemIndex] = useState(0)
  const [draft, setDraft] = useState('')
  const [correction, setCorrection] = useState<CorrectionResponse | null>(null)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [practiceBatchId] = useState(() => createPracticeSessionId())
  const [metrics, setMetrics] = useState({
    itemsAttempted: 0,
    itemsCompleted: 0,
    correctionsDetected: 0,
    correctionsAccepted: 0,
    correctionsRejected: 0,
    wordsWritten: 0,
    patternsReviewed: 0,
  })

  const startSession = useCallback(
    (nextFocus: PracticeFocus, pattern?: PracticeTargetPattern) => {
      setFocus(nextFocus)
      setTarget(pattern)
      setItemIndex(0)
      setDraft('')
      setCorrection(null)
      setError(null)
      setMetrics({
        itemsAttempted: 0,
        itemsCompleted: 0,
        correctionsDetected: 0,
        correctionsAccepted: 0,
        correctionsRejected: 0,
        wordsWritten: 0,
        patternsReviewed: pattern ? 1 : 0,
      })
      setView('session')
    },
    [],
  )

  useEffect(() => {
    if (!initialTargetPatternId) return
    const home = computeWebPracticeHome(bundle)
    const resolved = resolvePracticeSessionTargetById(initialTargetPatternId, home.recurringTargets)
    if (resolved) {
      startSession(resolved.focus, resolved.pattern)
    }
  }, [initialTargetPatternId, bundle, startSession])

  const exercise = useMemo(() => {
    const category =
      focus === 'recommended'
        ? (target?.category ?? home.recommendation.focus ?? 'grammar')
        : focus
    return buildPracticeExercise(category, target, itemIndex, Boolean(target))
  }, [focus, target, itemIndex, home.recommendation.focus])

  async function onCheck() {
    if (!draft.trim()) return
    setChecking(true)
    setError(null)
    const result = await requestWebCorrection(draft, undefined, { mode: 'practice' })
    setChecking(false)
    if (!result.ok) {
      setError(result.code === 'credits' ? copy.practice.creditsExhausted : copy.common.error)
      return
    }
    setCorrection(result.data)
    void syncPracticeLearningEvent(practiceBatchId, draft, result.data, 'detected').then(() => onRefresh())
    setMetrics((prev) => ({
      ...prev,
      itemsAttempted: prev.itemsAttempted + 1,
      correctionsDetected: prev.correctionsDetected + result.data.changes.length,
      wordsWritten: prev.wordsWritten + countWords(draft),
    }))
  }

  function onAccept() {
    if (!correction) return
    void syncPracticeLearningEvent(practiceBatchId, draft, correction, 'accepted')
    setMetrics((prev) => ({
      ...prev,
      itemsCompleted: prev.itemsCompleted + 1,
      correctionsAccepted: prev.correctionsAccepted + correction.changes.length,
    }))
    advance()
  }

  function onReject() {
    if (!correction) return
    void syncPracticeLearningEvent(practiceBatchId, draft, correction, 'rejected')
    setMetrics((prev) => ({
      ...prev,
      itemsCompleted: prev.itemsCompleted + 1,
      correctionsRejected: prev.correctionsRejected + correction.changes.length,
    }))
    advance()
  }

  function advance() {
    setDraft('')
    setCorrection(null)
    if (itemIndex + 1 >= PRACTICE_ITEMS_PER_SESSION) {
      const session: PracticeSessionRecord = {
        id: createPracticeSessionId(),
        version: PRACTICE_SESSION_VERSION,
        startedAt: Date.now(),
        completedAt: Date.now(),
        focus,
        targetPattern: target,
        ...metrics,
        itemsCompleted: metrics.itemsCompleted + 1,
        status: 'completed',
      }
      saveWebPracticeSession(accountId, session)
      onRefresh()
      setView('complete')
      return
    }
    setItemIndex((value) => value + 1)
  }

  if (view === 'complete') {
    return (
      <div className="wd-panel-stack">
        <article className="wd-card wd-empty">
          <h3>{copy.practice.sessionComplete}</h3>
          <Button type="button" onClick={() => setView('home')}>
            {copy.practice.home}
          </Button>
        </article>
      </div>
    )
  }

  if (view === 'session') {
    return (
      <div className="wd-panel-stack">
        <header className="wd-panel-head">
          <h2>{copy.practice.title}</h2>
          <p className="wd-muted">
            {copy.practice.itemOf
              .replace('{current}', String(itemIndex + 1))
              .replace('{total}', String(PRACTICE_ITEMS_PER_SESSION))}
          </p>
        </header>
        <article className="wd-card">
          <p>{exercise.prompt}</p>
          <textarea
            className="wd-textarea"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={5}
            disabled={checking || Boolean(correction)}
          />
          {error ? <p className="wd-error">{error}</p> : null}
          {!correction ? (
            <div className="wd-actions">
              <Button type="button" disabled={checking || !draft.trim()} onClick={() => void onCheck()}>
                {checking ? copy.practice.checking : copy.practice.check}
              </Button>
            </div>
          ) : (
            <>
              {correction.changes.length > 0 ? (
                <ul className="wd-list">
                  {correction.changes.map((change, idx) => (
                    <li key={`${change.original}-${idx}`}>
                      {change.original} → {change.corrected}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="wd-muted">{copy.practice.noIssues}</p>
              )}
              <div className="wd-actions">
                <Button type="button" variant="secondary" onClick={onAccept}>
                  {copy.practice.accept}
                </Button>
                <Button type="button" variant="ghost" onClick={onReject}>
                  {copy.practice.reject}
                </Button>
              </div>
            </>
          )}
        </article>
      </div>
    )
  }

  const recommendation = home.recommendation

  return (
    <div className="wd-panel-stack">
      <header className="wd-panel-head">
        <h2>{copy.practice.title}</h2>
        <p className="wd-lead">{copy.practice.lead}</p>
      </header>

      {recommendation.state === 'none' ? (
        <article className="wd-card wd-empty">
          <p>{copy.practice.none}</p>
          <Button to="/#writing-lab">{copy.overview.writingLab}</Button>
        </article>
      ) : recommendation.state === 'emerging' ? (
        <article className="wd-card">
          <p>{copy.practice.emerging}</p>
          <Button type="button" onClick={() => startSession('recommended')}>
            {copy.practice.startSession}
          </Button>
        </article>
      ) : (
        <article className="wd-card">
          <p>
            {recommendation.pattern
              ? `${recommendation.pattern.displayOriginal} → ${recommendation.pattern.displayCorrected}`
              : recommendation.focus}
          </p>
          <div className="wd-actions wd-actions-wrap">
            <Button
              type="button"
              onClick={() => startSession('recommended', recommendation.pattern)}
            >
              {copy.practice.focusRecommended}
            </Button>
            {(['spelling', 'grammar', 'wording'] as LearningEventCategory[]).map((category) => (
              <Button key={category} type="button" variant="secondary" onClick={() => startSession(category)}>
                {category === 'spelling'
                  ? copy.practice.focusSpelling
                  : category === 'grammar'
                    ? copy.practice.focusGrammar
                    : copy.practice.focusWording}
              </Button>
            ))}
          </div>
        </article>
      )}

      {home.recurringTargets.length > 0 ? (
        <article className="wd-card">
          <h3>{copy.progress.recurring}</h3>
          <ul className="wd-list">
            {home.recurringTargets.map((pattern) => (
              <li key={practiceTargetPatternId(pattern)}>
                <button
                  type="button"
                  className="wd-text-btn"
                  onClick={() => startSession(pattern.category, pattern)}
                >
                  {pattern.displayOriginal} → {pattern.displayCorrected} ({pattern.count}×)
                </button>
              </li>
            ))}
          </ul>
        </article>
      ) : null}
    </div>
  )
}
