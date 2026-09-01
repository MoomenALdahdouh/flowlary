import type { InputEngine } from '../../core/input/InputEngine.ts'
import { evaluateFieldSafety } from '../../core/safety/index.ts'
import { readFieldText, isEditableElement } from '../../core/dom/read.ts'
import { commitWriteTransaction } from '../../core/writeGate/writeGate.ts'
import type { EditableElement } from '../../core/dom/types.ts'
import { stateManager } from '../../core/state/StateManager.ts'
import { applyInstantSpellingIfSafe } from './instantSpell.ts'
import { isEnforceEngineEnabled } from '../../core/engine/flag.ts'
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
  type FieldCorrectionStateEntry,
} from './applyCorrection.ts'
import type { CorrectionMetrics } from './metrics.ts'
import { CorrectionCard } from './ui/CorrectionCard.ts'
import { cancelCorrectionRemote } from './client.ts'
import { isCorrectionHost } from './ui/CorrectionCard.ts'
import { allowsAutomaticFieldWrite } from '../../core/safety/autoWrite.ts'
import { allowAutomaticNetworkAssist, isShortcutsOnly } from '../../core/policy/writingPolicy.ts'
import {
  fieldKindFromElement,
  recordWriteTelemetry,
} from '../../core/observability/writeTelemetry.ts'

export type CorrectionSchedulerOptions = {
  engine: InputEngine
  metrics: CorrectionMetrics
  /** Shared per-field correction state (single source of truth with CorrectionFeature). */
  fieldStates?: Map<string, FieldCorrectionStateEntry>
}

export class CorrectionScheduler {
  private unsubscribe: (() => void) | null = null
  private fieldStates: Map<string, FieldCorrectionStateEntry>
  private ownsFieldStates: boolean

  constructor(private options: CorrectionSchedulerOptions) {
    this.fieldStates = options.fieldStates ?? new Map()
    this.ownsFieldStates = !options.fieldStates
  }

  start(): void {
    // Retired as an EventBus writer. Auto English assist runs in the enforce pipeline.
  }

  stop(): void {
    this.unsubscribe?.()
    this.unsubscribe = null
    if (this.ownsFieldStates) {
      this.clearFieldStates()
    }
  }

  clearFieldStates(): void {
    for (const state of this.fieldStates.values()) {
      state.debouncer.cancel()
      state.card?.destroy()
    }
    this.fieldStates.clear()
  }

  private buildApplyOptions(fieldState: FieldCorrectionStateEntry) {
    return {
      metrics: this.options.metrics,
      fieldState,
      currentDebouncerGeneration: () => fieldState.debouncer.currentGeneration(),
      getCard: (el: EditableElement) => this.ensureCard(el, fieldState),
    }
  }

  private ensureCard(element: EditableElement, fieldState: FieldCorrectionStateEntry): CorrectionCard {
    if (!fieldState.card) {
      const applyOptions = this.buildApplyOptions(fieldState)
      fieldState.card = new CorrectionCard({
        highlights: stateManager.correction.highlights,
        onApply: (binding) => {
          const session = this.options.engine.sessions.getOrCreate(element)
          void acceptCorrectionSuggestion(element, session, binding, applyOptions)
        },
        onDismiss: (binding) => {
          dismissCorrectionSuggestion(element, binding, applyOptions)
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

    if (isEnforceEngineEnabled()) {
      fieldState.debouncer.cancel()
      return
    }
    if (session.hasTranslatedOverlap(0, text.length) && !stateManager.settings.polishAfterTranslate) {
      fieldState.debouncer.cancel()
      return
    }

    if (isShortcutsOnly()) {
      recordWriteTelemetry({
        capability: 'correction',
        trigger: 'auto',
        outcome: 'noop',
        reasonCodes: ['shortcuts_only'],
        fieldKind: fieldKindFromElement(element),
        composing: session.isComposing(),
      })
      fieldState.debouncer.cancel()
      return
    }

    if (!allowsAutomaticFieldWrite(element)) {
      recordWriteTelemetry({
        capability: 'correction',
        trigger: 'auto',
        outcome: 'blocked',
        reasonCodes: ['unsupported_editor_auto_write'],
        fieldKind: fieldKindFromElement(element),
        composing: session.isComposing(),
      })
      if (stateManager.correction.mode === 'direct') {
        fieldState.debouncer.cancel()
        return
      }
    }

    let workingText = text
    if (
      stateManager.correction.mode === 'direct' &&
      allowsAutomaticFieldWrite(element)
    ) {
      if (endsWithWordBoundary(text) || endsWithSentenceBoundary(text)) {
        const fixed = applyInstantSpellingIfSafe(text)
        if (fixed !== text) {
          const acquired = session.tryAcquireWrite('CORRECT')
          if (!acquired.ok) {
            recordWriteTelemetry({
              capability: 'correction',
              trigger: 'auto',
              outcome: 'blocked',
              reasonCodes: [acquired.reason === 'composing' ? 'composing' : 'mutex_busy'],
              fieldKind: fieldKindFromElement(element),
              composing: session.isComposing(),
              rangeLength: text.length,
            })
          } else {
            const write = commitWriteTransaction(element, 0, text.length, fixed, {
              origin: 'CORRECT',
              session,
              requestId: acquired.requestId,
              expectedGeneration: acquired.generation,
              allowActiveEdit: true,
              auto: true,
              capability: 'correction',
              trigger: 'auto',
            })
            session.releaseWrite('CORRECT', acquired.requestId)
            recordWriteTelemetry({
              capability: 'correction',
              trigger: 'auto',
              outcome: write.verdict === 'written' ? 'applied' : write.verdict === 'stale' ? 'stale' : 'blocked',
              reasonCodes: [write.verdict === 'written' ? 'written' : write.reason === 'mutex' ? 'mutex_busy' : 'text_mismatch'],
              fieldKind: fieldKindFromElement(element),
              composing: session.isComposing(),
              rangeLength: text.length,
            })
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

    const assistSegment = extractWritingContext(workingText)
    if (!assistSegment.trim() || !shouldShowEnglishAssistant(assistSegment)) {
      fieldState.debouncer.cancel()
      fieldState.card?.hide()
      return
    }

    if (!allowAutomaticNetworkAssist()) {
      recordWriteTelemetry({
        capability: 'correction',
        trigger: 'auto',
        outcome: 'skipped',
        reasonCodes: ['shortcuts_only'],
        fieldKind: fieldKindFromElement(element),
      })
      fieldState.debouncer.cancel()
      return
    }

    if (!allowsAutomaticFieldWrite(element) && stateManager.correction.mode === 'direct') {
      fieldState.debouncer.cancel()
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
