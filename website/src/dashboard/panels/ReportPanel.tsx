import { useEffect, useState } from 'react'
import type { FullLearningReport } from '@flowlary/shared'
import type { DashboardCopy } from '../types.ts'
import { resolveWebFullLearningReport } from '../services/learningData.ts'
import type { WebLearningBundle } from '../services/learningData.ts'
import { WritingLabLink } from '../components/WritingLabLink.tsx'
import { Button } from '../../components/Ui.tsx'

type ReportPanelProps = {
  bundle: WebLearningBundle
  accountId: string
  copy: DashboardCopy
  locale: 'en' | 'ar'
  isProOrTrial: boolean
  onOpenPractice: (target?: string) => void
}

export function ReportPanel({
  bundle,
  accountId,
  copy,
  locale,
  isProOrTrial,
  onOpenPractice,
}: ReportPanelProps) {
  const [report, setReport] = useState<FullLearningReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(false)
    void resolveWebFullLearningReport(bundle, accountId, locale, isProOrTrial)
      .then((data) => {
        if (active) setReport(data)
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
  }, [bundle, accountId, locale, isProOrTrial])

  return (
    <div className="wd-panel-stack">
      <header className="wd-panel-head">
        <h2>{copy.report.title}</h2>
        <p className="wd-lead">{copy.report.lead}</p>
        {isProOrTrial ? <p className="wd-muted">{copy.report.proAi}</p> : null}
      </header>

      {loading ? (
        <p className="wd-muted" role="status">
          {copy.report.loading}
        </p>
      ) : null}
      {error ? (
        <article className="wd-card wd-empty" role="alert">
          <p className="wd-error">{copy.report.failed}</p>
        </article>
      ) : null}

      {report?.state === 'no_data' ? (
        <article className="wd-card wd-empty">
          <p>{copy.report.empty}</p>
          <WritingLabLink />
        </article>
      ) : null}

      {report?.narrative ? (
        <>
          <p className="wd-data-label">{copy.report.aiInterpretation}</p>
          <article className="wd-card wd-card-ai">
            <h3>{copy.report.overview}</h3>
            <p>{report.narrative.overview}</p>
          </article>
          {report.narrative.strengths.length > 0 ? (
            <article className="wd-card wd-card-ai">
              <h3>{copy.report.strengths}</h3>
              <ul className="wd-list">
                {report.narrative.strengths.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </article>
          ) : null}
          {report.narrative.focusAreas.length > 0 ? (
            <article className="wd-card wd-card-ai">
              <h3>{copy.report.focusAreas}</h3>
              <ul className="wd-list">
                {report.narrative.focusAreas.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </article>
          ) : null}
          {report.narrative.recommendations.length > 0 ? (
            <article className="wd-card wd-card-ai">
              <h3>{copy.report.recommendations}</h3>
              <ul className="wd-list">
                {report.narrative.recommendations.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </article>
          ) : null}
          {report.narrative.nextSteps.length > 0 ? (
            <article className="wd-card wd-card-ai">
              <h3>{copy.report.nextSteps}</h3>
              <ul className="wd-list">
                {report.narrative.nextSteps.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </article>
          ) : null}
        </>
      ) : null}

      {report?.snapshot?.recurringPatterns && report.snapshot.recurringPatterns.length > 0 ? (
        <>
          <p className="wd-data-label">{copy.report.observedData}</p>
          <article className="wd-card">
            <h3>{copy.progress.recurring}</h3>
            {report.snapshot.recurringPatterns.map((pattern) => (
              <div key={pattern.targetPatternId} className="wd-pattern-row">
                <p>
                  <span className="wd-pattern-pair">
                    {pattern.displayOriginal} → {pattern.displayCorrected}
                  </span>
                  <span className="wd-muted"> · {pattern.count}×</span>
                </p>
                {pattern.explanation?.summary ? <p className="wd-muted">{pattern.explanation.summary}</p> : null}
                <Button type="button" variant="link" onClick={() => onOpenPractice(pattern.targetPatternId)}>
                  {copy.report.practiceThis}
                </Button>
              </div>
            ))}
          </article>
        </>
      ) : null}

      {report?.limitReached ? <p className="wd-muted">{copy.report.limitReached}</p> : null}
    </div>
  )
}
