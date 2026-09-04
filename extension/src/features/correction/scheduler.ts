import type { InputEngine } from '../../core/input/InputEngine.ts'
import type { FieldSession } from '../../core/session/FieldSession.ts'
import { evaluateFieldSafety } from '../../core/safety/index.ts'
import { readFieldText, isEditableElement } from '../../core/dom/read.ts'
import { commitWriteTransaction } from '../../core/writeGate/writeGate.ts'
import type { EditableElement } from '../../core/dom/types.ts'
import { stateManager } from '../../core/state/StateManager.ts'
import { applyIdleEnglishRepair, applyInstantSpellingIfSafe } from './instantSpell.ts'
import { isCorrectionSchedulerEligible } from './liveAssist.ts'
import { isAssistCooldownActive } from './assistCooldown.ts'
import { recordInstantSpellOutcome } from './recordSpanCorrectionOutcome.ts'
import { shouldShowEnglishAssistant } from './language.ts'
import {
  debounceOptionsForMode,
  IntelligentDebouncer,
} from './debounce.ts'
import { buildLocalCorrectionResponse } from './localSuggestion.ts'
import { extractWritingContext } from './segment.ts'
import {
  runCorrectionRequest,
  acceptCorrectionSuggestion,
  dismissCorrectionSuggestion,
  invalidateCardIfStale,
  syncCardVisibility,
  commitMergedCorrection,
  type FieldCorrectionStateEntry,
} from './applyCorrection.ts'
import type { CorrectionMetrics } from './metrics.ts'
import { CorrectionCard } from './ui/CorrectionCard.ts'
import { cancelCorrectionRemote } from './client.ts'
import { isCorrectionHost } from './ui/CorrectionCard.ts'
import { allowsAutomaticFieldWrite } from '../../core/safety/autoWrite.ts'
import { isShortcutsOnly } from '../../core/policy/writingPolicy.ts'
import { hideEnglishPipelineSuggestion } from '../../core/writeGate/pipelineSuggest.ts'
import { registerEnglishIdleAnalyzer } from '../../core/runtime/WritingRuntime.ts'
import { onFieldRevisionBump } from '../../core/runtime/revisionBump.ts'
import { markOperationCompleted, markOperationRunning } from '../../core/runtime/Operation.ts'
import {
  clearCommitInFlight,
  flushDeferredAutomaticCommits,
  prepareAutomaticWrite,
} from '../../core/runtime/arbitration.ts'
import { isOperationCurrent } from '../../core/runtime/validity.ts'
import type { Operation } from '../../core/runtime/types.ts'
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
  private unsubRevision: (() => void) | null = null
  private fieldStates: Map<string, FieldCorrectionStateEntry>
  private ownsFieldStates: boolean

  constructor(private options: CorrectionSchedulerOptions) {
    this.fieldStates = options.fieldStates ?? new Map()
    this.ownsFieldStates = !options.fieldStates
  }

  async runFromShortcut(
    element: EditableElement,
    orchestratorLock?: {
      requestId: number
      generation: number
      signal: AbortSignal
    },
  ): Promise<'committed' | 'stale' | 'blocked' | 'noop' | 'busy' | 'aborted' | 'error' | 'pending'> {
    const session = this.options.engine.sessions.getOrCreate(element)
    const fieldState = this.getFieldState(session.field.id, element)
    const text = readFieldText(element)
    const operation = session.operations.begin({
      fieldId: session.field.id,
      revision: session.getRevision(),
      feature: 'english',
      purpose: 'shortcut',
      trigger: 'shortcut',
      snapshotFullText: text,
    })
    if (operation.state === 'pending') markOperationRunning(operation)
    const applyOptions = {
      ...this.buildApplyOptions(fieldState),
      orchestratorLock,
      operation,
    }
    const outcome = await runCorrectionRequest(
      element,
      session,
      text,
      fieldState.debouncer.currentGeneration(),
      applyOptions,
    )
    if (outcome === 'committed' || outcome === 'pending') return outcome
    const local = buildLocalCorrectionResponse(text)
    if (!local) return outcome
    return commitMergedCorrection(
      element,
      session,
      local.originalText,
      local.correctedText,
      applyOptions,
      {
        requestId: orchestratorLock?.requestId,
        generation: orchestratorLock?.generation,
        response: local,
        batchId: `local-shortcut-${local.originalText.length}`,
        auto: false,
      },
    )
  }

  start(): void {
    if (this.unsubscribe) return
    registerEnglishIdleAnalyzer((element, operation) => {
      return this.runIdleAnalysis(element, operation)
    })
    this.unsubRevision = onFieldRevisionBump((fieldId) => {
      this.fieldStates.get(fieldId)?.card?.hide()
    })
    this.unsubscribe = this.options.engine.eventBus.subscribe((event) => {
      if (event.origin === 'SYSTEM') return
      if (event.type === 'input') {
        if (event.composing) return
        this.onInput(event.target)
        return
      }
      if (event.type === 'composition-end') {
        this.onInput(event.target)
        return
      }
      if (event.type === 'focus-out') {
        this.teardownField(event.target)
      }
    })
  }

  stop(): void {
    registerEnglishIdleAnalyzer(null)
    this.unsubRevision?.()
    this.unsubRevision = null
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
      // Generation/cancel only. Automatic timing is IdleScheduler, not this timer.
      const debouncer = new IntelligentDebouncer(
        () => undefined,
        debounceOptionsForMode(stateManager.correction.mode),
      )
      state = {
        debouncer,
        lastSentText: '',
        lastCorrectedFor: '',
        pendingRequestId: null,
        lastCorrectionRequestAt: 0,
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
    if (session.isPasteAssistanceSuppressed()) {
      const fieldState = this.getFieldState(session.field.id, element)
      fieldState.card?.hide()
      return
    }

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
    hideEnglishPipelineSuggestion(session.field.id)

    if (!isCorrectionSchedulerEligible()) {
      fieldState.card?.hide()
      return
    }

    syncCardVisibility(element, text, applyOptions)

    if (!text.trim()) {
      if (fieldState.pendingRequestId) void cancelCorrectionRemote(fieldState.pendingRequestId)
      fieldState.card?.hide()
      fieldState.lastSentText = ''
      fieldState.lastCorrectedFor = ''
    }
  }

  async runIdleAnalysis(element: EditableElement, operation?: Operation): Promise<void> {
    const session = this.options.engine.sessions.getOrCreate(element)
    if (session.isComposing()) return
    if (session.isPasteAssistanceSuppressed()) return
    if (operation && !isOperationCurrent(operation, session.getRevision())) return

    const text = readFieldText(element)
    const hostname = typeof location !== 'undefined' ? location.hostname : undefined
    const safety = evaluateFieldSafety(element, {
      hostname,
      excludedDomains: stateManager.settings.excludedDomains,
      text,
    })
    if (!safety.allowed) return
    if (!isCorrectionSchedulerEligible()) return
    if (session.hasTranslatedOverlap(0, text.length) && !stateManager.settings.polishAfterTranslate) return
    if (isShortcutsOnly()) return
    if (!text.trim()) return
    const assistSegment = extractWritingContext(text)
    if (!assistSegment.trim() || !shouldShowEnglishAssistant(assistSegment)) return
    if (isAssistCooldownActive()) return

    await this.onDebounced(
      element,
      text,
      this.getFieldState(session.field.id, element).debouncer.currentGeneration(),
      operation,
    )
  }

  private writeDirectLocalEnglish(
    element: EditableElement,
    session: FieldSession,
    fieldState: FieldCorrectionStateEntry,
    text: string,
    options: { includeOpenToken: boolean; operation?: Operation },
  ): string | null {
    const fixed = options.includeOpenToken ? applyIdleEnglishRepair(text) : applyInstantSpellingIfSafe(text)
    if (fixed === text) return null
    if (options.operation && !isOperationCurrent(options.operation, session.getRevision())) return null
    if (options.operation && options.operation.snapshotFullText !== text) return null
    const writeOperation = options.operation ?? session.operations.begin({
      fieldId: session.field.id,
      revision: session.getRevision(),
      feature: 'english',
      purpose: 'auto-analysis',
      trigger: 'auto',
      snapshotFullText: text,
    })
    const prepared = prepareAutomaticWrite({
      session,
      operation: writeOperation,
      feature: 'english',
      action: 'english_correction',
      effect: 'direct',
      range: { start: 0, end: text.length },
      replacement: fixed,
      resume: () => {
        this.writeDirectLocalEnglish(element, session, fieldState, text, options)
      },
    })
    if (prepared.decision.verdict === 'DEFER') return null
    if (prepared.decision.verdict !== 'ALLOW' || !prepared.authorization) return null
    const acquired = session.tryAcquireWrite('CORRECT')
    if (!acquired.ok) {
      clearCommitInFlight(session)
      recordWriteTelemetry({
        capability: 'correction',
        trigger: 'auto',
        outcome: 'blocked',
        reasonCodes: [acquired.reason === 'composing' ? 'composing' : 'mutex_busy'],
        fieldKind: fieldKindFromElement(element),
        composing: session.isComposing(),
        rangeLength: text.length,
      })
      return null
    }
    try {
      const write = commitWriteTransaction(element, 0, text.length, fixed, {
        origin: 'CORRECT',
        session,
        requestId: acquired.requestId,
        expectedGeneration: acquired.generation,
        allowActiveEdit: true,
        auto: true,
        capability: 'correction',
        trigger: 'auto',
        action: 'english_correction',
        authorization: prepared.authorization,
      })
      recordWriteTelemetry({
        capability: 'correction',
        trigger: 'auto',
        outcome: write.verdict === 'written' ? 'applied' : write.verdict === 'stale' ? 'stale' : 'blocked',
        reasonCodes: [write.verdict === 'written' ? 'written' : write.reason === 'mutex' ? 'mutex_busy' : 'text_mismatch'],
        fieldKind: fieldKindFromElement(element),
        composing: session.isComposing(),
        rangeLength: text.length,
      })
      if (write.verdict !== 'written') return null
      const segment = extractWritingContext(fixed)
      fieldState.lastCorrectedFor = segment
      fieldState.lastSentText = segment
      this.options.metrics.correction_local_hits += 1
      recordInstantSpellOutcome({
        element,
        fullTextBefore: text,
        fullTextAfter: fixed,
      })
      return fixed
    } finally {
      session.releaseWrite('CORRECT', acquired.requestId)
      clearCommitInFlight(session)
      flushDeferredAutomaticCommits(session)
    }
  }

  private async onDebounced(
    element: EditableElement,
    text: string,
    debouncerGeneration: number,
    operation?: Operation,
  ): Promise<void> {
    const session = this.options.engine.sessions.getOrCreate(element)
    const fieldState = this.getFieldState(session.field.id, element)
    let next = text
    let networkOperation = operation
    if (stateManager.correction.mode === 'direct' && allowsAutomaticFieldWrite(element)) {
      const written = this.writeDirectLocalEnglish(element, session, fieldState, text, {
        includeOpenToken: true,
        operation,
      })
      if (written) {
        next = written
        if (operation) markOperationCompleted(operation)
        networkOperation = session.operations.begin({
          fieldId: session.field.id,
          revision: session.getRevision(),
          feature: 'english',
          purpose: 'auto-analysis',
          trigger: 'auto',
          snapshotFullText: written,
        })
        if (networkOperation.state === 'pending') markOperationRunning(networkOperation)
      }
    }
    try {
      await runCorrectionRequest(element, session, next, debouncerGeneration, {
        ...this.buildApplyOptions(fieldState),
        operation: networkOperation,
      })
    } finally {
      if (
        networkOperation
        && networkOperation !== operation
        && networkOperation.state === 'running'
        && networkOperation.revision === session.getRevision()
      ) {
        markOperationCompleted(networkOperation)
      }
    }
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
