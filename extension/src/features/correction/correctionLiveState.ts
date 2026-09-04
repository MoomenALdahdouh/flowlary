import type { FieldCorrectionStateEntry } from './applyCorrection.ts'

let fieldStatesRef: Map<string, FieldCorrectionStateEntry> | null = null

export function registerCorrectionFieldStates(states: Map<string, FieldCorrectionStateEntry>): void {
  fieldStatesRef = states
}

export function unregisterCorrectionFieldStates(): void {
  fieldStatesRef = null
}

export function hasPendingWholeFieldCorrection(
  fieldId: string,
  _islandRange?: { start: number; end: number },
): boolean {
  if (!fieldStatesRef) return false
  const state = fieldStatesRef.get(fieldId)
  if (!state?.pendingRequestId) return false
  return true
}

export function hasScheduledWholeFieldCorrection(fieldId: string): boolean {
  if (!fieldStatesRef) return false
  const state = fieldStatesRef.get(fieldId)
  if (!state) return false
  return Boolean(state.pendingRequestId || state.lastSentText)
}

export function isCorrectionCardShowingForSegment(fieldId: string, segment: string): boolean {
  if (!fieldStatesRef) return false
  const state = fieldStatesRef.get(fieldId)
  if (!state?.card) return false
  if (!state.card.hasReadyCorrection()) return false
  const binding = state.card.getBinding()
  return binding?.segment === segment
}
