import type { EntitlementStatus } from '../types.ts'
import type { FlowlaryCapability } from '../capabilities.ts'
import { hasCapability } from '../capabilities.ts'

/** Features that may be gated by plan / usage. */
export type EntitlementFeature =
  | 'correction'
  | 'translation'
  | 'live_translation'
  | 'layout_auto'
  | 'layout_ai'
  | 'practice'
  | 'learning_full'
  | 'learning_export'
  | 'learning_import'
  | 'progress_advanced'

export type FeatureDenyReason =
  | 'expired'
  | 'denied'
  | 'unknown_plan'
  | 'usage_exhausted'
  | 'account_required'
  | 'capability_denied'

export type FeatureAccessResult =
  | { allowed: true; tier: EntitlementStatus }
  | { allowed: false; tier: EntitlementStatus; reason: FeatureDenyReason }

/** Local layout remapping does not require AI entitlement. */
export function isLocalOnlyFeature(feature: EntitlementFeature): boolean {
  return feature === 'layout_auto'
}

/** Whether a resolved plan tier may use AI-backed features at all. */
export function tierAllowsAi(tier: EntitlementStatus): boolean {
  return tier === 'pro' || tier === 'trial' || tier === 'free'
}

/** Pro-equivalent product access (paid Pro, trial, or server-verified student benefit). */
export function hasProProductExperience(options: {
  isPro?: boolean
  inTrial?: boolean
  studentProActive?: boolean
  capabilities?: readonly FlowlaryCapability[] | readonly string[]
}): boolean {
  if (options.isPro === true || options.inTrial === true || options.studentProActive === true) {
    return true
  }
  return options.capabilities?.includes('learning.full') === true
}

const FEATURE_CAPABILITY: Partial<Record<EntitlementFeature, FlowlaryCapability>> = {
  correction: 'ai.correction',
  translation: 'ai.translation',
  live_translation: 'ai.liveTranslation',
  layout_ai: 'ai.layoutClassify',
  practice: 'practice.full',
  learning_full: 'learning.full',
  learning_export: 'learning.export',
  learning_import: 'learning.import',
  progress_advanced: 'progress.advanced',
}

/**
 * Evaluate feature access.
 *
 * Prefer `capabilities` + `creditsRemaining` when provided (server mirror).
 * Falls back to legacy tier + usageBalanceMs for transitional clients.
 */
export function evaluateFeatureAccess(
  feature: EntitlementFeature,
  tier: EntitlementStatus,
  options?: {
    usageBalanceMs?: number
    creditsRemaining?: number
    capabilities?: readonly FlowlaryCapability[]
    signedIn?: boolean
  },
): FeatureAccessResult {
  if (isLocalOnlyFeature(feature)) {
    return { allowed: true, tier }
  }

  const caps = options?.capabilities
  if (caps && caps.length > 0) {
    const required = FEATURE_CAPABILITY[feature]
    if (required && !hasCapability(new Set(caps), required)) {
      // Free users get practice.basic without practice.full — allow teaser via practice.basic
      if (feature === 'practice' && hasCapability(new Set(caps), 'practice.basic')) {
        // Teaser allowed; AI check still needs credits + ai.correction
        if ((options.creditsRemaining ?? 0) <= 0 && tier === 'free') {
          return { allowed: false, tier, reason: 'usage_exhausted' }
        }
        if (!hasCapability(new Set(caps), 'ai.correction') && tier === 'free') {
          return { allowed: false, tier, reason: 'usage_exhausted' }
        }
        return { allowed: true, tier }
      }
      if (options.signedIn === false && feature.startsWith('ai') === false) {
        // learning export etc. still denied without capability
      }
      return { allowed: false, tier, reason: 'capability_denied' }
    }

    // Translation uses Google by default and does not require Groq credits.
    const creditGatedAi: EntitlementFeature[] = ['correction', 'layout_ai', 'practice']
    if (creditGatedAi.includes(feature)) {
      if (options.creditsRemaining != null && options.creditsRemaining <= 0) {
        return { allowed: false, tier, reason: 'usage_exhausted' }
      }
    }
    return { allowed: true, tier }
  }

  if (!tierAllowsAi(tier) && !isLocalOnlyFeature(feature)) {
    return {
      allowed: false,
      tier,
      reason: tier === 'unknown' ? 'unknown_plan' : 'expired',
    }
  }

  const creditGatedLegacy: EntitlementFeature[] = ['correction', 'layout_ai', 'practice']
  if (
    creditGatedLegacy.includes(feature) &&
    options?.creditsRemaining != null &&
    options.creditsRemaining <= 0 &&
    tierAllowsAi(tier)
  ) {
    return { allowed: false, tier, reason: 'usage_exhausted' }
  }
  // Legacy free usageBalanceMs only gates Groq-backed features — not Google translation.
  if (tier === 'free') {
    const creditGatedLegacyBalance: EntitlementFeature[] = ['correction', 'layout_ai', 'practice']
    if (
      creditGatedLegacyBalance.includes(feature) &&
      options?.usageBalanceMs != null &&
      options.usageBalanceMs <= 0 &&
      options.creditsRemaining == null
    ) {
      return { allowed: false, tier, reason: 'usage_exhausted' }
    }
  }

  return { allowed: true, tier }
}

export function featureAccessErrorCode(result: FeatureAccessResult): string {
  if (result.allowed) return 'allowed'
  switch (result.reason) {
    case 'usage_exhausted':
      return 'usage_exhausted'
    case 'unknown_plan':
      return 'entitlement_unknown'
    case 'account_required':
      return 'account_required'
    case 'capability_denied':
      return 'capability_denied'
    default:
      return 'entitlement_denied'
  }
}

export type { FlowlaryCapability }
