import {
  applyLocalEnglishRepair,
  finalizeCorrectionResponse,
  isCredibleLocalEnglish,
  lookupKnownTypo,
  hashWritingSample,
  type CorrectionResponse,
} from '@flowlary/shared'
import type { EditableElement } from '../../core/dom/types.ts'
import type { FieldSession } from '../../core/session/FieldSession.ts'
import { stateManager } from '../../core/state/StateManager.ts'
import { extractWritingContext } from './segment.ts'
import { hideEnglishPipelineSuggestion } from '../../core/writeGate/pipelineSuggest.ts'
import type { CorrectionCard } from './ui/CorrectionCard.ts'
import type { Operation } from '../../core/runtime/types.ts'
import { createBoxSuggestion } from '../../core/runtime/suggestion.ts'

export type LocalSuggestionOptions = {
  currentDebouncerGeneration: () => number
  getCard: (el: EditableElement) => CorrectionCard
  fieldState: { card: CorrectionCard | null }
  operation?: Operation
  /**
   * When true (AI failure fallback), accept any local improvement even if a
   * few tokens remain unknown — better than showing a dead-end error card.
   */
  allowPartial?: boolean
  /** Explicit user selection — Box identity uses this range only. */
  selectionTarget?: {
    start: number
    end: number
    text: string
  }
}

export function buildLocalCorrectionResponse(
  text: string,
  options: { allowPartial?: boolean; segment?: string } = {},
): CorrectionResponse | null {
  const segment = options.segment ?? extractWritingContext(text)
  const corrected = applyLocalEnglishRepair(segment)
  if (!corrected || corrected === segment) return null
  if (options.allowPartial) {
    // Partial fallback is only for explicit typo-map hits — not capitalization-only transforms.
    if (!hasExplicitTypoMappingHit(segment)) return null
  } else if (!isCredibleLocalEnglish(corrected)) {
    return null
  }
  return finalizeCorrectionResponse(segment, { correctedText: corrected, changes: [] }, applyLocalEnglishRepair)
}

function hasExplicitTypoMappingHit(text: string): boolean {
  const words = text.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) ?? []
  return words.some((word) => lookupKnownTypo(word) != null)
}

export function presentLocalBoxSuggestion(
  element: EditableElement,
  session: FieldSession,
  fullText: string,
  options: LocalSuggestionOptions,
): boolean {
  if (stateManager.correction.mode !== 'box') return false
  const selectionTarget = options.selectionTarget
  if (selectionTarget) {
    const liveSlice = fullText.slice(selectionTarget.start, selectionTarget.end)
    if (liveSlice !== selectionTarget.text) return false
  }
  const response = buildLocalCorrectionResponse(fullText, {
    allowPartial: options.allowPartial,
    segment: selectionTarget?.text,
  })
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
  const range = selectionTarget
    ? { start: selectionTarget.start, end: selectionTarget.end }
    : (() => {
        const start = Math.max(0, fullText.lastIndexOf(response.originalText))
        return { start, end: start + response.originalText.length }
      })()
  if (fullText.slice(range.start, range.end) !== response.originalText) return false
  const box = createBoxSuggestion({
    operation,
    range,
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

/** Errors the user can act on — everything else should fail silently or fall back locally. */
export function isActionableCorrectionError(code: string): boolean {
  return (
    code === 'consent_required' ||
    code === 'usage_exhausted' ||
    code === 'entitlement_denied' ||
    code === 'account_required' ||
    code === 'auth_failed' ||
    code === 'rate_limited' ||
    code === 'network'
  )
}
