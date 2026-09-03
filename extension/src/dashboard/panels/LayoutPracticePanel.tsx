import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  LAYOUT_PRACTICE_ITEMS_PER_SESSION,
  LAYOUT_PRACTICE_SESSION_VERSION,
  type LayoutPracticeExercise,
  type LayoutPracticeSessionRecord,
} from '@flowlary/shared'
import { defaultConverterPair } from '../../features/layout/layouts/convert.ts'
import { toUserLayoutProfile } from '../../features/layout/profile/index.ts'
import { t } from '../../popup/i18n/index.ts'
import type { ExtensionStatus } from '../../messaging/types.ts'
import { flowlaryStorage } from '../../storage/index.ts'
import {
  buildLayoutPracticeExercises,
  layoutPracticePairSupported,
  scoreLayoutPracticeAnswer,
  type LayoutConverterPair,
} from '../../storage/layoutPractice/exercises.ts'
import { layoutDisplayName } from '../../storage/layoutPractice/layoutNames.ts'
import {
  createLayoutPracticeSessionId,
  getLayoutPracticeSessionStore,
} from '../../storage/layoutPractice/sessions.ts'

type LayoutPracticePanelProps = {
  status?: ExtensionStatus | null
}

type View = 'home' | 'session' | 'complete'

type AttemptResult = 'idle' | 'correct' | 'incorrect'

export function LayoutPracticePanel({ status }: LayoutPracticePanelProps) {
  const accountSnapshotRef = useRef<string | null>(status?.account.accountId ?? null)
  const [view, setView] = useState<View>('home')
  const [pair, setPair] = useState<LayoutConverterPair | null>(null)
  const [exercises, setExercises] = useState<LayoutPracticeExercise[]>([])
  const [itemIndex, setItemIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [attempt, setAttempt] = useState<AttemptResult>('idle')
  const [correctCount, setCorrectCount] = useState(0)
  const [incorrectCount, setIncorrectCount] = useState(0)
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [unsupported, setUnsupported] = useState(false)

  useEffect(() => {
    accountSnapshotRef.current = status?.account.accountId ?? null
  }, [status?.account.accountId])

  const profilePair = useMemo(() => {
    if (!status) {
      return { sourceLayout: 'ar-101' as const, targetLayout: 'en-US-qwerty' as const }
    }
    const profile = toUserLayoutProfile(status.layout.sourceLayout, status.layout.targetLayouts)
    return defaultConverterPair(profile)
  }, [status])

  const supportedPair = useMemo(() => {
    if (layoutPracticePairSupported(profilePair)) return profilePair
    const fallbackPairs: LayoutConverterPair[] = [
      { sourceLayout: 'ar-101', targetLayout: 'en-US-qwerty' },
      { sourceLayout: 'en-US-qwerty', targetLayout: 'ar-101' },
      { sourceLayout: 'en-US-qwerty', targetLayout: 'ru-standard' },
      { sourceLayout: 'ru-standard', targetLayout: 'en-US-qwerty' },
    ]
    return fallbackPairs.find((candidate) => layoutPracticePairSupported(candidate)) ?? null
  }, [profilePair])

  const currentExercise = exercises[itemIndex]

  const startSession = useCallback(() => {
    if (!supportedPair) {
      setUnsupported(true)
      return
    }
    const nextExercises = buildLayoutPracticeExercises(
      supportedPair,
      LAYOUT_PRACTICE_ITEMS_PER_SESSION,
    )
    if (nextExercises.length === 0) {
      setUnsupported(true)
      return
    }
    setUnsupported(false)
    setPair(supportedPair)
    setExercises(nextExercises)
    setItemIndex(0)
    setAnswer('')
    setAttempt('idle')
    setCorrectCount(0)
    setIncorrectCount(0)
    setSessionStartedAt(Date.now())
    setSessionId(createLayoutPracticeSessionId())
    setView('session')
  }, [supportedPair])

  const finishSession = useCallback(async () => {
    const accountIdAtStart = accountSnapshotRef.current
    if (sessionId && sessionStartedAt && pair && accountIdAtStart) {
      const record: LayoutPracticeSessionRecord = {
        id: sessionId,
        version: LAYOUT_PRACTICE_SESSION_VERSION,
        startedAt: sessionStartedAt,
        completedAt: Date.now(),
        sourceLayout: pair.sourceLayout,
        targetLayout: pair.targetLayout,
        itemsAttempted: correctCount + incorrectCount,
        itemsCorrect: correctCount,
        itemsIncorrect: incorrectCount,
        status: 'completed',
      }
      await getLayoutPracticeSessionStore(flowlaryStorage).saveSession(record)
    }
    setView('complete')
  }, [correctCount, incorrectCount, pair, sessionId, sessionStartedAt])

  const checkAnswer = useCallback(() => {
    if (!currentExercise || attempt !== 'idle') return
    if (!answer.trim()) return
    const isCorrect = scoreLayoutPracticeAnswer(answer, currentExercise)
    setAttempt(isCorrect ? 'correct' : 'incorrect')
    if (isCorrect) setCorrectCount((value) => value + 1)
    else setIncorrectCount((value) => value + 1)
  }, [answer, attempt, currentExercise])

  const continueNext = useCallback(() => {
    if (itemIndex + 1 >= exercises.length) {
      void finishSession()
      return
    }
    setItemIndex((value) => value + 1)
    setAnswer('')
    setAttempt('idle')
  }, [exercises.length, finishSession, itemIndex])

  if (view === 'home') {
    return (
      <div className="fl-practice-page">
        <h3 className="fl-section-title">{t('layoutPractice.title')}</h3>
        <p className="fl-muted">{t('layoutPractice.lead')}</p>
        {supportedPair ? (
          <p className="fl-practice-recommendation">
            {t('layoutPractice.pairLabel', {
              source: layoutDisplayName(supportedPair.sourceLayout),
              target: layoutDisplayName(supportedPair.targetLayout),
            })}
          </p>
        ) : null}
        {unsupported || !supportedPair ? (
          <p className="fl-practice-feedback" role="status">
            {t('layoutPractice.unsupportedPair')}
          </p>
        ) : null}
        <div className="fl-practice-actions">
          <button type="button" className="fl-action-btn fl-action-btn-primary" onClick={startSession} disabled={!supportedPair}>
            {t('layoutPractice.startSession')}
          </button>
        </div>
        <p className="fl-muted fl-layout-practice-note">{t('layoutPractice.localNote')}</p>
      </div>
    )
  }

  if (view === 'complete') {
    const total = correctCount + incorrectCount
    return (
      <div className="fl-practice-page">
        <h3 className="fl-section-title">{t('layoutPractice.completeTitle')}</h3>
        <ul className="fl-practice-summary-list">
          <li>{t('layoutPractice.scoreCorrect', { correct: String(correctCount), total: String(total) })}</li>
          {incorrectCount > 0 ? (
            <li>{t('layoutPractice.scoreIncorrect', { count: String(incorrectCount) })}</li>
          ) : null}
        </ul>
        <div className="fl-practice-actions">
          <button type="button" className="fl-action-btn fl-action-btn-primary" onClick={startSession}>
            {t('layoutPractice.practiceAgain')}
          </button>
          <button type="button" className="fl-action-btn fl-action-btn-secondary" onClick={() => setView('home')}>
            {t('layoutPractice.backHome')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fl-practice-page">
      <div className="fl-practice-session-head">
        <p className="fl-practice-session-meta">
          {t('layoutPractice.sessionProgress', {
            current: String(itemIndex + 1),
            total: String(exercises.length),
          })}
        </p>
        {pair ? (
          <p className="fl-muted">
            {t('layoutPractice.pairLabel', {
              source: layoutDisplayName(pair.sourceLayout),
              target: layoutDisplayName(pair.targetLayout),
            })}
          </p>
        ) : null}
      </div>

      {currentExercise ? (
        <>
          <p className="fl-practice-prompt">{t('layoutPractice.promptInstruction')}</p>
          <p className="fl-layout-practice-prompt" aria-live="polite">
            {currentExercise.prompt}
          </p>
          <label className="fl-practice-write-label" htmlFor="layout-practice-answer">
            {t('layoutPractice.answerLabel')}
          </label>
          <textarea
            id="layout-practice-answer"
            className="fl-practice-textarea"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            disabled={attempt !== 'idle'}
            autoComplete="off"
            spellCheck={false}
          />
          {attempt === 'idle' ? (
            <div className="fl-practice-actions">
              <button
                type="button"
                className="fl-action-btn fl-action-btn-primary"
                onClick={checkAnswer}
                disabled={!answer.trim()}
              >
                {t('layoutPractice.checkAnswer')}
              </button>
            </div>
          ) : (
            <p
              className={`fl-practice-feedback ${attempt === 'correct' ? 'is-success' : 'is-error'}`}
              role="status"
            >
              {attempt === 'correct' ? t('layoutPractice.correct') : t('layoutPractice.incorrect')}
            </p>
          )}
          {attempt !== 'idle' ? (
            <div className="fl-practice-actions">
              <button type="button" className="fl-action-btn fl-action-btn-primary" onClick={continueNext}>
                {itemIndex + 1 >= exercises.length
                  ? t('layoutPractice.finishSession')
                  : t('layoutPractice.continueNext')}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
