import type { CorrectionSettings } from '../../core/state/StateManager.ts'

export function isCorrectionAiReady(settings: CorrectionSettings): boolean {
  return settings.consentAccepted
}

export function usesManagedCorrection(_settings: CorrectionSettings): boolean {
  return true
}
