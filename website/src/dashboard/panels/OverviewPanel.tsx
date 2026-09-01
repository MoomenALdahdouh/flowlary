import { useMemo } from 'react'
import { Button, GetFlowlaryButton } from '../../components/Ui.tsx'
import { useMessages } from '../../i18n/index.tsx'
import type { DashboardCopy } from '../types.ts'
import type { WebLearningBundle } from '../services/learningData.ts'
import { DailyBriefCard } from '../components/DailyBriefCard.tsx'
import { LearningCoachCard } from '../components/LearningCoachCard.tsx'
import { PersonalStatsCard } from '../../components/trust/PersonalStatsCard.tsx'

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
  onNavigate: (section: 'practice' | 'progress' | 'report', target?: string) => void
}

export function OverviewPanel({
  bundle,
  accountId,
  copy,
  locale,
  isProOrTrial,
  extensionConnected,
  onNavigate,
}: OverviewPanelProps) {
  const messages = useMessages()
  const eventCount = useMemo(
    () => bundle.store.events.filter((e) => e.source === 'writing').length,
    [bundle.store.events],
  )

  return (
    <div className="wd-panel-stack">
      <header className="wd-panel-head">
        <h2>{copy.overview.title}</h2>
        <p className="wd-lead">{copy.overview.lead}</p>
        <p className="wd-journey-hint">{copy.overview.journey}</p>
      </header>

      <article className="wd-card wd-card-primary">
        <h3>{copy.overview.writingLab}</h3>
        <p>{copy.overview.writingLabBody}</p>
        <div className="wd-actions">
          <Button to="/#writing-lab">{copy.overview.startWriting}</Button>
        </div>
      </article>

      <PersonalStatsCard />

      <section className="wd-section" aria-labelledby="wd-learn-heading">
        <h3 id="wd-learn-heading" className="wd-section-title">
          {copy.nav.groupLearn}
        </h3>
        <div className="wd-section-stack">
          <DailyBriefCard
            bundle={bundle}
            accountId={accountId}
            copy={copy}
            onOpenPractice={(target) => onNavigate('practice', target)}
            onOpenProgress={() => onNavigate('progress')}
          />

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
            <GetFlowlaryButton variant="secondary" />
          </div>
        ) : null}
      </article>

      <article className="wd-card">
        <h3>{messages.accountSupport.title}</h3>
        <p className="wd-muted">{messages.accountSupport.lead}</p>
        <div className="wd-actions">
          <Button to="/account/support">{messages.accountSupport.contactCta}</Button>
          <Button variant="secondary" to="/support">
            {messages.accountSupport.helpCenter}
          </Button>
        </div>
      </article>
    </div>
  )
}
