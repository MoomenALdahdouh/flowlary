import { ComposeWorkbench } from '../components/ComposeWorkbench.tsx'
import { DailyBriefCard } from '../components/DailyBriefCard.tsx'
import { LearningCoachCard } from '../components/LearningCoachCard.tsx'
import { LearningLoopStrip } from '../components/LearningLoopStrip.tsx'
import { LearningSetupCard } from '../components/LearningCards.tsx'
import { SignInPromptBanner } from '../components/SignInPromptBanner.tsx'
import type { ExtensionStatus } from '../../messaging/types.ts'
import { SUPPORTED_LANGUAGES } from '../../features/translation/languages.ts'
import type { DomainState } from '../../ui/domainState.ts'
import { FeatureControl } from '../../ui/FeatureControl.tsx'
import { SystemStatusBlock } from '../../ui/SystemStatus.tsx'
import { useI18n } from '../../popup/i18n/index.ts'
import { t } from '../../popup/i18n/index.ts'
import { formatLanguagePair } from '../../popup/status.ts'
import { FLOWLARY_SITE_URL } from '../../config/endpoints.ts'
import { ProUpgradeCard, UsageStatusCard } from '../../ui/UsageStatusCard.tsx'
import { resolveUsageUxFromStatus } from '../../ui/usageUx.ts'

type OverviewPanelProps = {
  status: ExtensionStatus
  domain: DomainState
  loading: boolean
  busy: string | null
  onGlobalToggle: (next: boolean) => void
  onCorrectionToggle: (next: boolean) => void
  onCorrectionModeChange: (next: 'box' | 'direct') => void
  onTranslationModeChange: (next: 'box' | 'direct') => void
  onLayoutModeChange: (next: 'box' | 'direct') => void
  onTranslationToggle: (next: boolean) => void
  onLiveToggle: (next: boolean) => void
  onLayoutToggle: (next: boolean) => void
  onAcceptManaged: () => void
  onOpenAccount: () => void
  onOpenSettings: () => void
  onSetupLearning: () => void
  onDismissLearningSetup: () => void
  setupBusy?: boolean
  onOpenProgress: () => void
  onOpenPractice: (targetPatternId?: string) => void
  onOpenReport: () => void
  onOpenActivity: () => void
  onReplayTour?: () => void
}

function languageName(code: string): string {
  return SUPPORTED_LANGUAGES.find((item) => item.code === code)?.name ?? code.toUpperCase()
}

export function OverviewPanel({
  status,
  domain,
  loading,
  busy,
  onGlobalToggle,
  onCorrectionToggle,
  onCorrectionModeChange,
  onTranslationModeChange,
  onLayoutModeChange,
  onTranslationToggle,
  onLiveToggle,
  onLayoutToggle,
  onAcceptManaged,
  onOpenAccount,
  onOpenSettings,
  onSetupLearning,
  onDismissLearningSetup,
  setupBusy,
  onOpenProgress,
  onOpenPractice,
  onOpenReport,
  onOpenActivity,
  onReplayTour,
}: OverviewPanelProps) {
  const { messages } = useI18n()
  const overview = messages.dashboard.overview
  const signedIn = status.account.signedIn
  const usage = resolveUsageUxFromStatus(status)
  const showUpgradeCard =
    usage.showUpgrade &&
    (usage.state === 'AI_USAGE_EXHAUSTED' ||
      usage.state === 'AI_USAGE_LOW' ||
      usage.state === 'AI_TRIAL_ENDING' ||
      usage.state === 'AI_TRIAL_EXPIRED')
  const languagePair = formatLanguagePair(
    status.translation.sourceLanguage,
    status.translation.targetLanguage,
    languageName(status.translation.sourceLanguage),
    languageName(status.translation.targetLanguage),
  )

  return (
    <div className="wd-panel-stack">
      <header className="wd-panel-head">
        <h2>{overview.title}</h2>
        <p className="wd-lead">{overview.lead}</p>
      </header>

      <LearningLoopStrip />

      <article className="wd-card wd-card-focus">
        <h3>{overview.writingLab}</h3>
        <p className="wd-muted">{overview.writingLabBody}</p>
        <div className="wd-actions">
          <a className="fl-action-btn fl-action-btn-primary" href={`${FLOWLARY_SITE_URL}/lab`} target="_blank" rel="noreferrer">
            {t('dashboard.openWritingLab')}
          </a>
        </div>
      </article>

      <article className="wd-card">
        <SystemStatusBlock
          compact
          domain={domain}
          loading={loading}
          busy={busy === 'global'}
          showExtensionToggle
          onExtensionToggle={onGlobalToggle}
        />
      </article>

      {!signedIn ? <SignInPromptBanner onOpenAccount={onOpenAccount} /> : null}

      {signedIn ? (
        <article className="wd-card wd-card-compact">
          <UsageStatusCard view={usage} compact />
        </article>
      ) : null}

      {signedIn && showUpgradeCard ? (
        <article className="wd-card wd-card-highlight">
          <ProUpgradeCard />
        </article>
      ) : null}

      <ComposeWorkbench
        status={status}
        domain={domain}
        onAcceptManaged={onAcceptManaged}
        onOpenAccount={onOpenAccount}
      />

      {signedIn ? (
        <LearningSetupCard
          status={status}
          onSetup={onSetupLearning}
          onDismiss={onDismissLearningSetup}
          busy={setupBusy}
        />
      ) : null}

      {signedIn ? (
        <section className="wd-section" aria-labelledby="dash-learn-heading">
          <h3 id="dash-learn-heading" className="wd-section-title">
            {messages.dashboard.nav.groupLearn}
          </h3>
          <div className="wd-section-stack fl-overview-learn">
            <DailyBriefCard
              signedIn={signedIn}
              onOpenPractice={onOpenPractice}
              onOpenProgress={onOpenProgress}
              onOpenAccount={onOpenAccount}
            />
            <LearningCoachCard
              signedIn={signedIn}
              onOpenPractice={onOpenPractice}
              onOpenProgress={onOpenProgress}
              onOpenReport={onOpenReport}
              onOpenAccount={onOpenAccount}
            />
          </div>
        </section>
      ) : null}

      <section className="wd-card" aria-labelledby="dash-features-heading" data-tour="features">
        <h3 id="dash-features-heading" className="wd-section-title">
          {overview.features}
        </h3>
        <p className="wd-muted">{t('assistant.lead')}</p>
        <div className="fl-compact-stack">
          <FeatureControl
            compact
            featureKey="layout"
            title={t('features.layout')}
            description={t('features.layoutDesc')}
            feature={domain.features.layout}
            toggleId="dash-toggle-layout"
            busy={busy === 'layout'}
            loading={loading}
            onToggle={onLayoutToggle}
          />
          <FeatureControl
            compact
            featureKey="correction"
            title={t('features.correction')}
            description={t('features.correctionDesc')}
            feature={domain.features.correction}
            toggleId="dash-toggle-correction"
            busy={busy === 'correction'}
            loading={loading}
            onToggle={onCorrectionToggle}
            action={
              domain.features.correction.kind === 'requires_consent' ? (
                <button type="button" className="fl-link-btn" onClick={onAcceptManaged}>
                  {t('ai.enable')}
                </button>
              ) : null
            }
          />
          <FeatureControl
            compact
            featureKey="liveTranslation"
            title={t('features.liveTranslation')}
            description={t('features.liveTranslationDesc')}
            meta={languagePair}
            feature={domain.features.liveTranslation}
            toggleId="dash-toggle-live"
            busy={busy === 'live'}
            loading={loading}
            onToggle={onLiveToggle}
          />
        </div>
      </section>

      <article className="wd-card wd-card-muted">
        <h3>{t('activity.title')}</h3>
        <p className="wd-muted">{t('dashboard.activityLead')}</p>
        <div className="wd-actions">
          <button type="button" className="fl-link-btn" onClick={onOpenActivity}>
            {t('progress.viewActivity')}
          </button>
        </div>
      </article>

      <div className="wd-actions wd-actions-wrap">
        <button type="button" className="fl-link-btn" onClick={onOpenSettings}>
          {t('dashboard.editSettings')}
        </button>
        {onReplayTour ? (
          <button type="button" className="fl-link-btn" onClick={onReplayTour}>
            {t('dashboard.replayTour')}
          </button>
        ) : null}
      </div>
    </div>
  )
}
