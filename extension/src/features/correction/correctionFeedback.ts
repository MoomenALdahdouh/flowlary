import type { CorrectionResponse } from '@flowlary/shared'
import { DIRECT_HIGHLIGHT_PREVIEW_MS } from '@flowlary/shared'
import type { InputEngine } from '../../core/input/InputEngine.ts'
import { readFieldText } from '../../core/dom/read.ts'
import type { EditableElement } from '../../core/dom/types.ts'
import { stateManager } from '../../core/state/StateManager.ts'
import type { FieldCorrectionStateEntry } from './applyCorrection.ts'
import { isCorrectionCardShowingForSegment } from './correctionLiveState.ts'
import { CorrectionCard } from './ui/CorrectionCard.ts'
import type { CorrectionSuggestionBinding } from './ui/types.ts'

type FeedbackDeps = {
  engine: InputEngine
  fieldStates: Map<string, FieldCorrectionStateEntry>
}

let deps: FeedbackDeps | null = null

export function registerCorrectionFeedback(next: FeedbackDeps): void {
  deps = next
}

export function unregisterCorrectionFeedback(): void {
  deps = null
}

function ensureCard(element: EditableElement, fieldState: FieldCorrectionStateEntry): CorrectionCard {
  if (!fieldState.card) {
    fieldState.card = new CorrectionCard({
      highlights: stateManager.correction.highlights,
      onApply: () => {},
      onDismiss: () => {},
    })
  }
  fieldState.card.setHighlights(stateManager.correction.highlights)
  if (!fieldState.cardMounted) {
    fieldState.card.mount(element)
    fieldState.cardMounted = true
  }
  return fieldState.card
}

export async function showPostWriteCorrectionPreview(options: {
  element: EditableElement
  fieldId: string
  segment: string
  requestedFullText: string
  response: CorrectionResponse
}): Promise<void> {
  if (!deps) return
  if (stateManager.correction.mode !== 'direct') return
  if (!stateManager.correction.highlights) return
  if (isCorrectionCardShowingForSegment(options.fieldId, options.segment)) return

  const fieldState = deps.fieldStates.get(options.fieldId)
  if (!fieldState) return

  const session = deps.engine.sessions.get(options.element)
  if (!session) return

  const card = ensureCard(options.element, fieldState)
  const binding: CorrectionSuggestionBinding = {
    remoteRequestId: `preview-${Date.now()}`,
    debouncerGeneration: fieldState.debouncer.currentGeneration(),
    fieldGeneration: session.getGeneration(),
    segment: options.segment,
    requestedFullText: options.requestedFullText,
    response: options.response,
  }
  card.setReady(binding)

  await new Promise((resolve) => setTimeout(resolve, DIRECT_HIGHLIGHT_PREVIEW_MS))

  if (card.getBinding()?.remoteRequestId === binding.remoteRequestId) {
    card.hide()
  }
}

export function notifyEnforceEnglishCorrectionApplied(options: {
  element: EditableElement
  fieldId: string
  fullTextBefore: string
  response: CorrectionResponse
}): void {
  if (options.response.correctedText === options.response.originalText) return
  void showPostWriteCorrectionPreview({
    element: options.element,
    fieldId: options.fieldId,
    segment: options.response.originalText,
    requestedFullText: readFieldText(options.element),
    response: options.response,
  })
}
