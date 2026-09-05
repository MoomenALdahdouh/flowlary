import { useEffect, useState } from 'react'
import type { FullLearningReport, LearningFocus, ReportRecurringPattern } from '@flowlary/shared'
import { t } from '../../popup/i18n/index.ts'
import { DashboardPage } from '../DashboardPage.tsx'
import { activeAccountContext } from '../../storage/activeAccountContext.ts'
import { flowlaryStorage } from '../../storage/index.ts'
import { resolveFullLearningReport } from '../../storage/learning/report/resolveFullLearningReport.ts'
import { ReportExportMenu } from '../../features/learningReport/export/ReportExportMenu.tsx'

const REPORT_LOAD_TIMEOUT_MS = 20_000

async function loadFullLearningReport(): Promise<FullLearningReport> {
  return Promise.race([
    resolveFullLearningReport(flowlaryStorage),
    new Promise<FullLearningReport>((_, reject) => {
      window.setTimeout(() => reject(new Error('learning_report_timeout')), REPORT_LOAD_TIMEOUT_MS)
    }),
  ])
}

type LearningReportPanelProps = {
  signedIn: boolean
  onOpenAccount: () => void
  onOpenPractice: (targetPatternId?: string) => void
}

function categoryLabel(category: LearningFocus | string): string {
  return t(`learning.focus.${category}` as 'learning.focus.spelling')
}

function PatternRow({
  pattern,
  onPractice,
}: {
  pattern: ReportRecurringPattern
  onPractice: (targetPatternId: string) => void
}) {
  return (
    <article className="fl-report-pattern">
      <p className="fl-report-pattern-pair">
        <span className="fl-report-original">{pattern.displayOriginal}</span>
        <span className="fl-report-arrow" aria-hidden="true">
          →
        </span>
        <span className="fl-report-corrected">{pattern.displayCorrected}</span>
      </p>
      <p className="fl-report-pattern-meta">
        {t('learningReport.seenCount', { count: String(pattern.count) })}
        {' · '}
        {categoryLabel(pattern.category)}
      </p>
      {pattern.explanation ? (
        <p className="fl-report-explanation">
          {pattern.explanation.ruleTitle ? (
            <strong>{pattern.explanation.ruleTitle}: </strong>
          ) : null}
          {pattern.explanation.summary}
        </p>
      ) : null}
      <button type="button" className="fl-link-btn" onClick={() => onPractice(pattern.targetPatternId)}>
        {t('learningReport.practiceThis')}
      </button>
    </article>
  )
}

export function LearningReportPanel({ signedIn, onOpenAccount, onOpenPractice }: LearningReportPanelProps) {
  const [report, setReport] = useState<FullLearningReport | null>(null)
  const [accountGuard, setAccountGuard] = useState(() => activeAccountContext.snapshot())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!signedIn) {
      setReport(null)
      setLoading(false)
      return
    }
    let active = true
    void loadFullLearningReport()
      .then((data) => {
        if (active) {
          setReport(data)
          setAccountGuard(activeAccountContext.snapshot())
        }
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
  }, [signedIn])

  if (!signedIn) {
    return (
      <DashboardPage title={t('learningReport.title')} lead={t('learningReport.lead')}>
        <section className="fl-dash-card">
          <p className="fl-card-desc">{t('learningReport.signIn')}</p>
          <button type="button" className="fl-link-btn" onClick={onOpenAccount}>
            {t('account.signIn')}
          </button>
        </section>
      </DashboardPage>
    )
  }

  if (loading) {
    return (
      <DashboardPage title={t('learningReport.title')} lead={t('learningReport.lead')}>
        <p className="fl-loading" role="status">
          {t('learningReport.loading')}
        </p>
      </DashboardPage>
    )
  }

  if (error || !report) {
    return (
      <DashboardPage title={t('learningReport.title')} lead={t('learningReport.lead')}>
        <section className="fl-dash-card">
          <p className="fl-card-desc">{t('learningReport.unavailable')}</p>
          <button
            type="button"
            className="fl-action-btn"
            onClick={() => {
              setLoading(true)
              setError(false)
              void loadFullLearningReport()
                .then((data) => {
                  setReport(data)
                  setAccountGuard(activeAccountContext.snapshot())
                })
                .catch(() => setError(true))
                .finally(() => setLoading(false))
            }}
          >
            {t('errors.retry')}
          </button>
        </section>
      </DashboardPage>
    )
  }

  if (report.state === 'signed_out' || !report.snapshot || !report.narrative) {
    return (
      <DashboardPage title={t('learningReport.title')} lead={t('learningReport.lead')}>
        <section className="fl-dash-card">
          <p className="fl-card-desc">{t('learningReport.signIn')}</p>
          <button type="button" className="fl-link-btn" onClick={onOpenAccount}>
            {t('account.signIn')}
          </button>
        </section>
      </DashboardPage>
    )
  }

  const { snapshot, narrative } = report

  return (
    <DashboardPage title={t('learningReport.title')} lead={t('learningReport.lead')}>
      <div className="fl-learning-report">
        <header className="fl-dash-card fl-report-header">
          <p className="fl-report-period">
            {t('learningReport.period', { days: String(snapshot.periodDays) })}
          </p>
          {report.fromCache ? (
            <p className="fl-report-meta">{t('learningReport.fromCache')}</p>
          ) : null}
          {report.limitReached ? (
            <p className="fl-report-meta">{t('learningReport.limitReached')}</p>
          ) : null}
          <p className="fl-report-overview">{narrative.overview}</p>
          {narrative.source === 'ai' ? (
            <p className="fl-report-meta">{t('learningReport.aiNarration')}</p>
          ) : null}
        </header>

        <section className="fl-dash-card fl-report-section">
          <h3 className="fl-section-label">{t('learningReport.activityTitle')}</h3>
          <ul className="fl-report-stats">
            <li>{t('learningReport.wordsWritten', { count: String(snapshot.activity.wordsWritten) })}</li>
            <li>{t('learningReport.events', { count: String(snapshot.activity.writingEventCount) })}</li>
            <li>{t('learningReport.corrections', { count: String(snapshot.activity.writingErrorCount) })}</li>
            {snapshot.activity.errorsPer100Words != null ? (
              <li>
                {t('learningReport.errorsPer100Words', {
                  rate: snapshot.activity.errorsPer100Words.toFixed(2),
                })}
              </li>
            ) : null}
            <li>
              {t('learningReport.practiceSessions', {
                count: String(snapshot.activity.practiceSessionsThisWeek),
              })}
            </li>
          </ul>
        </section>

        {narrative.strengths.length > 0 ? (
          <section className="fl-dash-card fl-report-section">
            <h3 className="fl-section-label">{t('learningReport.strengthsTitle')}</h3>
            <ul className="fl-report-list">
              {narrative.strengths.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {narrative.focusAreas.length > 0 ? (
          <section className="fl-dash-card fl-report-section">
            <h3 className="fl-section-label">{t('learningReport.improveTitle')}</h3>
            <ul className="fl-report-list">
              {narrative.focusAreas.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {snapshot.recurringPatterns.length > 0 ? (
          <section className="fl-dash-card fl-report-section">
            <h3 className="fl-section-label">{t('learningReport.patternsTitle')}</h3>
            <div className="fl-report-patterns">
              {snapshot.recurringPatterns.map((pattern) => (
                <PatternRow
                  key={pattern.targetPatternId}
                  pattern={pattern}
                  onPractice={(targetId) => onOpenPractice(targetId)}
                />
              ))}
            </div>
          </section>
        ) : null}

        {narrative.improvements.length > 0 ? (
          <section className="fl-dash-card fl-report-section">
            <h3 className="fl-section-label">{t('learningReport.improvingTitle')}</h3>
            <ul className="fl-report-list">
              {narrative.improvements.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {snapshot.focusCategory ? (
          <section className="fl-dash-card fl-report-section">
            <h3 className="fl-section-label">{t('learningReport.currentFocusTitle')}</h3>
            <p>{categoryLabel(snapshot.focusCategory)}</p>
          </section>
        ) : null}

        {narrative.recommendations.length > 0 ? (
          <section className="fl-dash-card fl-report-section">
            <h3 className="fl-section-label">{t('learningReport.practicePlanTitle')}</h3>
            <ol className="fl-report-list fl-report-ordered">
              {narrative.recommendations.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
            <button type="button" className="fl-action-btn fl-action-btn-secondary" onClick={() => onOpenPractice()}>
              {t('learningReport.practiceThis')}
            </button>
          </section>
        ) : null}

        {narrative.nextSteps.length > 0 ? (
          <section className="fl-dash-card fl-report-section">
            <h3 className="fl-section-label">{t('learningReport.nextStepsTitle')}</h3>
            <ul className="fl-report-list">
              {narrative.nextSteps.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <footer className="fl-report-footer">
          <ReportExportMenu report={report} accountGuard={accountGuard} />
        </footer>
      </div>
    </DashboardPage>
  )
}
