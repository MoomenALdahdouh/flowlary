import type { UsageUxView } from '@flowlary/shared'
import { openDashboard } from '../popup/openDashboard.ts'
import { openAccountPage, openUpgradePage } from '../config/upgrade.ts'
import { t } from '../popup/i18n/index.ts'
import { getShortcutLabels } from '../popup/shortcuts.ts'

type UsageStatusCardProps = {
  view: UsageUxView
  /** Compact for popup; full for dashboard. */
  compact?: boolean
  onSecondary?: () => void
  className?: string
}

function ctaLabel(view: UsageUxView): string | null {
  switch (view.primaryCta) {
    case 'upgrade':
      return t('usageCard.upgrade')
    case 'sign_in':
      return t('account.signIn')
    case 'manage_billing':
      return t('usageCard.manageBilling')
    case 'view_usage':
      return t('usageCard.viewUsage')
    case 'keep_writing':
    case 'none':
    default:
      return null
  }
}

function secondaryLabel(view: UsageUxView, compact: boolean): string | null {
  if (compact && !view.showUpgrade && view.secondaryCta === 'view_plan') return null
  switch (view.secondaryCta) {
    case 'keep_using':
      return t('usageCard.keepUsing')
    case 'continue_local':
      return t('usageCard.continueLocal')
    case 'compare_plans':
      return t('usageCard.comparePlans')
    case 'view_plan':
      return view.primaryCta === 'upgrade' ? t('usageCard.comparePlans') : t('usageCard.viewPro')
    default:
      return null
  }
}

function onPrimary(view: UsageUxView): void {
  if (view.primaryCta === 'upgrade' || view.primaryCta === 'view_usage') {
    openUpgradePage()
    return
  }
  if (view.primaryCta === 'sign_in') {
    openDashboard('account')
    return
  }
  if (view.primaryCta === 'manage_billing') {
    openAccountPage()
  }
}

/** Usage status card — shared by popup + dashboard. */
export function UsageStatusCard({ view, compact = false, onSecondary, className }: UsageStatusCardProps) {
  const primary = ctaLabel(view)
  const secondary = secondaryLabel(view, compact)
  const showProgress = view.progressPercent != null && !compact
  const showActions = Boolean(primary || secondary)
  const shortcuts = getShortcutLabels()
  const showLocalShortcuts =
    view.state === 'AI_USAGE_EXHAUSTED' || view.state === 'AI_TEMPORARILY_UNAVAILABLE'

  return (
    <section
      className={`fl-usage-card tone-${view.tone}${compact ? ' is-compact' : ''}${className ? ` ${className}` : ''}`}
      aria-labelledby="fl-usage-card-title"
      data-usage-state={view.state}
    >
      <div className="fl-usage-card-head">
        <p className="fl-usage-plan">{view.planLabel}</p>
        <h3 id="fl-usage-card-title" className="fl-usage-title">
          {view.title}
        </h3>
      </div>

      {view.assistsLabel ? <p className="fl-usage-assists">{view.assistsLabel}</p> : null}
      {view.description && (!compact || view.state !== 'AI_USAGE_HEALTHY') ? (
        <p className="fl-usage-desc">{view.description}</p>
      ) : null}
      {view.resetLabel ? (
        <p className="fl-usage-reset" role="status">
          {view.resetLabel}
        </p>
      ) : null}

      {showProgress ? (
        <div
          className="fl-usage-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={view.progressPercent ?? 0}
          aria-label={
            view.assistsLabel ??
            `${view.progressPercent ?? 0}% of today's AI writing checks remaining`
          }
        >
          <div className="fl-usage-progress-fill" style={{ width: `${view.progressPercent}%` }} />
        </div>
      ) : null}

      {view.localToolsNote ? <p className="fl-usage-local">{view.localToolsNote}</p> : null}

      {showLocalShortcuts ? (
        <p className="fl-usage-shortcuts" role="note">
          {t('usageCard.localShortcuts', {
            layout: shortcuts.fixLayout,
            speedBox: shortcuts.speedBox,
          })}
        </p>
      ) : null}

      {showActions ? (
        <div className="fl-usage-actions">
          {primary ? (
            <button
              type="button"
              className="fl-action-btn fl-action-btn-primary fl-action-btn-compact"
              onClick={() => onPrimary(view)}
            >
              {primary}
            </button>
          ) : null}
          {secondary ? (
            <button
              type="button"
              className="fl-link-btn"
              onClick={() => {
                if (onSecondary) {
                  onSecondary()
                  return
                }
                if (view.secondaryCta === 'compare_plans' || view.secondaryCta === 'view_plan') {
                  openUpgradePage()
                }
              }}
            >
              {secondary}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

type ProUpgradeCardProps = {
  className?: string
}

/** Prominent upgrade card — only when low / exhausted / trial ending / trial expired. */
export function ProUpgradeCard({ className }: ProUpgradeCardProps) {
  return (
    <section className={`fl-upgrade-card${className ? ` ${className}` : ''}`} aria-labelledby="fl-upgrade-card-title">
      <h3 id="fl-upgrade-card-title" className="fl-upgrade-title">
        {t('usageCard.upgradeTitle')}
      </h3>
      <p className="fl-upgrade-desc">{t('usageCard.upgradeDesc')}</p>
      <div className="fl-usage-actions">
        <button type="button" className="fl-action-btn fl-action-btn-primary" onClick={() => openUpgradePage()}>
          {t('usageCard.upgrade')}
        </button>
        <button type="button" className="fl-link-btn" onClick={() => openUpgradePage()}>
          {t('usageCard.comparePlans')}
        </button>
      </div>
    </section>
  )
}
