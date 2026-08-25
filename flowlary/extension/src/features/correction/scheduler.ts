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
import { runCorrectionRequest, commitMergedCorrection, type FieldCorrectionState } from './applyCorrection.ts'
import type { CorrectionMetrics } from './metrics.ts'
import { CorrectionCard } from './ui/CorrectionCard.ts'
import { cancelCorrectionRemote } from './client.ts'

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

    const text = readFieldText(element)
    const hostname = typeof location !== 'undefined' ? location.hostname : undefined
    const safety = evaluateFieldSafety(element, {
      hostname,
      excludedDomains: stateManager.settings.excludedDomains,
      text,
    })
    if (!safety.allowed) {
      this.options.metrics.correction_blocked += 1
      this.getFieldState(session.field.id, element).debouncer.cancel()
      this.getFieldState(session.field.id, element).card?.hide()
      return
    }

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
              const fieldState = this.getFieldState(session.field.id, element)
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

    if (!workingText.trim()) {
      const fieldState = this.getFieldState(session.field.id, element)
      fieldState.debouncer.cancel()
      if (fieldState.pendingRequestId) void cancelCorrectionRemote(fieldState.pendingRequestId)
      fieldState.card?.hide()
      return
    }

    if (!shouldShowEnglishAssistant(workingText)) {
      const fieldState = this.getFieldState(session.field.id, element)
      fieldState.debouncer.cancel()
      fieldState.card?.hide()
      return
    }

    this.getFieldState(session.field.id, element).debouncer.schedule(workingText)
  }

  private async onDebounced(
    element: EditableElement,
    text: string,
    debouncerGeneration: number,
  ): Promise<void> {
    const session = this.options.engine.sessions.getOrCreate(element)
    const fieldState = this.getFieldState(session.field.id, element)
    await runCorrectionRequest(element, session, text, debouncerGeneration, {
      metrics: this.options.metrics,
      fieldState,
      currentDebouncerGeneration: () => fieldState.debouncer.currentGeneration(),
      getCard: (el) => {
        if (!fieldState.card) {
          fieldState.card = new CorrectionCard({
            onApply: (corrected, original) => {
              void commitMergedCorrection(el, session, original, corrected, {
                metrics: this.options.metrics,
                fieldState,
                currentDebouncerGeneration: () => fieldState.debouncer.currentGeneration(),
                getCard: () => fieldState.card!,
              })
            },
          })
        }
        return fieldState.card
      },
    })
  }

  private teardownField(element: Element | null | undefined): void {
    if (!element) return
    const session = this.options.engine.sessions.get(element)
    if (!session) return
    const state = this.fieldStates.get(session.field.id)
    if (!state) return
    state.debouncer.cancel()
    if (state.pendingRequestId) void cancelCorrectionRemote(state.pendingRequestId)
    state.card?.hide()
  }
}
