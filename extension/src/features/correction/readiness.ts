import type { CorrectionSettings } from '../../core/state/StateManager.ts'

export function isCorrectionAiReady(settings: CorrectionSettings): boolean {
  if (!settings.consentAccepted) return false
  if (settings.aiProvider === 'byok') return Boolean(settings.groqApiKey.trim())
  return true
}

export function usesManagedCorrection(settings: CorrectionSettings): boolean {
  return settings.aiProvider !== 'byok'
}
