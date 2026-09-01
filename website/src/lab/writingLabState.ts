import { FREE_DAILY_CREDITS } from '@flowlary/shared'
import type { WebAccountView, WebEntitlementView } from '../account/client.ts'
import { readWebAiConsent } from '../account/consent.ts'

export type WritingLabGate =
  | 'checking'
  | 'requires_auth'
  | 'requires_consent'
  | 'credits_exhausted'
  | 'unavailable'
  | 'ready'

export type WritingLabGateInput = {
  sessionChecking: boolean
  apiOnline: boolean | null
  account: WebAccountView | null
  entitlement: WebEntitlementView | null
  consentAccepted?: boolean
}

function isCreditsExhausted(account: WebAccountView, entitlement: WebEntitlementView | null): boolean {
  if (entitlement?.isPro || entitlement?.inTrial || account.isPro || account.inTrial) return false
  const remaining =
    entitlement?.creditsRemaining ?? account.creditsRemaining ?? FREE_DAILY_CREDITS
  return remaining <= 0
}

/**
 * Canonical gate order (matches extension domainState managed AI gates):
 * checking → auth → consent → service offline → credits → ready.
 */
export function resolveWritingLabGate(input: WritingLabGateInput): WritingLabGate {
  if (input.sessionChecking) return 'checking'
  if (!input.account) return 'requires_auth'

  const consent = input.consentAccepted ?? readWebAiConsent(input.account?.id)
  if (!consent) return 'requires_consent'

  if (input.apiOnline === false) return 'unavailable'

  if (isCreditsExhausted(input.account, input.entitlement)) return 'credits_exhausted'

  return 'ready'
}

export type InputValidation =
  | { ok: true }
  | { ok: false; reason: 'empty' | 'too_short' | 'too_long' }

export function validateWritingLabInput(
  text: string,
  minChars: number,
  minWords: number,
  maxChars: number,
): InputValidation {
  const trimmed = text.trim()
  if (!trimmed) return { ok: false, reason: 'empty' }
  if (trimmed.length < minChars) return { ok: false, reason: 'too_short' }
  const words = trimmed.split(/\s+/).filter(Boolean).length
  if (words < minWords) return { ok: false, reason: 'too_short' }
  if (trimmed.length > maxChars) return { ok: false, reason: 'too_long' }
  return { ok: true }
}
