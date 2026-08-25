import type { Command, CommandResult, CorrectionFeature } from '@flowlary/shared'
import type { InputEngine } from '../../core/input/InputEngine.ts'
import { readFieldText, readSelectionRange } from '../../core/dom/read.ts'
import { evaluateFieldSafety } from '../../core/safety/index.ts'
import type { EditableElement } from '../../core/dom/types.ts'
import { stateManager } from '../../core/state/StateManager.ts'
import { isEligibleForCorrection } from './language.ts'
import { runCorrectionRequest, type FieldCorrectionState } from './applyCorrection.ts'
import { createCorrectionMetrics, type CorrectionMetrics } from './metrics.ts'
import { CorrectionScheduler } from './scheduler.ts'
import { CorrectionCard } from './ui/CorrectionCard.ts'
import { IntelligentDebouncer, debounceOptionsForMode } from './debounce.ts'

export type CorrectionModuleOptions = {
  engine: InputEngine
}

export type CorrectionModule = CorrectionFeature & {
  start(): void
  stop(): void
  metrics: CorrectionMetrics
}

export function createCorrectionFeature(options: CorrectionModuleOptions): CorrectionModule {
  const metrics = createCorrectionMetrics()
  const fieldStates = new Map<string, FieldCorrectionState & { debouncer: IntelligentDebouncer }>()

  function getFieldState(fieldId: string, element: EditableElement) {
    let state = fieldStates.get(fieldId)
    if (!state) {
      state = {
        debouncer: new IntelligentDebouncer(() => undefined, debounceOptionsForMode(stateManager.correction.mode)),
        lastSentText: '',
        lastCorrectedFor: '',
        pendingRequestId: null,
        card: null,
      }
      fieldStates.set(fieldId, state)
    }
    return state
  }

  const scheduler = new CorrectionScheduler({ engine: options.engine, metrics })

  let started = false

  return {
    metrics,

    start() {
      if (started) return
      started = true
      scheduler.start()
    },

    stop() {
      if (!started) return
      started = false
      scheduler.stop()
    },

    async execute(command: Command): Promise<CommandResult> {
      if (!stateManager.correction.enabled) {
        return { ok: false, operation: 'CORRECT', error: 'disabled' }
      }
      if (!stateManager.correction.consentAccepted) {
        return { ok: false, operation: 'CORRECT', error: 'consent_required' }
      }
      if (!stateManager.correction.groqApiKey.trim()) {
        return { ok: false, operation: 'CORRECT', error: 'missing_api_key' }
      }

      const element = options.engine.sessions.resolveElement(command.field.id)
      if (!element) {
        return { ok: false, operation: 'CORRECT', error: 'no_target' }
      }

      const editable = element as EditableElement
      const session = options.engine.sessions.getOrCreate(element)
      const text = readFieldText(editable)

      const safety = evaluateFieldSafety(editable, {
        hostname: typeof location !== 'undefined' ? location.hostname : undefined,
        excludedDomains: stateManager.settings.excludedDomains,
        text,
      })
      if (!safety.allowed) {
        return { ok: false, operation: 'CORRECT', error: 'safety_blocked' }
      }

      if (!isEligibleForCorrection(text)) {
        return { ok: false, operation: 'CORRECT', error: 'not_english' }
      }

      const fieldState = getFieldState(session.field.id, editable)
      if (!fieldState.card) {
        fieldState.card = new CorrectionCard({ onApply: () => undefined })
      }

      const gen = fieldState.debouncer.schedule(text)
      const result = await runCorrectionRequest(editable, session, text, gen, {
        metrics,
        fieldState,
        currentDebouncerGeneration: () => gen,
        getCard: () => fieldState.card!,
      })

      if (result === 'committed' || result === 'pending') {
        return {
          ok: true,
          operation: 'CORRECT',
          data: { applied: result === 'committed', mode: stateManager.correction.mode },
        }
      }
      if (result === 'stale' || result === 'aborted') {
        return { ok: false, operation: 'CORRECT', stale: true, aborted: result === 'aborted' }
      }
      if (result === 'busy') {
        return { ok: false, operation: 'CORRECT', error: 'busy' }
      }
      return { ok: false, operation: 'CORRECT', error: result }
    },
  }
}

export type { CorrectionFeature }
