import type { ExtensionStatus } from '../../messaging/types.ts'
import type { DomainState } from '../../ui/domainState.ts'
import { quickActionAvailable } from '../../ui/FeatureControl.tsx'
import { SystemStatusBlock } from '../../ui/SystemStatus.tsx'
import { ShortcutKey } from '../../ui/shared.tsx'
import { openWebsiteAccount } from '../../config/upgrade.ts'
import { t } from '../i18n/index.ts'
import type { DashboardSection } from '../../config/dashboard.ts'
import { getShortcutLabels } from '../shortcuts.ts'
import { resolveUsageUxFromStatus } from '../../ui/usageUx.ts'

type HomeViewProps = {
  status: ExtensionStatus
  domain: DomainState
  loading: boolean
  busy: string | null
  onGlobalToggle: (next: boolean) => void
  onSiteExcludedChange?: (next: boolean) => void
  onOpenDashboard: (section?: DashboardSection) => void
  onDispatchCorrect: () => void
  onDispatchTranslate: () => void
  onDispatchLayout: () => void
  showSignInBanner?: boolean
}

export function HomeView({
  status,
  domain,
  loading,
  busy,
  onGlobalToggle,
  onSiteExcludedChange,
  onOpenDashboard,
  onDispatchCorrect,
  onDispatchTranslate,
  onDispatchLayout,
  showSignInBanner = true,
}: HomeViewProps) {
  const shortcuts = getShortcutLabels()
  const usage = resolveUsageUxFromStatus(status)

  const correctAction = quickActionAvailable(domain.features.correction, status.active)
  const translateAction = quickActionAvailable(domain.features.translation, status.active)
  const layoutAction = quickActionAvailable(domain.features.layout, status.active)

  const usageTone =
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
    <div className="fl-popup-stack">
      <article className="fl-popup-card">
        <SystemStatusBlock
          compact
          domain={domain}
          loading={loading}
          busy={busy === 'global'}
          showExtensionToggle
          onExtensionToggle={onGlobalToggle}
        />
      </article>

      {onSiteExcludedChange && status.pageHostname ? (
        <article className="fl-popup-card fl-popup-site">
          <div className="fl-popup-site-row">
            <span className="fl-popup-site-host">{status.pageHostname}</span>
            <button
              type="button"
              className="fl-action-btn fl-action-btn-compact fl-action-btn-secondary"
              disabled={loading || busy === 'site'}
              onClick={() => onSiteExcludedChange(!status.pageExcluded)}
            >
              {status.pageExcluded ? t('site.resume') : t('site.pause')}
            </button>
          </div>
        </article>
      ) : null}

      {!status.account.signedIn && showSignInBanner ? (
        <article className="fl-popup-card fl-popup-signin">
          <p className="fl-popup-signin-copy">{t('account.popupSignInShort')}</p>
          <button
            type="button"
            className="fl-action-btn fl-action-btn-compact fl-action-btn-primary"
            onClick={() => openWebsiteAccount('login')}
          >
            {t('account.signIn')}
          </button>
        </article>
      ) : null}

      <section className="fl-popup-card" aria-labelledby="actions-heading">
        <h2 id="actions-heading" className="fl-popup-kicker">
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
        <p className="fl-popup-speed-hint">
          {t('popup.speedBoxHint', { shortcut: shortcuts.speedBox })}
        </p>
      </section>

      <p className={`fl-ai-strip is-${usageTone}`} role="status" data-usage-state={usage.state}>
        <span className="fl-ai-strip-value">{usage.compactLine}</span>
      </p>

      <div className="fl-popup-links">
        <button type="button" className="fl-link-btn" onClick={() => onOpenDashboard('settings')}>
          {t('popup.settingsLink')}
        </button>
      </div>
    </div>
  )
}
