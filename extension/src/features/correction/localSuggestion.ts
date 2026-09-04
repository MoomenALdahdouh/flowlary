import { applyLocalEnglishRepair, finalizeCorrectionResponse, isCredibleLocalEnglish, hashWritingSample, type CorrectionResponse } from '@flowlary/shared'
import type { EditableElement } from '../../core/dom/types.ts'
import type { FieldSession } from '../../core/session/FieldSession.ts'
import { stateManager } from '../../core/state/StateManager.ts'
import { extractWritingContext } from './segment.ts'
import { hideEnglishPipelineSuggestion } from '../../core/writeGate/pipelineSuggest.ts'
import type { CorrectionCard } from './ui/CorrectionCard.ts'
import type { Operation } from '../../core/runtime/types.ts'
import { createBoxSuggestion } from '../../core/runtime/suggestion.ts'

export function buildLocalCorrectionResponse(text: string): CorrectionResponse | null {
  const segment = extractWritingContext(text)
  const corrected = applyLocalEnglishRepair(segment)
  if (!corrected || corrected === segment) return null
  if (!isCredibleLocalEnglish(corrected)) return null
  return finalizeCorrectionResponse(segment, { correctedText: corrected, changes: [] }, applyLocalEnglishRepair)
}

export function presentLocalBoxSuggestion(
  element: EditableElement,
  session: FieldSession,
  fullText: string,
  options: {
    currentDebouncerGeneration: () => number
    getCard: (el: EditableElement) => CorrectionCard
    fieldState: { card: CorrectionCard | null }
    operation?: Operation
  },
): boolean {
  if (stateManager.correction.mode !== 'box') return false
  const response = buildLocalCorrectionResponse(fullText)
  if (!response) return false

  const existing = options.fieldState.card?.getBinding()?.response
  if (
    existing &&
    existing.originalText === response.originalText &&
    existing.correctedText === response.correctedText
  ) {
    return true
  }

  const operation = options.operation ?? session.operations.begin({
    fieldId: session.field.id,
    revision: session.getRevision(),
    feature: 'english',
    purpose: 'auto-analysis',
    trigger: 'auto',
    snapshotFullText: fullText,
  })
  const start = Math.max(0, fullText.lastIndexOf(response.originalText))
  const box = createBoxSuggestion({
    operation,
    range: { start, end: start + response.originalText.length },
    replacement: response.correctedText,
    action: 'english_correction',
    textOrigin: 'original_en',
    state: 'ready',
  })

  hideEnglishPipelineSuggestion(session.field.id)
  options.getCard(element).setReady({
    remoteRequestId: `local-${response.originalText.length}`,
    debouncerGeneration: options.currentDebouncerGeneration(),
    fieldGeneration: box.revision,
    segment: response.originalText,
    requestedFullText: box.snapshotFullText,
    response,
    operationId: box.operationId,
    revision: box.revision,
    fieldId: box.fieldId,
    snapshotFullText: box.snapshotFullText,
    snapshotHash: box.snapshotHash || hashWritingSample(box.snapshotFullText),
    range: box.range,
    rangeText: box.rangeText,
    replacement: box.replacement,
    boxState: 'ready',
  })
  return true
}
