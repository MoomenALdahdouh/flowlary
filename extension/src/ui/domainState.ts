import type { ExtensionStatus } from '../messaging/types.ts'
import {
  isCreditsExhausted,
  isLayoutFeatureOn,
  isServiceOffline,
  requiresAuth,
  requiresConsent,
} from '../popup/status.ts'

export type FeatureStateKind =
  | 'ready'
  | 'disabled'
  | 'unavailable'
  | 'requires_setup'
  | 'requires_consent'
  | 'requires_auth'
  | 'paused'
  | 'locked'

export type ExtensionRuntimeState = 'loading' | 'active' | 'paused'

export type AiServiceState =
  | 'available'
  | 'temporarily_unavailable'
  | 'requires_consent'
  | 'requires_auth'
  | 'loading'

export type AccountStateKind = 'signed_out' | 'signed_in'

export type SubscriptionKind = 'trial' | 'free' | 'pro' | 'expired' | 'unknown'

export type FeatureKey = 'correction' | 'translation' | 'liveTranslation' | 'layout'

export type FeatureState = {
  kind: FeatureStateKind
  enabled: boolean
  canToggle: boolean
  reasonKey: string | null
}

export type DomainState = {
  extension: ExtensionRuntimeState
  ai: AiServiceState
  account: AccountStateKind
  subscription: SubscriptionKind
  features: Record<FeatureKey, FeatureState>
  flowlaryAiNeeded: boolean
  flowlaryAiOffline: boolean
}

export { isLayoutFeatureOn } from '../popup/status.ts'

function subscriptionKind(status: ExtensionStatus): SubscriptionKind {
  if (status.entitlement.isPro) return 'pro'
  if (status.entitlement.inTrial) return 'trial'
  if (status.entitlement.status === 'free' && status.account.signedIn && isCreditsExhausted(status)) {
    return 'expired'
  }
  if (status.entitlement.status === 'free') return 'free'
  if (status.entitlement.status === 'trial') return 'trial'
  return 'unknown'
}

/**
 * Flowlary AI system-row state. Priority matches runtime gates:
 * auth → consent → backend connectivity → ready.
 */
function aiServiceState(status: ExtensionStatus): AiServiceState {
  if (requiresAuth(status)) return 'requires_auth'
  if (requiresConsent(status)) return 'requires_consent'
  if (isServiceOffline(status)) return 'temporarily_unavailable'
  return 'available'
}

type ManagedAiOptions = {
  creditGated: boolean
}

/**
 * Shared gate order for managed AI features (matches background handlers):
 * paused → disabled → auth → consent → credits (optional) → service offline → ready.
 */
function managedAiFeatureState(
  status: ExtensionStatus,
  enabled: boolean,
  options: ManagedAiOptions,
): FeatureState {
  if (!status.active) {
    return { kind: 'paused', enabled, canToggle: false, reasonKey: 'paused' }
  }
  if (!enabled) {
    return { kind: 'disabled', enabled: false, canToggle: true, reasonKey: null }
  }
  if (requiresAuth(status)) {
    return { kind: 'requires_auth', enabled: true, canToggle: false, reasonKey: 'sign_in_required' }
  }
  if (requiresConsent(status)) {
    return { kind: 'requires_consent', enabled: true, canToggle: false, reasonKey: 'consent_required' }
  }
  if (options.creditGated && isCreditsExhausted(status)) {
    return { kind: 'locked', enabled: true, canToggle: false, reasonKey: 'usage_exhausted' }
  }
  if (isServiceOffline(status)) {
    return { kind: 'unavailable', enabled: true, canToggle: false, reasonKey: 'service_unavailable' }
  }
  return { kind: 'ready', enabled: true, canToggle: true, reasonKey: null }
}

function layoutState(status: ExtensionStatus): FeatureState {
  const enabled = isLayoutFeatureOn(status)
  if (!status.active) {
    return {
      kind: 'paused',
      enabled,
      canToggle: false,
      reasonKey: 'paused',
    }
  }
  if (!enabled) {
    return { kind: 'disabled', enabled: false, canToggle: true, reasonKey: null }
  }
  return { kind: 'ready', enabled: true, canToggle: true, reasonKey: null }
}

/** Canonical feature availability model for popup and dashboard UI. */
export function computeDomainState(status: ExtensionStatus | null, loading: boolean): DomainState | null {
  if (loading && !status) return null
  if (!status) {
    return {
      extension: 'loading',
      ai: 'loading',
      account: 'signed_out',
      subscription: 'unknown',
      flowlaryAiNeeded: true,
      flowlaryAiOffline: false,
      features: {
        correction: { kind: 'unavailable', enabled: false, canToggle: false, reasonKey: 'loading' },
        translation: { kind: 'unavailable', enabled: false, canToggle: false, reasonKey: 'loading' },
        liveTranslation: { kind: 'unavailable', enabled: false, canToggle: false, reasonKey: 'loading' },
        layout: { kind: 'unavailable', enabled: false, canToggle: false, reasonKey: 'loading' },
      },
    }
  }

  const ai = aiServiceState(status)
  const flowlaryAiOffline = isServiceOffline(status)

  return {
    extension: status.active ? 'active' : 'paused',
    ai,
    account: status.account.signedIn ? 'signed_in' : 'signed_out',
    subscription: subscriptionKind(status),
    flowlaryAiNeeded: true,
    flowlaryAiOffline,
    features: {
      correction: managedAiFeatureState(status, status.correction.enabled, { creditGated: true }),
      // Google translation is not credit-gated; auth/consent/service gates only.
      translation: managedAiFeatureState(status, status.translation.shortcutEnabled, { creditGated: false }),
      liveTranslation: managedAiFeatureState(status, status.translation.liveEnabled, {
        creditGated: false,
      }),
      layout: layoutState(status),
    },
  }
}

export function featureReadinessLabel(kind: FeatureStateKind): string {
  switch (kind) {
    case 'ready':
      return 'ready'
    case 'disabled':
      return 'off'
    case 'unavailable':
      return 'unavailable'
    case 'requires_setup':
      return 'setup'
    case 'requires_consent':
      return 'consent'
    case 'requires_auth':
      return 'sign_in'
    case 'paused':
      return 'paused'
    case 'locked':
      return 'locked'
    default:
      return 'unavailable'
  }
}
