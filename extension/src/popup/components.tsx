import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { FLOWLARY_MARK } from '@flowlary/shared'
import { subscribeSystemTheme, syncDocumentTheme, toggleTheme } from '@flowlary/shared/theme'
import { t } from './i18n/index.ts'

export function PopupLogo() {
  return (
    <svg className="fl-logo" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx={FLOWLARY_MARK.radius} fill="var(--fl-accent, #5b8cff)" />
      <path d={FLOWLARY_MARK.f} fill="var(--fl-on-accent, #061018)" />
      <rect
        x={FLOWLARY_MARK.caret.x}
        y={FLOWLARY_MARK.caret.y}
        width={FLOWLARY_MARK.caret.width}
        height={FLOWLARY_MARK.caret.height}
        rx={FLOWLARY_MARK.caret.rx}
        fill="var(--fl-on-accent, #061018)"
      />
    </svg>
  )
}

export function ThemeToggle() {
  useEffect(() => {
    syncDocumentTheme()
    return subscribeSystemTheme()
  }, [])

  return (
    <button type="button" className="fl-theme-toggle" aria-label={t('settings.theme')} onClick={() => toggleTheme()}>
      <svg className="fl-theme-icon fl-theme-icon-sun" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 3.2v1.8M12 19v1.8M4.9 4.9l1.3 1.3M17.8 17.8l1.3 1.3M3.2 12H5M19 12h1.8M4.9 19.1l1.3-1.3M17.8 6.2l1.3-1.3" />
      </svg>
      <svg className="fl-theme-icon fl-theme-icon-moon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M15.2 4.2a7.4 7.4 0 1 0 4.6 12.9 6.2 6.2 0 0 1-8.3-8.4 7.3 7.3 0 0 0 3.7-4.5Z" />
      </svg>
    </button>
  )
}

export function AccountAvatar({
  email,
  signedIn,
  onClick,
}: {
  email: string | null
  signedIn: boolean
  onClick: () => void
}) {
  const initials = signedIn && email ? email.slice(0, 1).toUpperCase() : '·'
  return (
    <button type="button" className="fl-avatar" onClick={onClick} aria-label={t('account.title')}>
      {initials}
    </button>
  )
}

type ToggleSwitchProps = {
  id: string
  checked: boolean
  disabled?: boolean
  busy?: boolean
  label: string
  onChange: (next: boolean) => void
}

export function ToggleSwitch({
  id,
  checked,
  disabled,
  busy,
  label,
  onChange,
}: ToggleSwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`fl-toggle${checked ? ' is-on' : ''}${disabled ? ' is-disabled' : ''}`}
      disabled={disabled || busy}
      onClick={() => onChange(!checked)}
    >
      <span className="fl-toggle-track" aria-hidden>
        <span className="fl-toggle-thumb" />
      </span>
    </button>
  )
}

function FeatureIcon({ kind }: { kind: 'correction' | 'translation' | 'layout' }) {
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

type FeatureCardProps = {
  kind: 'correction' | 'translation' | 'layout'
  title: string
  description: string
  meta?: string
  status?: string
  statusTone?: 'ok' | 'warn' | 'muted' | 'locked'
  toggle?: ReactNode
  children?: ReactNode
  primary?: boolean
}

export function FeatureCard({
  kind,
  title,
  description,
  meta,
  status,
  statusTone = 'ok',
  toggle,
  children,
  primary,
}: FeatureCardProps) {
  return (
    <article className={`fl-card${primary ? ' fl-card-primary' : ''}`}>
      <div className="fl-card-head">
        <div className="fl-card-copy">
          <div className="fl-card-title-row">
            <span className="fl-card-icon">
              <FeatureIcon kind={kind} />
            </span>
            <div>
              <h3 className="fl-card-title">{title}</h3>
              <p className="fl-card-desc">{description}</p>
            </div>
          </div>
          {meta ? <p className="fl-card-meta">{meta}</p> : null}
        </div>
        {toggle}
      </div>
      {status ? (
        <div className="fl-card-foot">
          <span className={`fl-badge tone-${statusTone}`}>
            <span className="fl-status-dot" aria-hidden />
            {status}
          </span>
        </div>
      ) : null}
      {children ? <div className="fl-card-extra">{children}</div> : null}
    </article>
  )
}

type ConnectionIndicatorProps = {
  state: 'checking' | 'connected' | 'unavailable'
  authHint?: boolean
}

export function ConnectionIndicator({ state, authHint }: ConnectionIndicatorProps) {
  const label =
    state === 'checking'
      ? t('connection.checking')
      : state === 'unavailable'
        ? t('connection.unavailable')
        : authHint
          ? t('connection.authRequired')
          : t('connection.connected')

  return (
    <span className={`fl-connection tone-${state}${authHint ? ' tone-auth' : ''}`} role="status">
      <span className={`fl-status-dot${state === 'connected' && !authHint ? ' is-active' : ''}`} aria-hidden />
      <span className="fl-connection-label">{label}</span>
    </span>
  )
}

type CompactFeatureRowProps = {
  title: string
  meta?: string
  statusTone?: 'ok' | 'warn' | 'muted' | 'locked'
  toggle?: ReactNode
  children?: ReactNode
}

export function CompactFeatureRow({
  title,
  meta,
  statusTone = 'ok',
  toggle,
  children,
}: CompactFeatureRowProps) {
  return (
    <article className="fl-compact-row">
      <div className="fl-compact-head">
        <div className="fl-compact-copy">
          <h3 className="fl-compact-title">{title}</h3>
          {meta ? <p className={`fl-compact-meta tone-${statusTone}`}>{meta}</p> : null}
        </div>
        {toggle}
      </div>
      {children ? <div className="fl-compact-extra">{children}</div> : null}
    </article>
  )
}

type MasterBannerProps = {
  active: boolean
  summary: string
  summaryTone: 'ok' | 'warn' | 'muted'
  loading: boolean
  busy: boolean
  onToggle: (next: boolean) => void
}

export function MasterBanner({
  active,
  summary,
  summaryTone,
  loading,
  busy,
  onToggle,
}: MasterBannerProps) {
  return (
    <section
      className={`fl-master-banner tone-${summaryTone}`}
      aria-labelledby="master-banner-title"
    >
      <div className="fl-master-copy">
        <h2 id="master-banner-title" className="fl-master-title">
          {active ? t('master.enabled') : t('master.paused')}
        </h2>
        <p className="fl-master-sub">{loading ? t('connection.checking') : summary}</p>
      </div>
      <ToggleSwitch
        id="toggle-global-master"
        label={t('master.toggleLabel')}
        checked={active}
        disabled={loading}
        busy={busy}
        onChange={onToggle}
      />
    </section>
  )
}

type StatusStripProps = {
  planLabel: string
  usageLabel: string
  correctionAi: string | null
  signedIn: boolean
  email: string | null
  billingAvailable: boolean
  isPro: boolean
  onOpenAccount: () => void
  onOpenBilling?: () => void
  onRefresh?: () => void
  refreshBusy?: boolean
}

export function StatusStrip({
  planLabel,
  usageLabel,
  correctionAi,
  signedIn,
  email,
  billingAvailable,
  isPro,
  onOpenAccount,
  onOpenBilling,
  onRefresh,
  refreshBusy,
}: StatusStripProps) {
  return (
    <section className="fl-section" aria-labelledby="status-strip-heading">
      <h2 id="status-strip-heading" className="fl-section-label">
        {t('status.title')}
      </h2>
      <div className="fl-status-strip">
        <div className="fl-stat">
          <span className="fl-stat-label">{signedIn ? t('account.serverPlan') : t('account.clientPlan')}</span>
          <span className="fl-stat-value">{planLabel}</span>
        </div>
        <div className="fl-stat">
          <span className="fl-stat-label">{t('usage.title')}</span>
          <span className="fl-stat-value">{usageLabel}</span>
        </div>
        <div className="fl-stat">
          <span className="fl-stat-label">{t('ai.title')}</span>
          <span className="fl-stat-value">{correctionAi ?? '…'}</span>
        </div>
      </div>
      <div className="fl-account-bar">
        {signedIn ? (
          <>
            <strong title={email ?? undefined}>{email}</strong>
            <div className="fl-account-actions">
              {onOpenBilling ? (
                <button type="button" className="fl-action-btn fl-action-btn-compact" onClick={onOpenBilling}>
                  {isPro ? t('account.manageSubscription') : billingAvailable ? t('account.upgradeToPro') : t('account.billingUnavailable')}
                </button>
              ) : null}
              {onRefresh ? (
                <button
                  type="button"
                  className="fl-action-btn fl-action-btn-compact fl-action-btn-muted"
                  disabled={refreshBusy}
                  onClick={onRefresh}
                >
                  {t('account.refresh')}
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <span>{t('account.signedOut')}</span>
            <div className="fl-account-actions">
              <button type="button" className="fl-action-btn fl-action-btn-compact fl-action-btn-primary" onClick={onOpenAccount}>
                {t('account.signIn')}
              </button>
              <button type="button" className="fl-action-btn fl-action-btn-compact" onClick={onOpenAccount}>
                {t('account.createAccount')}
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

/** @deprecated Use StatusStrip — kept for tests importing AiAccountCard name if any */
export const AiAccountCard = StatusStrip
