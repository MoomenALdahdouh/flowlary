import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InputEngine } from '../../extension/src/core/input/InputEngine.ts'
import { CommandRouter } from '../../extension/src/core/router/CommandRouter.ts'
import { CommandOrchestrator } from '../../extension/src/core/router/CommandOrchestrator.ts'
import { bumpUserGeneration } from '../../extension/src/core/dom/generation.ts'
import { writeReplacement } from '../../extension/src/core/dom/editor.ts'
import { FieldSession } from '../../extension/src/core/session/FieldSession.ts'
import { stateManager } from '../../extension/src/core/state/StateManager.ts'
import { detectShortcut } from '../../extension/src/core/input/shortcuts.ts'
import { OWNED_DOCUMENT_EVENTS } from '../../extension/src/core/events/EventBus.ts'
import type { Command, OperationType } from '@flowlary/shared'

function stub(operation: OperationType) {
  return vi.fn(async (command: Command) => ({
    ok: false,
    operation: command.type,
    error: 'feature_not_ported',
  }))
}

function shortcutEvent(code: string, extra: KeyboardEventInit = {}) {
  return new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ctrlKey: true,
    shiftKey: true,
    code,
    ...extra,
  })
}

describe('Phase 3 — InputEngine + CommandRouter wiring', () => {
  let engine: InputEngine
  let router: CommandRouter
  let orchestrator: CommandOrchestrator
  let correct: ReturnType<typeof stub>
  let translate: ReturnType<typeof stub>
  let layout: ReturnType<typeof stub>

  beforeEach(() => {
    document.body.innerHTML = ''
    stateManager.settings.enabled = true
    stateManager.settings.pausedUntil = null
    engine = new InputEngine()
    router = new CommandRouter()
    correct = stub('CORRECT')
    translate = stub('TRANSLATE')
    layout = stub('FIX_LAYOUT')
    router.register('CORRECT', correct)
    router.register('TRANSLATE', translate)
    router.register('FIX_LAYOUT', layout)
    orchestrator = new CommandOrchestrator({
      engine,
      router,
      onSpeedBox: () => true,
    })
    engine.start()
    orchestrator.start()
  })

  afterEach(() => {
    orchestrator.stop()
    engine.stop()
  })

  it('TEST 1 — focusin on textarea creates FieldSession', () => {
    const ta = document.createElement('textarea')
    document.body.append(ta)
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(engine.getActiveElement()).toBe(ta)
    expect(engine.getActiveSession()).toBeDefined()
    expect(engine.getSession(ta)).toBe(engine.getActiveSession())
  })

  it('TEST 2 — multiple fields keep isolated sessions', () => {
    const a = document.createElement('textarea')
    const b = document.createElement('textarea')
    document.body.append(a, b)
    a.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    const sessionA = engine.getSession(a)!
    b.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    const sessionB = engine.getSession(b)!
    expect(sessionA).not.toBe(sessionB)
    expect(engine.getActiveElement()).toBe(b)
    expect(engine.getSession(a)).toBe(sessionA)
  })

  it('TEST 3 — user input increments generation exactly once', () => {
    const ta = document.createElement('textarea')
    document.body.append(ta)
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(engine.getActiveSession()?.getGeneration()).toBe(0)
    ta.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
    expect(engine.getActiveSession()?.getGeneration()).toBe(1)
  })

  it('TEST 4 — controlled CORRECT write does not bump user generation', () => {
    const ta = document.createElement('textarea')
    ta.value = 'hello'
    document.body.append(ta)
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    ta.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
    const afterUser = engine.getActiveSession()!.getGeneration()
    writeReplacement(ta, 0, 5, 'world', { origin: 'CORRECT' })
    ta.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' }),
    )
    expect(engine.getActiveSession()!.getGeneration()).toBe(afterUser)
  })

  it('TEST 5 — composition state is correct', () => {
    const ta = document.createElement('textarea')
    document.body.append(ta)
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    const session = engine.getActiveSession()!
    ta.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    expect(session.isComposing()).toBe(true)
    ta.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertCompositionText' }))
    expect(session.getGeneration()).toBe(0)
    ta.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
    expect(session.isComposing()).toBe(false)
  })

  it('TEST 6 — Ctrl/Cmd+Shift+, routes TRANSLATE', async () => {
    const ta = document.createElement('textarea')
    ta.value = 'hello'
    document.body.append(ta)
    ta.focus()
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    ta.dispatchEvent(shortcutEvent('Comma'))
    await vi.waitFor(() => expect(orchestrator.lastResult?.status).toBe('feature_not_ported'))
    expect(orchestrator.executed).toContain('TRANSLATE')
    expect(translate).toHaveBeenCalledTimes(1)
    expect(correct).not.toHaveBeenCalled()
    expect(layout).not.toHaveBeenCalled()
  })

  it('TEST 7 — Ctrl/Cmd+Shift+P routes FIX_LAYOUT', async () => {
    const ta = document.createElement('textarea')
    document.body.append(ta)
    ta.focus()
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    ta.dispatchEvent(shortcutEvent('KeyP'))
    await vi.waitFor(() => expect(orchestrator.executed).toContain('FIX_LAYOUT'))
    expect(layout).toHaveBeenCalledTimes(1)
    expect(translate).not.toHaveBeenCalled()
  })

  it('TEST 8 — shortcuts do not collide', async () => {
    const ta = document.createElement('textarea')
    document.body.append(ta)
    ta.focus()
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    const t = await orchestrator.dispatch('TRANSLATE')
    const f = await orchestrator.dispatch('FIX_LAYOUT')
    expect(t.operation).toBe('TRANSLATE')
    expect(f.operation).toBe('FIX_LAYOUT')
    expect(translate).toHaveBeenCalledTimes(1)
    expect(layout).toHaveBeenCalledTimes(1)
    expect(correct).not.toHaveBeenCalled()
  })

  it('TEST 9 — CORRECT isolation', async () => {
    const ta = document.createElement('textarea')
    document.body.append(ta)
    ta.focus()
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    await orchestrator.dispatch('CORRECT')
    expect(correct).toHaveBeenCalledTimes(1)
    expect(translate).not.toHaveBeenCalled()
    expect(layout).not.toHaveBeenCalled()
  })

  it('TEST 10 — safety blocks password TRANSLATE', async () => {
    const password = document.createElement('input')
    password.type = 'password'
    document.body.append(password)
    password.focus()
    const result = await orchestrator.dispatch('TRANSLATE', { target: password })
    expect(result.status).toBe('blocked')
    expect(result.handlerExecuted).toBe(false)
    expect(translate).not.toHaveBeenCalled()
  })

  it('TEST 11 — no target', async () => {
    const result = await orchestrator.dispatch('TRANSLATE')
    expect(result.status).toBe('no_target')
    expect(result.handlerExecuted).toBe(false)
    expect(translate).not.toHaveBeenCalled()
  })

  it('TEST 12 — mutex allows one writer', () => {
    const ta = document.createElement('textarea')
    const session = new FieldSession(ta)
    expect(session.tryAcquireWrite('TRANSLATE').ok).toBe(true)
    expect(session.tryAcquireWrite('FIX_LAYOUT').ok).toBe(false)
    expect(session.tryAcquireWrite('CORRECT').ok).toBe(false)
  })

  it('TEST 13 — aborted operation cannot commit', () => {
    const ta = document.createElement('textarea')
    const session = new FieldSession(ta)
    const acquired = session.tryAcquireWrite('CORRECT')
    if (!acquired.ok) throw new Error('acquire failed')
    session.abortActiveRequest()
    expect(session.canCommit(acquired.generation, acquired.requestId).ok).toBe(false)
  })

  it('TEST 14 — stale after user input', () => {
    const ta = document.createElement('textarea')
    document.body.append(ta)
    const session = engine.sessions.getOrCreate(ta)
    const acquired = session.tryAcquireWrite('CORRECT')
    if (!acquired.ok) throw new Error('acquire failed')
    bumpUserGeneration(ta, session)
    expect(session.canCommit(acquired.generation, acquired.requestId).ok).toBe(false)
  })

  it('TEST 15 — TRANSLATE does not chain CORRECT', async () => {
    const ta = document.createElement('textarea')
    document.body.append(ta)
    ta.focus()
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    await orchestrator.dispatch('TRANSLATE')
    expect(correct).not.toHaveBeenCalled()
    expect(orchestrator.executed).toEqual(['TRANSLATE'])
  })

  it('TEST 16 — CORRECT does not chain TRANSLATE', async () => {
    const ta = document.createElement('textarea')
    document.body.append(ta)
    ta.focus()
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    await orchestrator.dispatch('CORRECT')
    expect(translate).not.toHaveBeenCalled()
    expect(orchestrator.executed).toEqual(['CORRECT'])
  })

  it('TEST 17 — controlled write does not auto-dispatch a feature', () => {
    const ta = document.createElement('textarea')
    ta.value = 'hello'
    document.body.append(ta)
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    writeReplacement(ta, 0, 5, 'world', { origin: 'TRANSLATE' })
    ta.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' }),
    )
    expect(orchestrator.executed).toEqual([])
    expect(orchestrator.autoCommandsFromInput).toBe(0)
    expect(translate).not.toHaveBeenCalled()
    expect(correct).not.toHaveBeenCalled()
  })

  it('TEST 18 — Ctrl/Cmd+Shift+L is recognized as Speed Box (no UI)', async () => {
    const ta = document.createElement('textarea')
    document.body.append(ta)
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    ta.dispatchEvent(shortcutEvent('KeyL'))
    await vi.waitFor(() => expect(orchestrator.lastShortcut).toBe('SPEED_BOX'))
    expect(orchestrator.lastResult?.status).toBe('speed_box')
    expect(layout).not.toHaveBeenCalled()
    expect(translate).not.toHaveBeenCalled()
  })

  it('TEST 19 — command targets the focused field', async () => {
    const a = document.createElement('textarea')
    const b = document.createElement('textarea')
    a.id = 'a'
    b.id = 'b'
    document.body.append(a, b)
    a.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    const result = await orchestrator.dispatch('TRANSLATE', { target: a })
    expect(result.fieldId).toBe(engine.getSession(a)!.field.id)
    expect(result.fieldId).not.toBe(engine.getSession(b)?.field.id)
  })

  it('TEST 20 — Field B input does not invalidate Field A operation', () => {
    const a = document.createElement('textarea')
    const b = document.createElement('textarea')
    document.body.append(a, b)
    const sessionA = engine.sessions.getOrCreate(a)
    const sessionB = engine.sessions.getOrCreate(b)
    const acquired = sessionA.tryAcquireWrite('CORRECT')
    if (!acquired.ok) throw new Error('acquire failed')
    bumpUserGeneration(b, sessionB)
    expect(sessionA.canCommit(acquired.generation, acquired.requestId).ok).toBe(true)
    expect(sessionA.getGeneration()).not.toBe(sessionB.getGeneration())
  })

  it('TEST 21 — command goes only to focused field A', async () => {
    const a = document.createElement('textarea')
    const b = document.createElement('textarea')
    document.body.append(a, b)
    a.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    await orchestrator.dispatch('FIX_LAYOUT')
    const command = layout.mock.calls[0]?.[0] as Command
    expect(command.field.id).toBe(engine.getSession(a)!.field.id)
  })

  it('TEST 22 — code editor TRANSLATE is blocked', async () => {
    const code = document.createElement('div')
    code.className = 'monaco-editor'
    code.contentEditable = 'true'
    document.body.append(code)
    const result = await orchestrator.dispatch('TRANSLATE', { target: code })
    expect(result.status).toBe('blocked')
    expect(translate).not.toHaveBeenCalled()
  })

  it('INVARIANT — InputEngine owns the documented document listeners', () => {
    expect([...engine.ownedEvents]).toEqual([...OWNED_DOCUMENT_EVENTS])
    expect(engine.isStarted()).toBe(true)
  })

  it('detects physical shortcut codes', () => {
    expect(detectShortcut(shortcutEvent('Comma'))).toBe('TRANSLATE')
    expect(detectShortcut(shortcutEvent('KeyP'))).toBe('FIX_LAYOUT')
    expect(detectShortcut(shortcutEvent('KeyE'))).toBe('CORRECT')
    expect(detectShortcut(shortcutEvent('KeyL'))).toBe('SPEED_BOX')
    expect(detectShortcut(shortcutEvent('KeyP', { metaKey: true, ctrlKey: false }))).toBe(
      'FIX_LAYOUT',
    )
  })

  it('blocks OTP, payment, username, email, URL fields', async () => {
    const cases: Array<[Record<string, string>, string]> = [
      [{ type: 'text', autocomplete: 'one-time-code' }, 'otp-field'],
      [{ type: 'text', name: 'cvv' }, 'payment-field'],
      [{ type: 'text', autocomplete: 'username' }, 'username-field'],
      [{ type: 'email' }, 'email-field'],
      [{ type: 'url' }, 'url-field'],
    ]
    for (const [attrs] of cases) {
      const input = document.createElement('input')
      for (const [key, value] of Object.entries(attrs)) {
        if (key === 'type') input.type = value
        else input.setAttribute(key, value)
      }
      document.body.append(input)
      const result = await orchestrator.dispatch('TRANSLATE', { target: input })
      expect(result.status, JSON.stringify(attrs)).toBe('blocked')
      expect(translate).not.toHaveBeenCalled()
      translate.mockClear()
    }
  })

  it('RUN_COMMAND message uses the same orchestrator path', async () => {
    const ta = document.createElement('textarea')
    document.body.append(ta)
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    const pending = orchestrator.handleRuntimeMessage({
      type: 'RUN_COMMAND',
      operation: 'TRANSLATE',
    })
    expect(pending).not.toBeNull()
    const result = await pending!
    expect(result.status).toBe('feature_not_ported')
    expect(translate).toHaveBeenCalledTimes(1)
  })
})
