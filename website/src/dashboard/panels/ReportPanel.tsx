import { useEffect, useState } from 'react'
import type { FullLearningReport } from '@flowlary/shared'
import { Button } from '../../components/Ui.tsx'
import type { DashboardCopy } from '../types.ts'
import { resolveWebFullLearningReport } from '../services/learningData.ts'
import type { WebLearningBundle } from '../services/learningData.ts'

type ReportPanelProps = {
  bundle: WebLearningBundle
  accountId: string
  copy: DashboardCopy
  isProOrTrial: boolean
  onOpenPractice: (target?: string) => void
}

export function ReportPanel({ bundle, accountId, copy, isProOrTrial, onOpenPractice }: ReportPanelProps) {
  const [report, setReport] = useState<FullLearningReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    void resolveWebFullLearningReport(bundle, accountId, 'en', isProOrTrial)
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
  }, [bundle, accountId, isProOrTrial])

  return (
    <div className="wd-panel-stack">
      <header className="wd-panel-head">
        <h2>{copy.report.title}</h2>
        <p className="wd-lead">{copy.report.lead}</p>
        {isProOrTrial ? <p className="wd-muted">{copy.report.proAi}</p> : null}
      </header>

      {loading ? <p className="wd-muted">{copy.report.loading}</p> : null}
      {error ? <p className="wd-error">{copy.common.error}</p> : null}

      {report?.state === 'no_data' ? (
        <article className="wd-card wd-empty">
          <p>{copy.report.empty}</p>
          <Button to="/#writing-lab">{copy.overview.writingLab}</Button>
        </article>
      ) : null}

      {report?.narrative ? (
        <>
          <article className="wd-card">
            <h3>{copy.report.overview}</h3>
            <p>{report.narrative.overview}</p>
          </article>
          {report.narrative.strengths.length > 0 ? (
            <article className="wd-card">
              <h3>{copy.report.strengths}</h3>
              <ul className="wd-list">
                {report.narrative.strengths.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </article>
          ) : null}
          {report.narrative.focusAreas.length > 0 ? (
            <article className="wd-card">
              <h3>{copy.report.focusAreas}</h3>
              <ul className="wd-list">
                {report.narrative.focusAreas.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </article>
          ) : null}
          {report.narrative.recommendations.length > 0 ? (
            <article className="wd-card">
              <h3>{copy.report.recommendations}</h3>
              <ul className="wd-list">
                {report.narrative.recommendations.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </article>
          ) : null}
          {report.narrative.nextSteps.length > 0 ? (
            <article className="wd-card">
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
              <Button type="button" variant="ghost" onClick={() => onOpenPractice(pattern.targetPatternId)}>
                {copy.report.practiceThis}
              </Button>
            </div>
          ))}
        </article>
      ) : null}

      {report?.limitReached ? <p className="wd-muted">{copy.report.limitReached}</p> : null}
    </div>
  )
}
