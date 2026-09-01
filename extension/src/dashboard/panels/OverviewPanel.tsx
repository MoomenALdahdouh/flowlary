import { ComposeWorkbench } from '../components/ComposeWorkbench.tsx'
import { DailyBriefCard } from '../components/DailyBriefCard.tsx'
import { LearningCoachCard } from '../components/LearningCoachCard.tsx'
import { LearningSetupCard } from '../components/LearningCards.tsx'
import { SignInPromptBanner } from '../components/SignInPromptBanner.tsx'
import type { ExtensionStatus } from '../../messaging/types.ts'
import { SUPPORTED_LANGUAGES } from '../../features/translation/languages.ts'
import type { DomainState } from '../../ui/domainState.ts'
import { FeatureControl } from '../../ui/FeatureControl.tsx'
import { SystemStatusBlock } from '../../ui/SystemStatus.tsx'
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
  onReplayTour,
}: OverviewPanelProps) {
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
    <div className="fl-dash-page">
      <SystemStatusBlock
        compact
        domain={domain}
        loading={loading}
        busy={busy === 'global'}
        showExtensionToggle
        onExtensionToggle={onGlobalToggle}
      />

      {!signedIn ? <SignInPromptBanner onOpenAccount={onOpenAccount} /> : null}

      {signedIn ? <UsageStatusCard view={usage} compact /> : null}

      {signedIn && showUpgradeCard ? <ProUpgradeCard /> : null}

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
        <div className="fl-overview-learn">
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
      ) : null}

      <section className="fl-dash-card fl-section" aria-labelledby="dash-features-heading" data-tour="features">
        <h3 id="dash-features-heading" className="fl-section-label">
          {t('features.section')}
        </h3>
        <p className="fl-settings-desc">{t('assistant.lead')}</p>
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

      <p className="fl-overview-links">
        <button type="button" className="fl-link-btn" onClick={onOpenSettings}>
          {t('dashboard.editSettings')}
        </button>
        <a href={`${FLOWLARY_SITE_URL}/#writing-lab`} target="_blank" rel="noreferrer">
          {t('dashboard.openWritingLab')}
        </a>
        {onReplayTour ? (
          <button type="button" className="fl-link-btn" onClick={onReplayTour}>
            {t('dashboard.replayTour')}
          </button>
        ) : null}
      </p>
    </div>
  )
}
