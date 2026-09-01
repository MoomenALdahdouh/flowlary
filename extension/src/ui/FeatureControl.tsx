import type { ReactNode } from 'react'
import type { FeatureKey, FeatureState, FeatureStateKind } from './domainState.ts'
import { StatusBadge, featureReason } from './SystemStatus.tsx'
import { ToggleSwitch } from '../popup/components.tsx'
import { t } from '../popup/i18n/index.ts'

function featureTone(kind: FeatureStateKind): 'ok' | 'warn' | 'muted' | 'locked' {
  if (kind === 'ready') return 'ok'
  if (kind === 'locked') return 'locked'
  if (kind === 'disabled' || kind === 'paused') return 'muted'
  return 'warn'
}

type FeatureControlProps = {
  featureKey: FeatureKey
  title: string
  description?: string
  meta?: string
  feature: FeatureState
  toggleId: string
  busy?: boolean
  loading?: boolean
  onToggle: (next: boolean) => void
  action?: ReactNode
  children?: ReactNode
  compact?: boolean
}

function FeatureIcon({ kind }: { kind: FeatureKey }) {
  if (kind === 'correction') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
        <path d="m13.5 6.5 3 3" />
      </svg>
    )
  }
  if (kind === 'translation' || kind === 'liveTranslation') {
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

export function FeatureControl({
  featureKey,
  title,
  description,
  meta,
  feature,
  toggleId,
  busy,
  loading,
  onToggle,
  action,
  children,
  compact,
}: FeatureControlProps) {
  const reason = featureReason(feature)
  const tone = featureTone(feature.kind)
  const toggle = (
    <ToggleSwitch
      id={toggleId}
      label={title}
      checked={feature.enabled}
      disabled={loading || !feature.canToggle}
      busy={busy}
      onChange={onToggle}
    />
  )

  if (compact) {
    return (
      <article className="fl-compact-row">
        <div className="fl-compact-head">
          <div className="fl-compact-copy">
            <h3 className="fl-compact-title">{title}</h3>
            <div className="fl-compact-status">
              <StatusBadge kind={feature.kind} />
              {meta ? <p className={`fl-compact-meta tone-${tone}`}>{meta}</p> : null}
            </div>
            {reason ? <p className="fl-feature-reason">{reason}</p> : null}
          </div>
          {toggle}
        </div>
        {action ? <div className="fl-compact-extra">{action}</div> : null}
        {children}
      </article>
    )
  }

  return (
    <article className="fl-card">
      <div className="fl-card-head">
        <div className="fl-card-copy">
          <div className="fl-card-title-row">
            <span className="fl-card-icon">
              <FeatureIcon kind={featureKey} />
            </span>
            <div>
              <h3 className="fl-card-title">{title}</h3>
              {description ? <p className="fl-card-desc">{description}</p> : null}
            </div>
          </div>
          {meta ? <p className="fl-card-meta">{meta}</p> : null}
        </div>
        {toggle}
      </div>
      <div className="fl-card-foot">
        <StatusBadge kind={feature.kind} />
        {reason ? <p className="fl-feature-reason">{reason}</p> : null}
        {action}
      </div>
      {children ? <div className="fl-card-extra">{children}</div> : null}
    </article>
  )
}

export function quickActionAvailable(
  feature: FeatureState,
  extensionActive: boolean,
): { available: boolean; reason: string | null } {
  if (!extensionActive) return { available: false, reason: t('featureReason.paused') }
  if (feature.kind === 'disabled') return { available: false, reason: t('readiness.off') }
  if (feature.kind !== 'ready') return { available: false, reason: featureReason(feature) }
  return { available: true, reason: null }
}
