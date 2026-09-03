import type { InputEngine } from '../input/InputEngine.ts'
import { isEditableElement } from '../dom/read.ts'
import { isEnforceEngineEnabled } from '../engine/flag.ts'
import { runFieldCycle } from './pipeline.ts'

const TRIGGER_KEYS = new Set([' ', 'Enter', 'Tab'])

let unsubscribe: (() => void) | null = null
const pendingRetry = new WeakMap<Element, ReturnType<typeof setTimeout>>()

export function startEnforceCoordinator(engine: InputEngine): void {
  if (unsubscribe) return
  unsubscribe = engine.eventBus.subscribe((event) => {
    if (!isEnforceEngineEnabled()) return
    if (event.origin === 'SYSTEM') return
    if (event.type === 'input') {
      if (event.composing) return
      void runIfEditable(engine, event.target)
      return
    }
    if (event.type === 'composition-update') return
    if (event.type === 'keyup' && TRIGGER_KEYS.has(event.key)) {
      void runIfEditable(engine, event.target)
    }
    if (event.type === 'focus-out' && event.target) {
      const session = engine.sessions.getOrCreate(event.target)
      session.requestCommitOpenToken()
      void runIfEditable(engine, event.target)
    }
  })
}

export function stopEnforceCoordinator(): void {
  unsubscribe?.()
  unsubscribe = null
}

export function scheduleEnforceRetry(
  engine: InputEngine,
  target: Element,
  delayMs: number,
): void {
  const existing = pendingRetry.get(target)
  if (existing) clearTimeout(existing)
  pendingRetry.set(
    target,
    setTimeout(() => {
      pendingRetry.delete(target)
      void runIfEditable(engine, target)
    }, Math.max(0, delayMs)),
  )
}

async function runIfEditable(engine: InputEngine, target: Element | null | undefined): Promise<void> {
  if (!target || !isEditableElement(target)) return
  const session = engine.sessions.getOrCreate(target)
  if (session.isBulkPasteInput()) return
  if (session.isComposing()) return
  if (session.isInCooldown()) {
    scheduleEnforceRetry(engine, target, session.getCooldownUntil() - Date.now() + 16)
    return
  }
  await runFieldCycle(target, session)
}
