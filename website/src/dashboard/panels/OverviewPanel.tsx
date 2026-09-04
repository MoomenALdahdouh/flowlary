import { PenLine, Zap } from 'lucide-react'
import { InstallFlowlaryButton } from '../../components/Ui.tsx'
import { ChromeIcon } from '../../bolt/components/icons/ChromeIcon.tsx'
import type { DashboardCopy } from '../types.ts'
import type { WebLearningBundle } from '../services/learningData.ts'
import { DailyBriefCard } from '../components/DailyBriefCard.tsx'

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ''))
}

type OverviewPanelProps = {
  bundle: WebLearningBundle
  accountId: string
  copy: DashboardCopy
  extensionConnected: boolean | null
  creditsRemaining: number | null
  dailyLimit: number
  creditsUsed?: number
  planLabel?: string
  usageDescription: string | null
  onNavigate: (section: 'lab' | 'practice' | 'progress' | 'report', target?: string) => void
}

export function OverviewPanel({
  bundle,
  accountId,
  copy,
  extensionConnected,
  creditsRemaining,
  dailyLimit,
  creditsUsed,
  planLabel,
  usageDescription,
  onNavigate,
}: OverviewPanelProps) {
  const used = creditsUsed ?? (creditsRemaining != null ? Math.max(0, dailyLimit - creditsRemaining) : 0)
  const usagePct = dailyLimit > 0 ? Math.min(100, Math.round((used / dailyLimit) * 100)) : 0
  const eventCount = bundle.store.events.length

  return (
    <div className="wd-panel-stack wd-home">
      <header className="wd-home-head">
        <div>
          <h2>{copy.overview.title}</h2>
          <p className="wd-lead">{copy.overview.welcome}</p>
        </div>
        <button type="button" className="fl-nav-cta" onClick={() => onNavigate('lab')}>
          <PenLine className="h-4 w-4" aria-hidden="true" />
          {copy.overview.startWriting}
        </button>
      </header>

      <article className={`wd-card wd-home-ext${extensionConnected ? ' is-on' : ''}`}>
        <div className="wd-home-install-icon" aria-hidden="true">
          <ChromeIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="wd-home-install-title">{copy.overview.extension}</p>
          <p className="wd-muted">
            {extensionConnected ? copy.overview.extensionConnected : copy.overview.extensionNotDetected}
          </p>
        </div>
        {extensionConnected ? (
          <span className="wd-home-badge">{copy.overview.connectedBadge}</span>
        ) : (
          <InstallFlowlaryButton variant="secondary" />
        )}
      </article>

      <div className="wd-overview-split">
        <article className="wd-card">
          <div className="wd-home-usage-head">
            <div className="wd-home-usage-label">
              <Zap className="h-4 w-4" aria-hidden="true" />
              {copy.overview.planUsage}
            </div>
            {planLabel ? <span className="wd-home-plan">{planLabel}</span> : null}
          </div>
          <p className="wd-home-usage-count">
            <span>{used}</span>
            <span className="wd-muted"> / {dailyLimit}</span>
          </p>
          <div className="wd-home-meter" aria-hidden="true">
            <div className="wd-home-meter-fill" style={{ width: `${usagePct}%` }} />
          </div>
          {creditsRemaining != null ? (
            <p className="wd-muted">{fill(copy.overview.creditsRemaining, { remaining: creditsRemaining, limit: dailyLimit })}</p>
          ) : usageDescription ? (
            <p className="wd-muted">{usageDescription}</p>
          ) : null}
          <p className="wd-muted">{copy.overview.layoutNote}</p>
        </article>

        <article className="wd-card">
          <p className="wd-home-usage-label">{copy.overview.writingEvents}</p>
          <p className="wd-home-usage-count">
            <span>{eventCount}</span>
          </p>
          <p className="wd-muted">{fill(copy.overview.eventsSynced, { count: eventCount })}</p>
        </article>
      </div>

      <DailyBriefCard
        bundle={bundle}
        accountId={accountId}
        copy={copy}
        onOpenPractice={(target) => onNavigate('practice', target)}
        onOpenProgress={() => onNavigate('progress')}
        onOpenLab={() => onNavigate('lab')}
      />

      <p className="wd-home-history">{copy.overview.historyBody}</p>
    </div>
  )
}
