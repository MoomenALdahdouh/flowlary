/**
 * Live whole-field English correction (EWA-style CorrectionCard + CORRECT_TEXT).
 * When active, the enforce pipeline defers local English span auto-writes to this path.
 */
import { resolveWritingPolicy } from '../../core/policy/writingPolicy.ts'
import { stateManager } from '../../core/state/StateManager.ts'
import { isCorrectionAiReady } from './readiness.ts'

/** Scheduler may debounce and show UI; consent is checked at API request time. */
export function isCorrectionSchedulerEligible(): boolean {
  if (!stateManager.isActive()) return false
  if (!stateManager.correction.enabled) return false

  const policy = resolveWritingPolicy()
  if (!policy.improveEnglish) return false
  if (policy.helpStyle === 'shortcuts_only') return false

  return true
}

/** Whole-field path owns live English correction (defer enforce span UI/writes). */
export function shouldWholeFieldOwnEnglishCorrection(): boolean {
  return isCorrectionSchedulerEligible()
}

export function isLiveWholeFieldCorrectionActive(): boolean {
  if (!stateManager.isActive()) return false
  if (!stateManager.correction.enabled) return false
  if (!isCorrectionAiReady(stateManager.correction)) return false

  const policy = resolveWritingPolicy()
  if (!policy.improveEnglish) return false
  if (policy.helpStyle === 'shortcuts_only') return false

  return true
}
