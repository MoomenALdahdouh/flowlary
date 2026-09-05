import type { Command, CommandResult, CorrectionFeature } from '@flowlary/shared'
import type { InputEngine } from '../../core/input/InputEngine.ts'
import { readFieldText } from '../../core/dom/read.ts'
import { evaluateFieldSafety } from '../../core/safety/index.ts'
import type { EditableElement } from '../../core/dom/types.ts'
import { stateManager } from '../../core/state/StateManager.ts'
import { resolveExplicitSelectionTarget } from '../../core/engine/shortcutSelection.ts'
import { isEligibleForCorrection } from './language.ts'
import { type FieldCorrectionStateEntry } from './applyCorrection.ts'
import { createCorrectionMetrics, type CorrectionMetrics } from './metrics.ts'
import { CorrectionScheduler } from './scheduler.ts'
import {
  registerCorrectionFieldStates,
  unregisterCorrectionFieldStates,
} from './correctionLiveState.ts'
import {
  registerCorrectionFeedback,
  unregisterCorrectionFeedback,
} from './correctionFeedback.ts'

export type CorrectionModuleOptions = {
  engine: InputEngine
}

export type CorrectionModule = CorrectionFeature & {
  start(): void
  stop(): void
  clearFieldStates(): void
  metrics: CorrectionMetrics
}

export function createCorrectionFeature(options: CorrectionModuleOptions): CorrectionModule {
  const metrics = createCorrectionMetrics()
  const fieldStates = new Map<string, FieldCorrectionStateEntry>()
  const scheduler = new CorrectionScheduler({ engine: options.engine, metrics, fieldStates })
  registerCorrectionFieldStates(fieldStates)
  registerCorrectionFeedback({ engine: options.engine, fieldStates })

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
      unregisterCorrectionFieldStates()
      unregisterCorrectionFeedback()
    },

    clearFieldStates() {
      scheduler.clearFieldStates()
    },

    async execute(command: Command): Promise<CommandResult> {
      if (!stateManager.correction.enabled) {
        return { ok: false, operation: 'CORRECT', error: 'disabled' }
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

      const selectionTarget = resolveExplicitSelectionTarget(text, command)
      if (command.explicitSelection && !selectionTarget) {
        return { ok: false, operation: 'CORRECT', stale: true }
      }

      const eligibilityText = selectionTarget?.text ?? text
      if (!isEligibleForCorrection(eligibilityText)) {
        return { ok: false, operation: 'CORRECT', error: 'not_english' }
      }

      const active = session.getActiveRequest()
      const ownsOrchestratorLock =
        typeof command.requestId === 'number' &&
        active != null &&
        active.operation === 'CORRECT' &&
        active.requestId === command.requestId
      const outcome = await scheduler.runFromShortcut(
        editable,
        ownsOrchestratorLock && active
          ? {
              requestId: active.requestId,
              generation: active.generation,
              signal: active.signal,
            }
          : undefined,
        selectionTarget ?? undefined,
      )
      if (outcome === 'committed' || outcome === 'pending') {
        return {
          ok: true,
          operation: 'CORRECT',
          data: { applied: outcome === 'committed', mode: stateManager.correction.mode },
        }
      }
      if (outcome === 'stale' || outcome === 'aborted') {
        return { ok: false, operation: 'CORRECT', stale: true }
      }
      if (outcome === 'busy') {
        return { ok: false, operation: 'CORRECT', error: 'busy' }
      }
      if (outcome === 'blocked') {
        return { ok: false, operation: 'CORRECT', error: 'consent_required' }
      }
      return { ok: false, operation: 'CORRECT', error: 'noop' }
    },
  }
}

export type { CorrectionFeature }
