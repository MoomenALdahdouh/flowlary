import type { Command, OperationType } from '@flowlary/shared'
import { stateManager } from '../state/StateManager.ts'
import { evaluateFieldSafety } from '../safety/index.ts'
import { readFieldText, isEditableElement } from '../dom/read.ts'
import type { InputEngine } from '../input/InputEngine.ts'
import { resolveCommandTarget } from '../input/resolveTarget.ts'
import type { ShortcutCommand } from '../input/shortcuts.ts'
import type { CommandRouter } from './CommandRouter.ts'
import { mapHandlerResult, type DispatchResult } from './dispatch.ts'

const DEDUP_MS = 250

export type OrchestratorOptions = {
  engine: InputEngine
  router: CommandRouter
}

/**
 * Content-script command pipeline.
 *
 * shortcut / RUN_COMMAND message
 *   → resolve field
 *   → safety
 *   → FieldSession mutex
 *   → CommandRouter
 *   → stub handler (Phase 3)
 *
 * Does NOT dispatch on ordinary user input (no auto-correct / auto-translate).
 */
export class CommandOrchestrator {
  readonly engine: InputEngine
  readonly router: CommandRouter
  /** Operations whose feature handler actually ran. */
  readonly executed: OperationType[] = []
  /** Last recognized content-script shortcut, including SPEED_BOX. */
  lastShortcut: ShortcutCommand | null = null
  lastResult: DispatchResult | null = null
  /** Count of automatic feature commands generated from input events (must stay 0). */
  autoCommandsFromInput = 0

  private started = false
  private lastDispatchAt = 0
  private lastDispatchKey = ''
  private unsubscribe: (() => void) | null = null
  private messageListener:
    | ((message: unknown, sender: unknown, sendResponse: (value: unknown) => void) => boolean)
    | null = null

  constructor(options: OrchestratorOptions) {
    this.engine = options.engine
    this.router = options.router
  }

  start(): void {
    if (this.started) return
    this.started = true

    this.unsubscribe = this.engine.eventBus.subscribe((event) => {
      if (event.type === 'shortcut') {
        void this.handleShortcut(event.command).then((result) => {
          this.lastResult = result
        })
      }
    })

    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      this.messageListener = (message, _sender, sendResponse) => {
        const handled = this.handleRuntimeMessage(message)
        if (handled) {
          void handled.then(sendResponse)
          return true
        }
        return false
      }
      chrome.runtime.onMessage.addListener(this.messageListener)
    }
  }

  stop(): void {
    this.unsubscribe?.()
    this.unsubscribe = null
    if (this.messageListener && typeof chrome !== 'undefined') {
      chrome.runtime.onMessage.removeListener(this.messageListener)
    }
    this.messageListener = null
    this.started = false
  }

  async handleShortcut(command: ShortcutCommand): Promise<DispatchResult> {
    this.lastShortcut = command
    if (this.isDuplicate(command)) {
      return this.lastResult ?? { status: 'error', reason: 'duplicate', handlerExecuted: false }
    }
    if (command === 'SPEED_BOX') {
      const result: DispatchResult = {
        status: 'speed_box',
        operation: 'SPEED_BOX',
        handlerExecuted: false,
      }
      this.lastResult = result
      return result
    }
    return this.dispatch(command)
  }

  handleRuntimeMessage(message: unknown): Promise<DispatchResult> | null {
    if (!message || typeof message !== 'object' || !('type' in message)) return null
    const type = (message as { type: string }).type
    if (type === 'RUN_COMMAND') {
      const operation = (message as { operation?: OperationType }).operation
      if (operation === 'TRANSLATE' || operation === 'FIX_LAYOUT' || operation === 'CORRECT') {
        return this.dispatch(operation)
      }
    }
    if (type === 'DISPATCH_COMMAND') {
      const command = (message as { command?: Command }).command
      if (command?.type) return this.dispatch(command.type)
    }
    return null
  }

  async dispatch(
    operation: OperationType,
    options: { target?: Element | null } = {},
  ): Promise<DispatchResult> {
    const result = await this.dispatchInner(operation, options)
    this.lastResult = result
    return result
  }

  private async dispatchInner(
    operation: OperationType,
    options: { target?: Element | null } = {},
  ): Promise<DispatchResult> {

    if (operation === 'PIPELINE') {
      return {
        status: 'error',
        operation: 'PIPELINE',
        reason: 'pipeline_not_implemented',
        handlerExecuted: false,
      }
    }

    if (!stateManager.isActive()) {
      return { status: 'blocked', operation, reason: 'paused', handlerExecuted: false }
    }

    const seed = options.target ?? this.engine.getActiveElement() ?? document.activeElement
    const resolved = resolveCommandTarget(seed)
    if (!resolved) {
      return { status: 'no_target', operation, handlerExecuted: false }
    }

    const text = resolved.adapter
      ? resolved.adapter.getText()
      : isEditableElement(resolved.element)
        ? readFieldText(resolved.element)
        : ''

    const safety = evaluateFieldSafety(resolved.element, {
      hostname: typeof location !== 'undefined' ? location.hostname : undefined,
      excludedDomains: stateManager.settings.excludedDomains,
      text,
      caretOffset: resolved.adapter?.getCaret() ?? undefined,
      token: text.trim() || undefined,
    })
    if (!safety.allowed) {
      return {
        status: 'blocked',
        operation,
        reason: safety.reason,
        handlerExecuted: false,
      }
    }

    const session = this.engine.sessions.getOrCreate(resolved.element)
    if (session.isComposing()) {
      return {
        status: 'busy',
        operation,
        reason: 'composing',
        fieldId: session.field.id,
        handlerExecuted: false,
      }
    }

    const acquire = session.tryAcquireWrite(operation)
    if (!acquire.ok) {
      return {
        status: 'busy',
        operation,
        reason: acquire.reason,
        fieldId: session.field.id,
        handlerExecuted: false,
      }
    }

    const command: Command = {
      type: operation,
      field: session.field,
      text,
      generation: acquire.generation,
      requestId: acquire.requestId,
      sourceLanguage: stateManager.translation.sourceLanguage,
      targetLanguage: stateManager.translation.targetLanguage,
    }

    try {
      this.executed.push(operation)
      const result = await this.router.dispatch(command)

      if (acquire.signal.aborted) {
        return {
          status: 'aborted',
          operation,
          fieldId: session.field.id,
          handlerExecuted: true,
        }
      }

      const commit = session.canCommit(acquire.generation, acquire.requestId)
      if (!commit.ok) {
        session.releaseWrite(operation, acquire.requestId)
        const status =
          commit.reason === 'stale-generation' || commit.reason === 'stale-request'
            ? 'stale'
            : commit.reason === 'aborted'
              ? 'aborted'
              : 'busy'
        return {
          status,
          operation,
          fieldId: session.field.id,
          reason: commit.reason,
          handlerExecuted: true,
        }
      }

      session.releaseWrite(operation, acquire.requestId)
      return mapHandlerResult(operation, session.field.id, result)
    } catch (error) {
      session.releaseWrite(operation, acquire.requestId)
      return {
        status: 'error',
        operation,
        fieldId: session.field.id,
        reason: error instanceof Error ? error.message : 'error',
        handlerExecuted: true,
      }
    }
  }

  private isDuplicate(operation: string): boolean {
    const now = Date.now()
    const key = operation
    if (this.lastDispatchKey === key && now - this.lastDispatchAt < DEDUP_MS) {
      return true
    }
    this.lastDispatchKey = key
    this.lastDispatchAt = now
    return false
  }
}
