import type { InputEngine } from '../../core/input/InputEngine.ts'
import { evaluateFieldSafety } from '../../core/safety/index.ts'
import { readFieldText, isEditableElement } from '../../core/dom/read.ts'
import { writeReplacement } from '../../core/dom/editor.ts'
import type { EditableElement } from '../../core/dom/types.ts'
import { stateManager } from '../../core/state/StateManager.ts'
import { applyInstantSpelling } from './instantSpell.ts'
import { shouldShowEnglishAssistant } from './language.ts'
import {
  debounceOptionsForMode,
  endsWithSentenceBoundary,
  endsWithWordBoundary,
  IntelligentDebouncer,
} from './debounce.ts'
import { extractWritingContext } from './segment.ts'
import {
  runCorrectionRequest,
  acceptCorrectionSuggestion,
  dismissCorrectionSuggestion,
  invalidateCardIfStale,
  syncCardVisibility,
  type FieldCorrectionState,
} from './applyCorrection.ts'
import type { CorrectionMetrics } from './metrics.ts'
import { CorrectionCard } from './ui/CorrectionCard.ts'
import { cancelCorrectionRemote } from './client.ts'
import { isCorrectionHost } from './ui/CorrectionCard.ts'

export type CorrectionSchedulerOptions = {
  engine: InputEngine
  metrics: CorrectionMetrics
}

export class CorrectionScheduler {
  private unsubscribe: (() => void) | null = null
  private fieldStates = new Map<string, FieldCorrectionState & { debouncer: IntelligentDebouncer }>()

  constructor(private options: CorrectionSchedulerOptions) {}

  start(): void {
    if (this.unsubscribe) return
    this.unsubscribe = this.options.engine.eventBus.subscribe((event) => {
      if (!stateManager.correction.enabled) return

      if (event.type === 'input') {
        if (event.origin !== 'USER' || event.composing) return
        this.onInput(event.target as EditableElement)
      }

      if (event.type === 'composition-end') {
        this.onInput(event.target as EditableElement)
      }

      if (event.type === 'focus-out') {
        this.teardownField(event.target)
      }
    })
  }

  stop(): void {
    this.unsubscribe?.()
    this.unsubscribe = null
    for (const state of this.fieldStates.values()) {
      state.debouncer.cancel()
      state.card?.destroy()
    }
    this.fieldStates.clear()
  }

  private buildApplyOptions(
    fieldState: FieldCorrectionState & { debouncer: IntelligentDebouncer },
  ) {
    return {
      metrics: this.options.metrics,
      fieldState,
      currentDebouncerGeneration: () => fieldState.debouncer.currentGeneration(),
      getCard: (el: EditableElement) => this.ensureCard(el, fieldState),
    }
  }

  private ensureCard(
    element: EditableElement,
    fieldState: FieldCorrectionState & { debouncer: IntelligentDebouncer },
  ): CorrectionCard {
    if (!fieldState.card) {
      const applyOptions = this.buildApplyOptions(fieldState)
      fieldState.card = new CorrectionCard({
        highlights: stateManager.correction.highlights,
        onApply: (binding) => {
          const session = this.options.engine.sessions.getOrCreate(element)
          void acceptCorrectionSuggestion(element, session, binding, applyOptions)
        },
        onDismiss: () => {
          dismissCorrectionSuggestion(element, applyOptions)
        },
      })
    }
    fieldState.card.setHighlights(stateManager.correction.highlights)
    if (!fieldState.cardMounted) {
      fieldState.card.mount(element)
      fieldState.cardMounted = true
    }
    return fieldState.card
  }

  private getFieldState(fieldId: string, element: EditableElement) {
    let state = this.fieldStates.get(fieldId)
    if (!state) {
      const debouncer = new IntelligentDebouncer(
        (text, generation) => {
          void this.onDebounced(element, text, generation)
        },
        debounceOptionsForMode(stateManager.correction.mode),
      )
      state = {
        debouncer,
        lastSentText: '',
        lastCorrectedFor: '',
        pendingRequestId: null,
        card: null,
        cardMounted: false,
      }
      this.fieldStates.set(fieldId, state)
    }
    state.debouncer.setOptions(debounceOptionsForMode(stateManager.correction.mode))
    return state
  }

  private onInput(element: Element): void {
    if (!isEditableElement(element)) return
    if (!stateManager.isActive() || !stateManager.correction.enabled) return

    const session = this.options.engine.sessions.getOrCreate(element)
    if (session.isComposing()) return

    const fieldState = this.getFieldState(session.field.id, element)
    const applyOptions = this.buildApplyOptions(fieldState)

    const text = readFieldText(element)
    const hostname = typeof location !== 'undefined' ? location.hostname : undefined
    const safety = evaluateFieldSafety(element, {
      hostname,
      excludedDomains: stateManager.settings.excludedDomains,
      text,
    })
    if (!safety.allowed) {
      this.options.metrics.correction_blocked += 1
      fieldState.debouncer.cancel()
      fieldState.card?.hide()
      return
    }

    invalidateCardIfStale(element, session, text, applyOptions)

    let workingText = text
    if (stateManager.correction.mode === 'direct') {
      if (endsWithWordBoundary(text) || endsWithSentenceBoundary(text)) {
        const fixed = applyInstantSpelling(text)
        if (fixed !== text) {
          const acquired = session.tryAcquireWrite('CORRECT')
          if (acquired.ok) {
            const write = writeReplacement(element, 0, text.length, fixed, {
              origin: 'CORRECT',
              session,
              requestId: acquired.requestId,
              expectedGeneration: acquired.generation,
              allowActiveEdit: true,
            })
            session.releaseWrite('CORRECT', acquired.requestId)
            if (write.verdict === 'written') {
              workingText = fixed
              const segment = extractWritingContext(fixed)
              fieldState.lastCorrectedFor = segment
              fieldState.lastSentText = segment
              fieldState.debouncer.bump()
              this.options.metrics.correction_local_hits += 1
            }
          }
        }
      }
    }

    syncCardVisibility(element, workingText, applyOptions)

    if (!workingText.trim()) {
      fieldState.debouncer.cancel()
      if (fieldState.pendingRequestId) void cancelCorrectionRemote(fieldState.pendingRequestId)
      fieldState.card?.hide()
      fieldState.lastSentText = ''
      fieldState.lastCorrectedFor = ''
      return
    }

    if (!shouldShowEnglishAssistant(workingText)) {
      fieldState.debouncer.cancel()
      fieldState.card?.hide()
      return
    }

    fieldState.debouncer.schedule(workingText)
  }

  private async onDebounced(
    element: EditableElement,
    text: string,
    debouncerGeneration: number,
  ): Promise<void> {
    const session = this.options.engine.sessions.getOrCreate(element)
    const fieldState = this.getFieldState(session.field.id, element)
    await runCorrectionRequest(element, session, text, debouncerGeneration, this.buildApplyOptions(fieldState))
  }

  private teardownField(element: Element | null | undefined): void {
    if (!element || isCorrectionHost(element)) return
    const session = this.options.engine.sessions.get(element)
    if (!session) return
    const state = this.fieldStates.get(session.field.id)
    if (!state) return
    state.debouncer.cancel()
    if (state.pendingRequestId) void cancelCorrectionRemote(state.pendingRequestId)
    state.card?.hide()
  }
}

export { isCorrectionHost }
