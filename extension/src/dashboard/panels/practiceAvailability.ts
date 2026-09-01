import { evaluateFeatureAccess } from '@flowlary/shared'
import type { ExtensionStatus } from '../../messaging/types.ts'

export type PracticeBlockReason =
  | 'none'
  | 'consent_required'
  | 'usage_exhausted'
  | 'account_required'
  | 'capability_denied'
  | 'signed_out'

export type PracticeCheckAvailability = {
  canStartSession: boolean
  canCheckWriting: boolean
  blockReason: PracticeBlockReason
  creditsRemaining: number
}

export function resolvePracticeCheckAvailability(
  status: ExtensionStatus | null | undefined,
): PracticeCheckAvailability {
  if (!status) {
    return {
      canStartSession: false,
      canCheckWriting: false,
      blockReason: 'signed_out',
      creditsRemaining: 0,
    }
  }

  const creditsRemaining = status.entitlement.creditsRemaining

  if (!status.correction.consentAccepted || !status.correction.aiReady) {
    return {
      canStartSession: false,
      canCheckWriting: false,
      blockReason: 'consent_required',
      creditsRemaining,
    }
  }

  if (!status.account.signedIn) {
    return {
      canStartSession: false,
      canCheckWriting: false,
      blockReason: 'account_required',
      creditsRemaining,
    }
  }

  const access = evaluateFeatureAccess('practice', status.entitlement.status, {
    creditsRemaining,
    capabilities: status.entitlement.capabilities,
    signedIn: status.account.signedIn,
  })

  if (!access.allowed) {
    const blockReason: PracticeBlockReason =
      access.reason === 'usage_exhausted'
        ? 'usage_exhausted'
        : access.reason === 'account_required'
          ? 'account_required'
          : 'capability_denied'
    return {
      canStartSession: false,
      canCheckWriting: false,
      blockReason,
      creditsRemaining,
    }
  }

  return {
    canStartSession: true,
    canCheckWriting: true,
    blockReason: 'none',
    creditsRemaining,
  }
}

export type PracticeCheckKey = {
  sessionId: string
  itemIndex: number
}

export function isActivePracticeCheck(
  expected: PracticeCheckKey,
  active: PracticeCheckKey | null,
  aborted: boolean,
): boolean {
  if (aborted) return false
  if (!active) return false
  return active.sessionId === expected.sessionId && active.itemIndex === expected.itemIndex
}

export function canStartPracticeCheckAction(checking: boolean, checkingHeld: boolean, hasText: boolean): boolean {
  return hasText && !checking && !checkingHeld
}

export function canRecordPracticeAction(actionRecorded: boolean, hasCorrection: boolean): boolean {
  return hasCorrection && !actionRecorded
}

export function practiceCorrectionErrorKey(
  error: string,
): 'consent_required' | 'usage_exhausted' | 'account_changed' | 'rate_limited' | 'network' | 'generic' {
  switch (error) {
    case 'consent_required':
      return 'consent_required'
    case 'usage_exhausted':
      return 'usage_exhausted'
    case 'account_changed':
      return 'account_changed'
    case 'rate_limited':
      return 'rate_limited'
    case 'network':
    case 'auth_failed':
      return 'network'
    default:
      return 'generic'
  }
}
