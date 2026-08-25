import type { EntitlementStatus } from '../types.ts'

/** Features that may be gated by plan / usage. */
export type EntitlementFeature =
  | 'correction'
  | 'translation'
  | 'live_translation'
  | 'layout_auto'
  | 'layout_ai'

export type FeatureDenyReason =
  | 'expired'
  | 'denied'
  | 'unknown_plan'
  | 'usage_exhausted'

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

/**
 * Live translation requires an active plan tier (same as manual translation for now).
 * Stricter pro-only rules can be added when billing is server-verified.
 */
export function evaluateFeatureAccess(
  feature: EntitlementFeature,
  tier: EntitlementStatus,
  options?: { usageBalanceMs?: number },
): FeatureAccessResult {
  if (isLocalOnlyFeature(feature)) {
    return { allowed: true, tier }
  }

  if (!tierAllowsAi(tier)) {
    return {
      allowed: false,
      tier,
      reason: tier === 'unknown' ? 'unknown_plan' : 'expired',
    }
  }

  if (tier === 'free' && options?.usageBalanceMs != null && options.usageBalanceMs <= 0) {
    return { allowed: false, tier, reason: 'usage_exhausted' }
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
    default:
      return 'entitlement_denied'
  }
}
