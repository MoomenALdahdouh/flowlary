import type { InputEngine } from '../../core/input/InputEngine.ts'
import { isEditableElement } from '../../core/dom/read.ts'
import type { EditableElement } from '../../core/dom/types.ts'
import type { TranslationEngine } from './engine.ts'
import {
  runLiveTranslation,
  type FieldLiveState,
} from './liveTranslate.ts'
import type { TranslationMetrics } from './metrics.ts'
import { LIVE_PAUSE_MS } from './pauseGate.ts'

export { LIVE_PAUSE_MS }

export type TranslationSchedulerOptions = {
  engine: InputEngine
  translationEngine: TranslationEngine
  metrics: TranslationMetrics
}

export class TranslationScheduler {
  private unsubscribe: (() => void) | null = null
  private liveTimer: ReturnType<typeof setTimeout> | null = null
  private pendingElement: EditableElement | null = null
  private fieldStates = new Map<string, FieldLiveState>()

  constructor(private options: TranslationSchedulerOptions) {}

  start(): void {
    // Retired as an EventBus writer. Live translation runs in the enforce pipeline.
  }

  stop(): void {
    this.unsubscribe?.()
    this.unsubscribe = null
    this.cancelPending()
  }

  /** Cancel timer and abort in-flight live translation when live mode is disabled. */
  onLiveDisabled(): void {
    this.cancelPending()
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

  private isLiveEnabled(): boolean {
    return false
  }

  private cancelPending(): void {
    if (this.liveTimer !== null) {
      clearTimeout(this.liveTimer)
      this.liveTimer = null
    }
    if (this.pendingElement) {
      const session = this.options.engine.sessions.get(this.pendingElement)
      session?.abortActiveRequest()
      this.pendingElement = null
    }
  }

  private schedule(element: Element): void {
    if (!isEditableElement(element)) return
    if (!this.isLiveEnabled()) return

    if (this.liveTimer !== null) {
      clearTimeout(this.liveTimer)
    }

    this.pendingElement = element
    this.liveTimer = setTimeout(() => {
      this.liveTimer = null
      const target = this.pendingElement
      this.pendingElement = null
      if (!target || !target.isConnected || !this.isLiveEnabled()) return

      this.options.metrics.translation_live_debounced += 1
      const session = this.options.engine.sessions.getOrCreate(target)
      void runLiveTranslation(target, session, {
        engine: this.options.translationEngine,
        metrics: this.options.metrics,
        fieldState: this.getFieldState(session.field.id),
      })
    }, LIVE_PAUSE_MS)
  }
}
