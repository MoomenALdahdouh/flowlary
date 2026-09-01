import type { AccountPlan } from './account/types.ts'
import { FREE_DAILY_CREDITS, PRO_DAILY_CREDITS } from './credits.ts'

/**
 * Explicit server-authoritative capabilities (Phase 26).
 * Client may mirror these for UX only — never as billing authority.
 */
export type FlowlaryCapability =
  | 'keyboard.unlimited'
  | 'speedbox.unlimited'
  | 'local.spellAssist'
  | 'privacy.controls'
  | 'privacy.reset'
  | 'extension.pause'
  | 'ai.correction'
  | 'ai.translation'
  | 'ai.liveTranslation'
  | 'ai.layoutClassify'
  | 'learning.basic'
  | 'learning.full'
  | 'practice.basic'
  | 'practice.full'
  | 'progress.basic'
  | 'progress.advanced'
  | 'learning.export'
  | 'learning.import'
  | 'activity.basic'

export type CapabilitySet = ReadonlySet<FlowlaryCapability>

const ALWAYS_FREE: FlowlaryCapability[] = [
  'keyboard.unlimited',
  'speedbox.unlimited',
  'local.spellAssist',
  'privacy.controls',
  'privacy.reset',
  'extension.pause',
  'activity.basic',
  'learning.basic',
  'progress.basic',
  'practice.basic',
  // Google translation does not consume Groq AI credits.
  'ai.translation',
  'ai.liveTranslation',
]

const FULL_PRODUCT: FlowlaryCapability[] = [
  ...ALWAYS_FREE,
  'ai.correction',
  'ai.layoutClassify',
  'learning.full',
  'practice.full',
  'progress.advanced',
  'learning.export',
  'learning.import',
]

const FREE_WITH_AI: FlowlaryCapability[] = [
  ...ALWAYS_FREE,
  'ai.correction',
  'ai.layoutClassify',
]

const LOCAL_ONLY: FlowlaryCapability[] = [...ALWAYS_FREE]

export type EntitlementLifecycle =
  | 'free'
  | 'trial'
  | 'pro'
  | 'expired'
  | 'cancelled'
  | 'past_due'
  | 'suspended'
  | 'anonymous'

export function capabilitiesForPlan(
  plan: AccountPlan | 'anonymous',
  options?: {
    creditsRemaining?: number
    suspended?: boolean
    subscriptionStatus?: string
  },
): CapabilitySet {
  if (options?.suspended || plan === 'anonymous') {
    return new Set(LOCAL_ONLY)
  }

  if (plan === 'trial' || plan === 'pro') {
    return new Set(FULL_PRODUCT)
  }

  // free
  const credits = options?.creditsRemaining ?? 0
  if (credits > 0) return new Set(FREE_WITH_AI)
  return new Set(LOCAL_ONLY)
}

export function hasCapability(caps: CapabilitySet, capability: FlowlaryCapability): boolean {
  return caps.has(capability)
}

export function dailyLimitForPlan(plan: AccountPlan | 'anonymous'): number {
  if (plan === 'trial' || plan === 'pro') return PRO_DAILY_CREDITS
  if (plan === 'free') return FREE_DAILY_CREDITS
  return 0
}

export function capabilitiesToArray(caps: CapabilitySet): FlowlaryCapability[] {
  return [...caps]
}

/** Map AI feature keys used by the extension to capabilities. */
export function capabilityForAiFeature(
  feature: 'correction' | 'translation' | 'live_translation' | 'layout_ai' | 'practice',
): FlowlaryCapability {
  switch (feature) {
    case 'correction':
      return 'ai.correction'
    case 'translation':
      return 'ai.translation'
    case 'live_translation':
      return 'ai.liveTranslation'
    case 'layout_ai':
      return 'ai.layoutClassify'
    case 'practice':
      return 'practice.full'
  }
}
