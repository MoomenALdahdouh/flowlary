import { useMemo } from 'react'
import { InstallFlowlaryButton } from '../../components/Ui.tsx'
import { useMessages } from '../../i18n/index.tsx'
import type { DashboardCopy } from '../types.ts'
import type { WebLearningBundle } from '../services/learningData.ts'
import { DailyBriefCard } from '../components/DailyBriefCard.tsx'
import { LearningCoachCard } from '../components/LearningCoachCard.tsx'
import { PersonalStatsCard } from '../../components/trust/PersonalStatsCard.tsx'
import { LearningLoopStrip } from '../components/LearningLoopStrip.tsx'
import { WritingLabLink } from '../components/WritingLabLink.tsx'

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''))
}

type OverviewPanelProps = {
  bundle: WebLearningBundle
  accountId: string
  copy: DashboardCopy
  locale: 'en' | 'ar'
  isProOrTrial: boolean
  extensionConnected: boolean | null
  creditsRemaining: number | null
  dailyLimit: number
  usageDescription: string | null
  onNavigate: (section: 'practice' | 'progress' | 'report', target?: string) => void
}

export function OverviewPanel({
  bundle,
  accountId,
  copy,
  locale,
  isProOrTrial,
  extensionConnected,
  creditsRemaining,
  dailyLimit,
  usageDescription,
  onNavigate,
}: OverviewPanelProps) {
  const eventCount = useMemo(
    () => bundle.store.events.filter((e) => e.source === 'writing').length,
    [bundle.store.events],
  )

  return (
    <div className="wd-panel-stack">
      <header className="wd-panel-head">
        <h2>{copy.overview.title}</h2>
        <p className="wd-lead">{copy.overview.lead}</p>
      </header>

      <LearningLoopStrip />

      <article className="wd-card wd-card-focus">
        <h3>{copy.overview.writingLab}</h3>
        <WritingLabLink />
      </article>

      {usageDescription ? (
        <article className="wd-card wd-card-compact">
          <h3>{copy.overview.planUsage}</h3>
          <p>{usageDescription}</p>
          {creditsRemaining != null ? (
            <p className="wd-muted">
              {fill(copy.overview.creditsRemaining, { remaining: creditsRemaining, limit: dailyLimit })}
            </p>
          ) : null}
        </article>
      ) : null}

      <DailyBriefCard
        bundle={bundle}
        accountId={accountId}
        copy={copy}
        onOpenPractice={(target) => onNavigate('practice', target)}
        onOpenProgress={() => onNavigate('progress')}
      />

      <section className="wd-section" aria-labelledby="wd-learn-heading">
        <h3 id="wd-learn-heading" className="wd-section-title">
          {copy.nav.groupLearn}
        </h3>
        <div className="wd-section-stack">
          <LearningCoachCard
            bundle={bundle}
            accountId={accountId}
            copy={copy}
            isProOrTrial={isProOrTrial}
            locale={locale}
            onOpenPractice={(target) => onNavigate('practice', target)}
            onOpenReport={() => onNavigate('report')}
          />
        </div>
      </section>

      <PersonalStatsCard />

      <article className="wd-card">
        <h3>{copy.overview.extension}</h3>
        <p>
          {extensionConnected == null
            ? copy.common.loading
            : extensionConnected
              ? copy.overview.extensionConnected
              : copy.overview.extensionNotDetected}
        </p>
        {eventCount > 0 ? (
          <p className="wd-muted">{fill(copy.overview.eventsSynced, { count: eventCount })}</p>
        ) : null}
        {!extensionConnected ? (
          <div className="wd-actions">
            <InstallFlowlaryButton variant="secondary" />
          </div>
        ) : null}
      </article>

      <article className="wd-card wd-card-muted">
        <h3>{copy.overview.historyTitle}</h3>
        <p className="wd-muted">{copy.overview.historyBody}</p>
        <p className="wd-muted wd-extension-note">{copy.overview.historyAction}</p>
      </article>
    </div>
  )
}
