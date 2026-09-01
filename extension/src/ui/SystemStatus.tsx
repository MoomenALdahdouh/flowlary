import type { DomainState, FeatureState, FeatureStateKind } from './domainState.ts'
import { t } from '../popup/i18n/index.ts'
import { ToggleSwitch } from '../popup/components.tsx'

export function StatusBadge({ kind }: { kind: FeatureStateKind | 'active' | 'paused' | DomainState['ai'] }) {
  const label = statusBadgeLabel(kind)
  const tone = statusBadgeTone(kind)
  return (
    <span className={`fl-badge tone-${tone}`}>
      <span className="fl-status-dot" aria-hidden />
      {label}
    </span>
  )
}

function statusBadgeLabel(
  kind: FeatureStateKind | 'active' | 'paused' | DomainState['ai'],
): string {
  if (kind === 'active') return t('system.extensionActive')
  if (kind === 'paused') return t('system.extensionPaused')
  if (kind === 'available') return t('system.aiAvailable')
  if (kind === 'temporarily_unavailable') return t('system.serviceUnavailable')
  if (kind === 'requires_consent') return t('system.aiConsent')
  if (kind === 'requires_auth') return t('readiness.signInRequired')
  if (kind === 'loading') return t('connection.checking')
  const key = kind as FeatureStateKind
  if (key === 'ready') return t('readiness.ready')
  if (key === 'disabled') return t('readiness.off')
  if (key === 'locked') return t('readiness.locked')
  if (key === 'paused') return t('readiness.paused')
  if (key === 'requires_consent') return t('readiness.consentRequired')
  if (key === 'requires_auth') return t('readiness.signInRequired')
  if (key === 'requires_setup') return t('readiness.setup')
  return t('readiness.unavailable')
}

function statusBadgeTone(
  kind: FeatureStateKind | 'active' | 'paused' | DomainState['ai'],
): 'ok' | 'warn' | 'muted' | 'locked' {
  if (kind === 'active' || kind === 'available' || kind === 'ready') return 'ok'
  if (kind === 'locked') return 'locked'
  if (kind === 'paused' || kind === 'disabled' || kind === 'loading') return 'muted'
  return 'warn'
}

export function featureReason(feature: FeatureState): string | null {
  if (!feature.reasonKey) return null
  const map: Record<string, string> = {
    paused: t('featureReason.paused'),
    usage_exhausted: t('featureReason.usageExhausted'),
    service_unavailable: t('featureReason.serviceUnavailable'),
    sign_in_required: t('featureReason.signInRequired'),
    consent_required: t('featureReason.consentRequired'),
    loading: t('connection.checking'),
  }
  return map[feature.reasonKey] ?? null
}

type SystemStatusProps = {
  domain: DomainState
  loading: boolean
  busy: boolean
  showExtensionToggle?: boolean
  onExtensionToggle?: (next: boolean) => void
  compact?: boolean
}

export function SystemStatusBlock({
  domain,
  loading,
  busy,
  showExtensionToggle = false,
  onExtensionToggle,
  compact = false,
}: SystemStatusProps) {
  const extensionKind = domain.extension === 'active' ? 'active' : domain.extension === 'paused' ? 'paused' : 'paused'

  return (
    <section
      className={`fl-system-status${compact ? ' is-compact' : ''}`}
      aria-labelledby="system-status-heading"
    >
      <h2 id="system-status-heading" className="visually-hidden">
        {t('system.title')}
      </h2>
      <div className="fl-system-rows">
        <div className="fl-system-row">
          <div className="fl-system-copy">
            <p className="fl-system-label">{t('brand.name')}</p>
            <StatusBadge kind={extensionKind} />
            {!compact ? (
              <p className="fl-system-desc">
                {loading
                  ? t('connection.checking')
                  : domain.extension === 'active'
                    ? t('system.extensionRunning')
                    : t('system.extensionPausedDesc')}
              </p>
            ) : null}
          </div>
          {showExtensionToggle && onExtensionToggle ? (
            <ToggleSwitch
              id="toggle-extension-system"
              label={t('master.toggleLabel')}
              checked={domain.extension === 'active'}
              disabled={loading || domain.extension === 'loading'}
              busy={busy}
              onChange={onExtensionToggle}
            />
          ) : null}
        </div>
        <div className="fl-system-row">
          <div className="fl-system-copy">
            <p className="fl-system-label">{t('system.flowlaryAi')}</p>
            <StatusBadge kind={domain.ai} />
            {!compact ? <p className="fl-system-desc">{flowlaryAiDescription(domain)}</p> : null}
          </div>
        </div>
      </div>
    </section>
  )
}

function flowlaryAiDescription(domain: DomainState): string {
  if (domain.ai === 'loading') return t('connection.checking')
  if (domain.ai === 'requires_auth') return t('system.aiSignInDesc')
  if (domain.ai === 'requires_consent') return t('system.aiConsentDesc')
  if (domain.ai === 'temporarily_unavailable') return t('system.serviceUnavailableDesc')
  return t('system.aiAvailableDesc')
}

function headerStatusLabel(domain: DomainState): string {
  if (domain.extension === 'loading') return t('connection.checking')
  if (domain.extension === 'paused') return t('system.extensionPaused')
  if (domain.ai === 'requires_auth') return t('system.headerSignInRequired')
  if (domain.ai === 'requires_consent') return t('system.headerConsentRequired')
  if (domain.ai === 'temporarily_unavailable') return t('system.headerServiceUnavailable')
  return t('system.headerReady')
}

export function HeaderStatusPill({ domain }: { domain: DomainState | null }) {
  if (!domain) {
    return (
      <span className="fl-connection tone-checking" role="status">
        <span className="fl-status-dot" aria-hidden />
        <span className="fl-connection-label">{t('connection.checking')}</span>
      </span>
    )
  }

  const ready =
    domain.extension === 'active' &&
    (domain.ai === 'available' || domain.features.layout.kind === 'ready')

  const tone =
    domain.extension === 'paused' || domain.extension === 'loading'
      ? 'muted'
      : ready
        ? 'connected'
        : 'warn'

  return (
    <span className={`fl-connection tone-${tone}`} role="status">
      <span className={`fl-status-dot${tone === 'connected' ? ' is-active' : ''}`} aria-hidden />
      <span className="fl-connection-label">{headerStatusLabel(domain)}</span>
    </span>
  )
}
