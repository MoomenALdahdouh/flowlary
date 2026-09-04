import type { InputEngine } from '../../core/input/InputEngine.ts'
import type { TranslationEngine } from './engine.ts'
import type { FieldLiveState } from './liveTranslate.ts'
import type { TranslationMetrics } from './metrics.ts'

/**
 * Not a scheduler. Automatic Arabic → English is owned by IdleScheduler / WritingRuntime.
 * Kept as a shell so TranslationFeature start/stop and live-disable still have a home.
 */
export type TranslationSchedulerOptions = {
  engine: InputEngine
  translationEngine: TranslationEngine
  metrics: TranslationMetrics
}

export class TranslationScheduler {
  private fieldStates = new Map<string, FieldLiveState>()

  constructor(_options: TranslationSchedulerOptions) {}

  start(): void {
    // Automatic live translation is IdleScheduler → Translation Operation → pipeline.
  }

  stop(): void {
    this.onLiveDisabled()
  }

  /** Abort in-flight live translation when live mode is disabled. */
  onLiveDisabled(): void {
    this.fieldStates.clear()
  }

  prepareLiveScheduler(): void {
    this.start()
  }

  getFieldState(fieldId: string): FieldLiveState {
    let state = this.fieldStates.get(fieldId)
    if (!state) {
      state = { lastRequestedKey: null, lastTranslatedKey: null }
      this.fieldStates.set(fieldId, state)
    }
    return state
  }
}

export { LIVE_PAUSE_MS } from './pauseGate.ts'
