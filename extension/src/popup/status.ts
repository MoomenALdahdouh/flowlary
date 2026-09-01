import {
  FREE_DAILY_CREDITS,
  formatCreditsRemaining,
  hasProProductExperience,
  type FlowlaryCapability,
} from '@flowlary/shared'
import type { ExtensionStatus } from '../messaging/types.ts'
import { resolveUsageUxFromStatus } from '../ui/usageUx.ts'

export type FeatureReadiness = 'ready' | 'disabled' | 'setup' | 'paused' | 'unavailable' | 'locked'

export type ConnectionState = 'checking' | 'connected' | 'unavailable'

export type PopupFeatureStatus = {
  correction: FeatureReadiness
  translation: FeatureReadiness
  liveTranslation: FeatureReadiness
  layout: FeatureReadiness
  summary: string
  summaryTone: 'ok' | 'warn' | 'muted'
}

export function languageLabel(code: string, name: string): string {
  return name || code.toUpperCase()
}

export function formatLanguagePair(source: string, target: string, sourceName: string, targetName: string): string {
  return `${languageLabel(source, sourceName)} → ${languageLabel(target, targetName)}`
}

/** @deprecated Prefer formatCreditsLabel. */
export function formatRemainingUsage(credits: number): string {
  if (credits <= 0) return '0 credits'
  return `${Math.floor(credits)} credits`
}

export function formatCreditsLabel(status: ExtensionStatus): string {
  const { entitlement } = status
  if (entitlement.isPro && entitlement.dailyLimit <= 0) return 'Pro'
  const remaining = entitlement.creditsRemaining
  const limit = entitlement.dailyLimit || FREE_DAILY_CREDITS
  return formatCreditsRemaining(remaining, limit)
}

export function formatUsageFooter(status: ExtensionStatus): string {
  return resolveUsageUxFromStatus(status).compactLine
}

export function requiresAuth(status: ExtensionStatus): boolean {
  return !status.account.signedIn
}

export function requiresConsent(status: ExtensionStatus): boolean {
  if (!status.account.signedIn) return false
  return !status.correction.consentAccepted || !status.correction.aiReady
}

export function isServiceOffline(status: ExtensionStatus): boolean {
  return status.apiHealth === 'offline'
}

/** Server entitlement cache has been populated for the signed-in account. */
export function isEntitlementLoaded(status: ExtensionStatus): boolean {
  if (!status.account.signedIn) return false
  const { entitlement } = status
  return entitlement.dailyLimit > 0 || hasProProductExperience(entitlement)
}

/**
 * True only when a signed-in user has confirmed zero AI credits remaining.
 * Signed-out and not-yet-synced entitlements are never treated as exhausted.
 */
export function isCreditsExhausted(status: ExtensionStatus): boolean {
  if (!status.account.signedIn) return false
  if (!isEntitlementLoaded(status)) return false
  const { entitlement } = status
  if (hasProProductExperience(entitlement)) {
    return entitlement.creditsRemaining <= 0
  }
  if (entitlement.status === 'free') {
    return entitlement.creditsRemaining <= 0
  }
  return false
}

/**
 * True when Groq/AI-credit features should be locked (correction, layout AI, practice).
 * Google translation must NOT use this — it remains available at 0 managed credits.
 */
export function isAiCreditLocked(status: ExtensionStatus): boolean {
  return isCreditsExhausted(status)
}

/** @deprecated Prefer isAiCreditLocked — name kept for call sites that mean AI credits. */
export function isEntitlementLocked(status: ExtensionStatus): boolean {
  return isAiCreditLocked(status)
}

/** Signed-in account may use Google translation regardless of Groq credit balance. */
export function isTranslationEntitlementReady(status: ExtensionStatus): boolean {
  return status.account.signedIn
}

export function hasCapability(status: ExtensionStatus, capability: FlowlaryCapability): boolean {
  return status.entitlement.capabilities.includes(capability)
}

export function resolveAccountPlanLabel(status: ExtensionStatus): string {
  if (status.account.signedIn && status.account.serverPlan) {
    return capitalizePlan(status.account.serverPlan)
  }
  return capitalizePlan(status.entitlement.status)
}

function capitalizePlan(plan: string): string {
  if (!plan || plan === 'unknown') return 'Free'
  return plan.charAt(0).toUpperCase() + plan.slice(1)
}

export function computeConnectionState(
  loading: boolean,
  error: string | null,
  apiHealth?: 'ok' | 'offline' | 'unknown',
): ConnectionState {
  if (loading) return 'checking'
  if (error) return 'unavailable'
  if (apiHealth === 'offline') return 'unavailable'
  return 'connected'
}

export function computeFeatureStatus(status: ExtensionStatus | null): PopupFeatureStatus {
  if (!status) {
    return {
      correction: 'unavailable',
      translation: 'unavailable',
      liveTranslation: 'unavailable',
      layout: 'unavailable',
      summary: 'Loading…',
      summaryTone: 'muted',
    }
  }

  const aiLocked = isAiCreditLocked(status)
  const signedOut = !status.account.signedIn

  if (!status.active) {
    return {
      correction: 'paused',
      translation: 'paused',
      liveTranslation: 'paused',
      layout: 'paused',
      summary: 'Extension paused',
      summaryTone: 'muted',
    }
  }

  if (status.apiHealth === 'offline') {
    return {
      correction: status.correction.enabled ? 'unavailable' : 'disabled',
      translation: status.translation.shortcutEnabled ? 'unavailable' : 'disabled',
      liveTranslation: status.translation.liveEnabled ? 'unavailable' : 'disabled',
      layout: status.layout.autoEnabled ? 'ready' : 'disabled',
      summary: 'AI is temporarily unavailable.',
      summaryTone: 'warn',
    }
  }

  let correction: FeatureReadiness = 'ready'
  if (!status.correction.enabled) {
    correction = 'disabled'
  } else if (signedOut) {
    correction = 'setup'
  } else if (aiLocked) {
    correction = 'locked'
  } else if (!status.correction.aiReady) {
    correction = 'setup'
  }

  // Google translation stays available for signed-in Free users at 0 Groq credits.
  let translation: FeatureReadiness = 'ready'
  if (!status.translation.shortcutEnabled) {
    translation = 'disabled'
  } else if (signedOut) {
    translation = 'setup'
  }

  let liveTranslation: FeatureReadiness = 'ready'
  if (!status.translation.liveEnabled) {
    liveTranslation = 'disabled'
  } else if (signedOut) {
    liveTranslation = 'setup'
  } else if (!status.translation.shortcutEnabled) {
    liveTranslation = 'disabled'
  }

  let layout: FeatureReadiness = status.layout.autoEnabled ? 'ready' : 'disabled'

  const usage = resolveUsageUxFromStatus(status)
  let summary = 'Extension active'
  let summaryTone: PopupFeatureStatus['summaryTone'] = 'ok'
  if (signedOut) {
    summary = [usage.title, usage.description].filter(Boolean).join('. ')
    summaryTone = 'warn'
  } else if (
    usage.state === 'AI_USAGE_EXHAUSTED' ||
    usage.state === 'AI_PRO_SOFT_LIMIT' ||
    usage.state === 'AI_TEMPORARILY_UNAVAILABLE' ||
    usage.state === 'BILLING_ATTENTION'
  ) {
    summary = [usage.title, usage.localToolsNote].filter(Boolean).join(' ')
    summaryTone = 'warn'
  } else if (usage.state === 'AI_USAGE_LOW' || usage.state === 'AI_TRIAL_ENDING') {
    summary = [usage.title, usage.assistsLabel, usage.resetLabel].filter(Boolean).join('. ')
    summaryTone = 'warn'
  } else if (correction === 'setup' && status.account.signedIn) {
    summary = 'Writing Correction needs setup'
    summaryTone = 'warn'
  } else if (correction === 'disabled' && translation === 'disabled' && layout === 'disabled') {
    summary = 'All features are off'
    summaryTone = 'muted'
  }

  return { correction, translation, liveTranslation, layout, summary, summaryTone }
}

export function readinessLabel(state: FeatureReadiness): string {
  switch (state) {
    case 'ready':
      return 'Ready'
    case 'disabled':
      return 'Off'
    case 'setup':
      return 'Sign in'
    case 'paused':
      return 'Paused'
    case 'locked':
      return 'Limit reached'
    default:
      return 'Unavailable'
  }
}

export function correctionAiLabel(status: { aiReady: boolean; consentAccepted: boolean }): string {
  if (!status.consentAccepted) return 'Consent required'
  return status.aiReady ? 'Flowlary AI ready' : 'Flowlary AI setup required'
}

export function layoutStatusLabel(status: ExtensionStatus): string {
  const parts: string[] = []
  if (status.layout.autoEnabled) parts.push('Auto-detect')
  if (status.layout.manualConversionEnabled) parts.push('Manual')
  if (status.layout.directShortcutEnabled) parts.push('Shortcut')
  return parts.length > 0 ? parts.join(' · ') : 'Off'
}
