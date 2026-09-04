import type { InputEngine } from '../../core/input/InputEngine.ts'
import type { SpeedBox } from './speedBox.ts'

/**
 * Not a scheduler. Automatic Fix Typing is owned by IdleScheduler / WritingRuntime.
 * This listener only closes Speed Box on Escape.
 */
export type LayoutSchedulerOptions = {
  engine: InputEngine
  getSpeedBox: () => SpeedBox
  classifier?: unknown
  metrics?: unknown
  getProfile?: () => unknown
  getExceptions?: () => unknown
}

export class LayoutScheduler {
  private unsubscribe: (() => void) | null = null

  constructor(private options: LayoutSchedulerOptions) {}

  start(): void {
    if (this.unsubscribe) return
    this.unsubscribe = this.options.engine.eventBus.subscribe((event) => {
      if (event.type === 'keydown' && event.key === 'Escape') {
        this.options.getSpeedBox().handleEscape()
      }
    })
  }

  stop(): void {
    this.unsubscribe?.()
    this.unsubscribe = null
  }
}
