import type { Command, OperationType } from '@flowlary/shared'
import { stateManager } from '../state/StateManager.ts'
import { evaluateFieldSafety } from '../safety/index.ts'
import { readFieldText, isEditableElement, readSelectionRange, readCaret } from '../dom/read.ts'
import type { InputEngine } from '../input/InputEngine.ts'
import { resolveCommandTarget, deepActiveElement } from '../input/resolveTarget.ts'
import type { ShortcutCommand } from '../input/shortcuts.ts'
import type { CommandRouter } from './CommandRouter.ts'
import { mapHandlerResult, type DispatchResult } from './dispatch.ts'
import { isTrustedExtensionSender } from '../../messaging/sender.ts'
import { validateContentCommandType } from '../../messaging/validate.ts'
import { runWritingPipeline } from '../writeGate/pipeline.ts'
import { shortcutRangeForOperation } from '../engine/shortcutRange.ts'

const DEDUP_MS = 250

function noteCommandTarget(): void {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return
  try {
    const sent = chrome.runtime.sendMessage({ type: 'NOTE_COMMAND_TARGET' })
    if (sent && typeof (sent as Promise<unknown>).catch === 'function') {
      void (sent as Promise<unknown>).catch(() => undefined)
    }
  } catch {
    /* tests / no service worker */
  }
}

export type CommandOrchestratorOptions = {
  engine: InputEngine
  router: CommandRouter
  onSpeedBox?: () => boolean
}

/** @deprecated use CommandOrchestratorOptions */
export type OrchestratorOptions = CommandOrchestratorOptions

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

  private onSpeedBox: (() => boolean) | null = null

  constructor(options: CommandOrchestratorOptions) {
    this.engine = options.engine
    this.router = options.router
    this.onSpeedBox = options.onSpeedBox ?? null
  }

  start(): void {
    if (this.started) return
    this.started = true

    this.unsubscribe = this.engine.eventBus.subscribe((event) => {
      if (event.type === 'focus-in' || event.type === 'input' || event.type === 'shortcut') {
        noteCommandTarget()
      }
      if (event.type === 'shortcut') {
        void this.handleShortcut(event.command).then((result) => {
          this.lastResult = result
        })
      }
    })

    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      this.messageListener = (message, sender, sendResponse) => {
        if (!isTrustedExtensionSender(sender as chrome.runtime.MessageSender | undefined)) {
          sendResponse({
            status: 'error',
            reason: 'untrusted_sender',
            handlerExecuted: false,
          })
          return false
        }
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
      const opened = this.onSpeedBox?.() ?? false
      const result: DispatchResult = {
        status: opened ? 'speed_box' : 'blocked',
        operation: 'SPEED_BOX',
        reason: opened ? undefined : 'disabled',
        handlerExecuted: opened,
      }
      this.lastResult = result
      return result
    }
    return this.dispatch(command)
  }

  handleRuntimeMessage(message: unknown): Promise<DispatchResult> | null {
    if (!message || typeof message !== 'object' || !('type' in message)) return null
    const typed = message as { type?: string; operation?: string }
    if (typed.type === 'RUN_COMMAND' && typed.operation === 'SPEED_BOX') {
      return this.handleShortcut('SPEED_BOX')
    }
    const validated = validateContentCommandType(message)
    if (!validated.ok) return null
    return this.dispatch(validated.value)
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
      const pipeline = await runWritingPipeline(this.engine, options.target)
      return {
        status: pipeline.ok ? 'success' : 'error',
        operation: 'PIPELINE',
        reason: pipeline.ok ? undefined : pipeline.error,
        handlerExecuted: true,
      }
    }

    if (!stateManager.isActive()) {
      return { status: 'blocked', operation, reason: 'paused', handlerExecuted: false }
    }

    const seed =
      options.target
      ?? this.engine.getActiveElement()
      ?? deepActiveElement(typeof document !== 'undefined' ? document : null)
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
      session.setComposing(false)
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
    if (isEditableElement(resolved.element)) {
      const selection = readSelectionRange(resolved.element)
      const caret = readCaret(resolved.element) ?? text.length
      const span = shortcutRangeForOperation(text, operation, selection, caret)
      if (span) {
        command.rangeStart = span.start
        command.rangeEnd = span.end
      }
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
