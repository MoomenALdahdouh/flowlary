import { useState } from 'react'
import type { LearningCoachMode } from '@flowlary/shared'
import { Button } from '../../components/Ui.tsx'
import type { DashboardCopy } from '../types.ts'
import { resolveWebLearningCoach } from '../services/learningData.ts'
import type { WebLearningBundle } from '../services/learningData.ts'

type LearningCoachCardProps = {
  bundle: WebLearningBundle
  accountId: string
  copy: DashboardCopy
  isProOrTrial: boolean
  locale: 'en' | 'ar'
  onOpenPractice: (target?: string) => void
  onOpenReport: () => void
}

export function LearningCoachCard({
  bundle,
  accountId,
  copy,
  isProOrTrial,
  locale,
  onOpenPractice,
  onOpenReport,
}: LearningCoachCardProps) {
  const [busy, setBusy] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [error, setError] = useState(false)

  async function ask(mode: LearningCoachMode, question: string | null = null) {
    setBusy(true)
    setError(false)
    try {
      const response = await resolveWebLearningCoach(bundle, accountId, locale, mode, question, isProOrTrial)
      setSummary(response.summary)
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className={`wd-card${summary ? ' wd-card-ai' : ''}`}>
      <h3>{copy.coach.title}</h3>
      {summary ? (
        <>
          <p className="wd-data-label">{copy.coach.aiInterpretation}</p>
          <p>{summary}</p>
        </>
      ) : (
        <p className="wd-muted">{copy.coach.ask}</p>
      )}
      {error ? <p className="wd-error">{copy.common.error}</p> : null}
      {busy ? (
        <p className="wd-ai-status is-working" role="status">
          {copy.coach.sending}
        </p>
      ) : null}
      <div className="wd-actions wd-actions-wrap">
        <Button type="button" disabled={busy} onClick={() => void ask('focus')}>
          {copy.coach.presetFocus}
        </Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => void ask('improving')}>
          {copy.coach.presetProgress}
        </Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => void ask('recurring_error')}>
          {copy.coach.presetReport}
        </Button>
      </div>
      {summary ? (
        <div className="wd-actions">
          <Button type="button" variant="ghost" disabled={busy} onClick={() => onOpenPractice()}>
            {copy.practice.startSession}
          </Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={onOpenReport}>
            {copy.nav.report}
          </Button>
        </div>
      ) : null}
    </article>
  )
}
