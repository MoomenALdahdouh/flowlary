import { DailyBriefCard } from '../components/DailyBriefCard.tsx'
import { LearningSetupCard } from '../components/LearningCards.tsx'
import { SignInPromptBanner } from '../components/SignInPromptBanner.tsx'
import type { ExtensionStatus } from '../../messaging/types.ts'
import type { DomainState } from '../../ui/domainState.ts'
import { ToggleSwitch } from '../../popup/components.tsx'
import { useI18n } from '../../popup/i18n/index.ts'
import { t } from '../../popup/i18n/index.ts'
import { ProUpgradeCard, UsageStatusCard } from '../../ui/UsageStatusCard.tsx'
import { resolveUsageUxFromStatus } from '../../ui/usageUx.ts'
import { getShortcutLabels } from '../../popup/shortcuts.ts'

type OverviewPanelProps = {
  status: ExtensionStatus
  domain: DomainState
  loading: boolean
  busy: string | null
  onGlobalToggle: (next: boolean) => void
  onOpenAccount: () => void
  onOpenSettings: () => void
  onSetupLearning: () => void
  onDismissLearningSetup: () => void
  setupBusy?: boolean
  onOpenProgress: () => void
  onOpenPractice: (targetPatternId?: string) => void
}

export function OverviewPanel({
  status,
  domain,
  loading,
  busy,
  onGlobalToggle,
  onOpenAccount,
  onOpenSettings,
  onSetupLearning,
  onDismissLearningSetup,
  setupBusy,
  onOpenProgress,
  onOpenPractice,
}: OverviewPanelProps) {
  const { messages } = useI18n()
  const overview = messages.dashboard.overview
  const signedIn = status.account.signedIn
  const usage = resolveUsageUxFromStatus(status)
  const shortcuts = getShortcutLabels()
  const showUpgradeCard =
    usage.showUpgrade &&
    (usage.state === 'AI_USAGE_EXHAUSTED' ||
      usage.state === 'AI_USAGE_LOW' ||
      usage.state === 'AI_TRIAL_ENDING' ||
      usage.state === 'AI_TRIAL_EXPIRED')

  return (
    <div className="wd-panel-stack wd-home">
      <header className="wd-panel-head">
        <h2>{overview.title}</h2>
        <p className="wd-lead">{overview.lead}</p>
      </header>

      <article className="wd-card wd-card-compact fl-dash-help-row">
        <div>
          <p className="fl-zip-row-title">{t('popup.helpOn')}</p>
          <p className="wd-muted">{extensionOnCopy(domain)}</p>
        </div>
        <ToggleSwitch
          id="dash-toggle-extension"
          label={t('master.toggleLabel')}
          checked={domain.extension === 'active'}
          disabled={loading || domain.extension === 'loading'}
          busy={busy === 'global'}
          onChange={onGlobalToggle}
        />
      </article>

      {!signedIn ? <SignInPromptBanner onOpenAccount={onOpenAccount} /> : null}

      {signedIn ? <UsageStatusCard view={usage} /> : null}

      {signedIn && showUpgradeCard ? (
        <article className="wd-card wd-card-highlight">
          <ProUpgradeCard />
        </article>
      ) : null}

      {signedIn ? (
        <LearningSetupCard
          status={status}
          onSetup={onSetupLearning}
          onDismiss={onDismissLearningSetup}
          busy={setupBusy}
        />
      ) : null}

      {signedIn ? (
        <DailyBriefCard
          signedIn={signedIn}
          onOpenPractice={onOpenPractice}
          onOpenProgress={onOpenProgress}
          onOpenAccount={onOpenAccount}
        />
      ) : null}

      <article className="wd-card">
        <p className="wd-muted">{t('popup.speedBoxHint', { shortcut: shortcuts.speedBox })}</p>
        <div className="wd-actions">
          <button type="button" className="fl-link-btn" onClick={onOpenSettings}>
            {overview.openSettings}
          </button>
        </div>
      </article>
    </div>
  )
}

function extensionOnCopy(domain: DomainState): string {
  if (domain.extension === 'loading') return t('connection.checking')
  if (domain.extension === 'paused') return t('system.extensionPausedDesc')
  return t('system.extensionRunning')
}
