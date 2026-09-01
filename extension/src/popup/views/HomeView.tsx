import type { ExtensionStatus } from '../../messaging/types.ts'
import { SUPPORTED_LANGUAGES } from '../../features/translation/languages.ts'
import type { DomainState } from '../../ui/domainState.ts'
import { FeatureControl, quickActionAvailable } from '../../ui/FeatureControl.tsx'
import { SystemStatusBlock } from '../../ui/SystemStatus.tsx'
import { ShortcutKey } from '../../ui/shared.tsx'
import { UsageStatusCard } from '../../ui/UsageStatusCard.tsx'
import { resolveUsageUxFromStatus } from '../../ui/usageUx.ts'
import { ToggleSwitch } from '../components.tsx'
import { t } from '../i18n/index.ts'
import type { DashboardSection } from '../../config/dashboard.ts'
import { getShortcutLabels } from '../shortcuts.ts'
import { formatLanguagePair } from '../status.ts'

type HomeViewProps = {
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
  onHelpStyleChange?: (next: 'auto' | 'suggestions' | 'shortcuts_only') => void
  onSiteExcludedChange?: (next: boolean) => void
  onAiAdvisorToggle?: (next: boolean) => void
  onWritingReviewToggle?: (next: boolean) => void
  onAcceptManaged: () => void
  onOpenDashboard: (section?: DashboardSection) => void
  onDispatchCorrect: () => void
  onDispatchTranslate: () => void
  onDispatchLayout: () => void
  /** When false, hide sign-in banner (e.g. after first local win). */
  showSignInBanner?: boolean
}

function languageName(code: string): string {
  return SUPPORTED_LANGUAGES.find((item) => item.code === code)?.name ?? code.toUpperCase()
}

export function HomeView({
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
  onHelpStyleChange,
  onSiteExcludedChange,
  onAiAdvisorToggle,
  onWritingReviewToggle,
  onAcceptManaged,
  onOpenDashboard,
  onDispatchCorrect,
  onDispatchTranslate,
  onDispatchLayout,
  showSignInBanner = true,
}: HomeViewProps) {
  const shortcuts = getShortcutLabels()
  const usage = resolveUsageUxFromStatus(status)
  const showUsageCard =
    usage.state !== 'AI_USAGE_HEALTHY' &&
    usage.state !== 'AI_PRO_ACTIVE' &&
    usage.state !== 'AI_TRIAL_ACTIVE'
  const languagePair = formatLanguagePair(
    status.translation.sourceLanguage,
    status.translation.targetLanguage,
    languageName(status.translation.sourceLanguage),
    languageName(status.translation.targetLanguage),
  )

  const correctAction = quickActionAvailable(domain.features.correction, status.active)
  const translateAction = quickActionAvailable(domain.features.translation, status.active)
  const layoutAction = quickActionAvailable(domain.features.layout, status.active)

  const aiStripTone =
    usage.state === 'AI_USAGE_EXHAUSTED' ||
    usage.state === 'AI_PRO_SOFT_LIMIT' ||
    usage.state === 'BILLING_ATTENTION'
      ? 'exhausted'
      : usage.state === 'AI_TEMPORARILY_UNAVAILABLE'
        ? 'unavailable'
        : usage.state === 'AI_USAGE_LOW' || usage.state === 'AI_TRIAL_ENDING'
          ? 'working'
          : 'ready'

  return (
    <>
      <p className="fl-assistant-daily">{t('assistant.dailyLead')}</p>
      <SystemStatusBlock
        compact
        domain={domain}
        loading={loading}
        busy={busy === 'global'}
        showExtensionToggle
        onExtensionToggle={onGlobalToggle}
      />

      {onSiteExcludedChange ? (
        <section className="fl-section" aria-labelledby="site-control-heading">
          <h2 id="site-control-heading" className="fl-section-label">
            {status.pageHostname ?? t('settings.excludedSites')}
          </h2>
          {status.pageHostname ? (
            <>
              <p className="fl-settings-desc">
                {status.pageExcluded
                  ? t('site.pausedHint', { host: status.pageHostname })
                  : t('site.activeHint', { host: status.pageHostname })}
              </p>
              <button
                type="button"
                className="fl-action-btn fl-action-btn-compact fl-action-btn-secondary"
                disabled={loading || busy === 'site'}
                onClick={() => onSiteExcludedChange(!status.pageExcluded)}
              >
                {status.pageExcluded ? t('site.resume') : t('site.pause')}
              </button>
            </>
          ) : (
            <p className="fl-settings-desc">{t('site.unsupportedHint')}</p>
          )}
        </section>
      ) : null}

      {!status.account.signedIn && showSignInBanner ? (
        <div className="fl-signin-banner">
          <p>{t('account.signInHint')}</p>
          <button
            type="button"
            className="fl-action-btn fl-action-btn-compact fl-action-btn-primary"
            onClick={() => onOpenDashboard('account')}
          >
            {t('account.popupSignInCta')}
          </button>
        </div>
      ) : null}

      <section className="fl-section" aria-labelledby="actions-heading">
        <h2 id="actions-heading" className="fl-section-label">
          {t('actions.section')}
        </h2>
        <div className="fl-quick-actions">
          <div className="fl-quick-action">
            {correctAction.available ? (
              <button
                type="button"
                className="fl-action-btn fl-action-btn-primary fl-quick-action-btn"
                disabled={busy === 'cmd-correct'}
                onClick={onDispatchCorrect}
              >
                <span>{t('actions.fixWriting')}</span>
                <ShortcutKey label={shortcuts.fixWriting} />
              </button>
            ) : (
              <p className="fl-action-unavailable">
                <span className="fl-action-unavailable-label">{t('actions.fixWriting')}</span>
                <span className="fl-action-unavailable-reason">{correctAction.reason}</span>
              </p>
            )}
          </div>
          <div className="fl-quick-action">
            {translateAction.available ? (
              <button
                type="button"
                className="fl-action-btn fl-action-btn-secondary fl-quick-action-btn"
                disabled={busy === 'cmd-translate'}
                onClick={onDispatchTranslate}
              >
                <span>{t('actions.translate')}</span>
                <ShortcutKey label={shortcuts.translate} />
              </button>
            ) : (
              <p className="fl-action-unavailable">
                <span className="fl-action-unavailable-label">{t('actions.translate')}</span>
                <span className="fl-action-unavailable-reason">{translateAction.reason}</span>
              </p>
            )}
          </div>
          <div className="fl-quick-action">
            {layoutAction.available ? (
              <button
                type="button"
                className="fl-action-btn fl-action-btn-secondary fl-quick-action-btn"
                disabled={busy === 'cmd-layout'}
                onClick={onDispatchLayout}
              >
                <span>{t('actions.fixLayout')}</span>
                <ShortcutKey label={shortcuts.fixLayout} />
              </button>
            ) : (
              <p className="fl-action-unavailable">
                <span className="fl-action-unavailable-label">{t('actions.fixLayout')}</span>
                <span className="fl-action-unavailable-reason">{layoutAction.reason}</span>
              </p>
            )}
          </div>
        </div>
        <p className="fl-shortcut-note">
          {t('popup.correctionShortcutHint', {
            shortcut: shortcuts.fixWriting,
            speedBox: shortcuts.speedBox,
          })}
        </p>
      </section>

      {showUsageCard ? (
        <UsageStatusCard view={usage} compact className="fl-popup-usage" />
      ) : (
        <p
          className={`fl-ai-strip is-${aiStripTone}`}
          role="status"
          data-usage-state={usage.state}
        >
          <span className="fl-ai-strip-label">{t('usage.title')}</span>
          <span className="fl-ai-strip-value">{usage.compactLine}</span>
        </p>
      )}

      <section className="fl-section" aria-labelledby="features-heading">
        <h2 id="features-heading" className="fl-section-label">
          {t('features.section')}
        </h2>
        <p className="fl-settings-desc">{t('assistant.lead')}</p>
        {onHelpStyleChange ? (
          <div className="fl-mode-switch" role="radiogroup" aria-label={t('assistant.helpStyleLabel')}>
            {(['auto', 'suggestions', 'shortcuts_only'] as const).map((style) => (
              <button
                key={style}
                type="button"
                role="radio"
                aria-checked={(status.writingPolicy?.helpStyle ?? 'auto') === style}
                className={(status.writingPolicy?.helpStyle ?? 'auto') === style ? 'is-active' : ''}
                disabled={loading || busy === 'help-style'}
                onClick={() => onHelpStyleChange(style)}
              >
                <span className="fl-mode-title">{t(`assistant.style.${style}`)}</span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="fl-compact-stack">
          <FeatureControl
            compact
            featureKey="layout"
            title={t('features.layout')}
            description={t('features.layoutDesc')}
            feature={domain.features.layout}
            toggleId="toggle-layout"
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
            toggleId="toggle-correction"
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
            toggleId="toggle-live"
            busy={busy === 'live'}
            loading={loading}
            onToggle={onLiveToggle}
          />
          {onAiAdvisorToggle ? (
            <p className="fl-settings-row">
              <span>
                <strong>{t('features.aiAdvisor')}</strong>
                <span className="fl-settings-desc">{t('features.aiAdvisorDesc')}</span>
              </span>
              <ToggleSwitch
                id="toggle-ai-advisor"
                label={t('features.aiAdvisor')}
                checked={status.writingPolicy?.aiAdvisorEnabled !== false}
                busy={busy === 'ai-advisor'}
                disabled={loading}
                onChange={onAiAdvisorToggle}
              />
            </p>
          ) : null}
          {onWritingReviewToggle ? (
            <p className="fl-settings-row">
              <span>
                <strong>{t('features.aiWritingReview')}</strong>
                <span className="fl-settings-desc">{t('features.aiWritingReviewDesc')}</span>
              </span>
              <ToggleSwitch
                id="toggle-writing-review"
                label={t('features.aiWritingReview')}
                checked={status.writingPolicy?.aiWritingReviewEnabled !== false}
                busy={busy === 'writing-review'}
                disabled={loading}
                onChange={onWritingReviewToggle}
              />
            </p>
          ) : null}
        </div>
      </section>
    </>
  )
}
