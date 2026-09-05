import type { ExtensionStatus } from '../../messaging/types.ts'
import type { DomainState } from '../../ui/domainState.ts'
import { quickActionAvailable } from '../../ui/FeatureControl.tsx'
import { ShortcutKey } from '../../ui/shared.tsx'
import { openWebsiteAccount } from '../../config/upgrade.ts'
import { t } from '../i18n/index.ts'
import { getShortcutLabels } from '../shortcuts.ts'
import { isLayoutFeatureOn } from '../status.ts'
import { resolveUsageUxFromStatus } from '../../ui/usageUx.ts'
import { ToggleSwitch } from '../components.tsx'

type HomeViewProps = {
  status: ExtensionStatus
  domain: DomainState
  loading: boolean
  busy: string | null
  onGlobalToggle: (next: boolean) => void
  onSiteExcludedChange?: (next: boolean) => void
  onDispatchCorrect: () => void
  onDispatchTranslate: () => void
  onDispatchLayout: () => void
  showSignInBanner?: boolean
}

function ActionGlyph({ kind }: { kind: 'correction' | 'translation' | 'layout' }) {
  if (kind === 'correction') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
        <path d="m13.5 6.5 3 3" />
      </svg>
    )
  }
  if (kind === 'translation') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m5 8 6 6" />
        <path d="m4 14 6 6 7-3" />
        <path d="M2 5h12M7 2v3M17 14h5M19.5 11v3" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />
    </svg>
  )
}

export function HomeView({
  status,
  domain,
  loading,
  busy,
  onGlobalToggle,
  onSiteExcludedChange,
  onDispatchCorrect,
  onDispatchTranslate,
  onDispatchLayout,
  showSignInBanner = true,
}: HomeViewProps) {
  const shortcuts = getShortcutLabels()
  const usage = resolveUsageUxFromStatus(status)
  const dailyLimit = status.entitlement.dailyLimit || 0
  const used = status.entitlement.creditsUsed ?? (dailyLimit > 0 ? Math.max(0, dailyLimit - (status.entitlement.creditsRemaining ?? 0)) : 0)
  const usagePct = usage.progressPercent ?? (dailyLimit > 0 ? Math.min(100, Math.round((used / dailyLimit) * 100)) : 0)

  const correctAction = quickActionAvailable(domain.features.correction, status.active)
  const translateAction = quickActionAvailable(domain.features.translation, status.active)
  // Match Settings Layout toggle (fixWrongTyping), including Shortcuts only where autoEnabled is off.
  const layoutAction =
    status.active && isLayoutFeatureOn(status)
      ? { available: true, reason: null as string | null }
      : quickActionAvailable(domain.features.layout, status.active)
  const extensionOn = domain.extension === 'active'

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

  const actions = [
    {
      kind: 'layout' as const,
      label: t('shortcuts.fixLayout'),
      shortcut: shortcuts.fixLayout,
      available: layoutAction.available,
      reason: layoutAction.reason,
      busy: busy === 'cmd-layout',
      onClick: onDispatchLayout,
    },
    {
      kind: 'translation' as const,
      label: t('shortcuts.translate'),
      shortcut: shortcuts.translate,
      available: translateAction.available,
      reason: translateAction.reason,
      busy: busy === 'cmd-translate',
      onClick: onDispatchTranslate,
    },
    {
      kind: 'correction' as const,
      label: t('shortcuts.fixWriting'),
      shortcut: shortcuts.fixWriting,
      available: correctAction.available,
      reason: correctAction.reason,
      busy: busy === 'cmd-correct',
      onClick: onDispatchCorrect,
    },
  ]

  return (
    <div className="fl-popup-stack">
      <div className="fl-zip-row">
        <div className="fl-zip-row-copy">
          <span className="fl-zip-row-title">{t('popup.helpOn')}</span>
        </div>
        <ToggleSwitch
          id="toggle-extension-home"
          label={t('master.toggleLabel')}
          checked={extensionOn}
          disabled={loading || domain.extension === 'loading'}
          busy={busy === 'global'}
          onChange={onGlobalToggle}
        />
      </div>

      {onSiteExcludedChange && status.pageHostname ? (
        <div className="fl-zip-row fl-popup-site">
          <div className="fl-zip-row-copy">
            <span className="fl-zip-row-title">{t('popup.thisSite')}</span>
            <span className="fl-popup-site-host">{status.pageHostname}</span>
          </div>
          <ToggleSwitch
            id="toggle-site-home"
            label={status.pageExcluded ? t('site.resume') : t('site.pause')}
            checked={!status.pageExcluded}
            disabled={loading || busy === 'site'}
            busy={busy === 'site'}
            onChange={(next) => onSiteExcludedChange(!next)}
          />
        </div>
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

      <section aria-labelledby="actions-heading">
        <h2 id="actions-heading" className="visually-hidden">
          {t('actions.section')}
        </h2>
        <div className="fl-quick-actions">
          {actions.map((action) => (
            <button
              key={action.kind}
              type="button"
              className={`fl-zip-action${action.available ? '' : ' is-off'}`}
              disabled={!action.available || action.busy}
              title={action.available ? undefined : (action.reason ?? undefined)}
              aria-label={
                action.available
                  ? `${action.label}, ${action.shortcut}`
                  : `${action.label}, ${action.reason ?? t('readiness.off')}, ${action.shortcut}`
              }
              onClick={action.onClick}
            >
              <span className="fl-zip-action-icon">
                <ActionGlyph kind={action.kind} />
              </span>
              <span className="fl-zip-action-label">
                {action.label}
                {!action.available ? (
                  <span className="fl-zip-action-state">{action.reason ?? t('readiness.off')}</span>
                ) : null}
              </span>
              <ShortcutKey label={action.shortcut} />
            </button>
          ))}
        </div>
        <p className="fl-popup-speed-hint">
          {t('popup.speedBoxHint', { shortcut: shortcuts.speedBox })}
        </p>
      </section>

      <div className={`fl-zip-usage is-${usageTone}`} role="status" data-usage-state={usage.state}>
        <div className="fl-zip-usage-head">
          <span>{t('popup.aiChecks')}</span>
          {dailyLimit > 0 ? (
            <span>
              {used} / {dailyLimit}
            </span>
          ) : (
            <span>{usage.compactLine}</span>
          )}
        </div>
        {dailyLimit > 0 ? (
          <div className="fl-zip-usage-track">
            <div className="fl-zip-usage-fill" style={{ width: `${usagePct}%` }} />
          </div>
        ) : null}
        <p className="fl-zip-usage-note">{usage.localToolsNote ?? t('popup.layoutNoChecks')}</p>
      </div>
    </div>
  )
}
