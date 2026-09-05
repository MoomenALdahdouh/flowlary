import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InputEngine } from '../../extension/src/core/input/InputEngine.ts'
import { CommandRouter } from '../../extension/src/core/router/CommandRouter.ts'
import { CommandOrchestrator } from '../../extension/src/core/router/CommandOrchestrator.ts'
import { createLayoutFeature } from '../../extension/src/features/layout/LayoutFeature.ts'
import { createStubCorrectionFeature, createStubTranslationFeature } from '@flowlary/shared'
import { stateManager } from '../../extension/src/core/state/StateManager.ts'
import { OWNED_DOCUMENT_EVENTS } from '../../extension/src/core/events/EventBus.ts'
import { detectShortcut } from '../../extension/src/core/input/shortcuts.ts'
import { applyUserWritingPolicy } from '../../extension/src/core/policy/writingPolicy.ts'
import { setInternalEngineMode } from '../../extension/src/core/engine/flag.ts'
import { runFieldCycle } from '../../extension/src/core/writeGate/pipeline.ts'
import { writeReplacement } from '../../extension/src/core/dom/editor.ts'
import { bumpUserGeneration } from '../../extension/src/core/dom/generation.ts'

function shortcutEvent(code: string) {
  return new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ctrlKey: true,
    shiftKey: true,
    code,
  })
}

describe('Phase 4 — Layout module integration', () => {
  let engine: InputEngine
  let router: CommandRouter
  let orchestrator: CommandOrchestrator
  let layout: ReturnType<typeof createLayoutFeature>
  let correct: ReturnType<typeof vi.fn>
  let translate: ReturnType<typeof vi.fn>

  beforeEach(() => {
    document.body.innerHTML = ''
    stateManager.settings.helpStyle = 'auto'
    stateManager.settings.fixWrongTyping = true
    stateManager.layout.autoEnabled = true
    stateManager.layout.mode = 'direct'
    stateManager.layout.directShortcutEnabled = true
    stateManager.layout.manualConversionEnabled = true
    stateManager.layout.sourceLayout = 'en-US-qwerty'
    stateManager.layout.targetLayouts = ['ar-101']

    engine = new InputEngine()
    router = new CommandRouter()
    correct = vi.fn(createStubCorrectionFeature().execute)
    translate = vi.fn(createStubTranslationFeature().execute)
    router.registerCorrection({ execute: correct })
    router.registerTranslation({ execute: translate })
    layout = createLayoutFeature({ engine })
    router.registerLayout(layout)
    orchestrator = new CommandOrchestrator({
      engine,
      router,
      onSpeedBox: () => layout.handleSpeedBox(),
    })
    engine.start()
    layout.start()
    orchestrator.start()
  })

  afterEach(() => {
    orchestrator.stop()
    layout.stop()
    engine.stop()
  })

  it('1 — FIX_LAYOUT reaches LayoutFeature', async () => {
    const ta = document.createElement('textarea')
    ta.value = 'lvpfh'
    document.body.append(ta)
    ta.focus()
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))

    const result = await orchestrator.dispatch('FIX_LAYOUT')
    expect(result.handlerExecuted).toBe(true)
    expect(result.status).toBe('success')
    expect(ta.value).toBe('مرحبا')
  })

  it('2 — unsafe password field blocks layout', async () => {
    const input = document.createElement('input')
    input.type = 'password'
    document.body.append(input)
    input.focus()
    const result = await orchestrator.dispatch('FIX_LAYOUT')
    expect(result.status).toBe('blocked')
    expect(result.handlerExecuted).toBe(false)
  })

  it('3 — mixed Arabic/English token fix preserves neighbors', async () => {
    const ta = document.createElement('textarea')
    ta.value = 'hello lvpfh world'
    document.body.append(ta)
    ta.focus()
    await orchestrator.dispatch('FIX_LAYOUT')
    expect(ta.value).toBe('hello مرحبا world')
  })

  it('4 — stale when generation advances during command', async () => {
    const ta = document.createElement('textarea')
    ta.value = 'lvpfh'
    document.body.append(ta)
    const session = engine.sessions.getOrCreate(ta)
    const acquire = session.tryAcquireWrite('FIX_LAYOUT')
    if (!acquire.ok) return
    session.bumpGeneration()
    const result = await layout.execute({
      type: 'FIX_LAYOUT',
      field: session.field,
      text: 'lvpfh',
      generation: acquire.generation,
      requestId: acquire.requestId,
    })
    expect(result.stale).toBe(true)
    session.releaseWrite('FIX_LAYOUT', acquire.requestId)
  })

  it('5 — mutex prevents simultaneous writes', () => {
    const ta = document.createElement('textarea')
    document.body.append(ta)
    const session = engine.sessions.getOrCreate(ta)
    const first = session.tryAcquireWrite('FIX_LAYOUT')
    const second = session.tryAcquireWrite('FIX_LAYOUT')
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(false)
    if (first.ok) session.releaseWrite('FIX_LAYOUT', first.requestId)
  })

  it('6 — controlled FIX_LAYOUT write does not bump user generation', () => {
    const ta = document.createElement('textarea')
    ta.value = 'lvpfh'
    document.body.append(ta)
    const session = engine.sessions.getOrCreate(ta)
    const before = session.getGeneration()
    writeReplacement(ta, 0, 5, 'مرحبا', { origin: 'FIX_LAYOUT', session })
    expect(session.getGeneration()).toBe(before)
  })

  it('7 — no second global document listener', () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const layout2 = createLayoutFeature({ engine: new InputEngine() })
    layout2.start()
    const globalAdds = addSpy.mock.calls.filter(([type]) =>
      OWNED_DOCUMENT_EVENTS.includes(type as (typeof OWNED_DOCUMENT_EVENTS)[number]),
    )
    expect(globalAdds.length).toBe(0)
    layout2.stop()
    addSpy.mockRestore()
  })

  it('8 — multiple fields stay isolated', async () => {
    const a = document.createElement('textarea')
    const b = document.createElement('textarea')
    a.value = 'lvpfh'
    b.value = 'lvpfh'
    document.body.append(a, b)
    a.focus()
    await orchestrator.dispatch('FIX_LAYOUT')
    expect(a.value).toBe('مرحبا')
    expect(b.value).toBe('lvpfh')
  })

  it('11 — Speed Box shortcut reaches layout subsystem', async () => {
    const ta = document.createElement('textarea')
    document.body.append(ta)
    ta.focus()
    ta.dispatchEvent(shortcutEvent('KeyL'))
    await vi.waitFor(() => expect(orchestrator.lastShortcut).toBe('SPEED_BOX'))
    expect(orchestrator.lastResult?.status).toBe('speed_box')
    expect(document.getElementById('flowlary-speed-box')).toBeTruthy()
  })

  it('12 — Ctrl+Shift+P does not trigger translation', async () => {
    const ta = document.createElement('textarea')
    ta.value = 'lvpfh'
    document.body.append(ta)
    ta.focus()
    ta.dispatchEvent(shortcutEvent('KeyP'))
    await vi.waitFor(() => expect(orchestrator.lastResult?.status).toBe('success'))
    expect(translate).not.toHaveBeenCalled()
  })

  it('13 — Ctrl+Shift+P does not trigger correction', async () => {
    const ta = document.createElement('textarea')
    ta.value = 'lvpfh'
    document.body.append(ta)
    ta.focus()
    ta.dispatchEvent(shortcutEvent('KeyP'))
    await vi.waitFor(() => expect(orchestrator.lastResult?.status).toBe('success'))
    expect(correct).not.toHaveBeenCalled()
  })

  it('15 — layout write preserves caret after token replace', async () => {
    const ta = document.createElement('textarea')
    ta.value = 'hello lvpfh world'
    document.body.append(ta)
    ta.focus()
    ta.setSelectionRange(11, 11)
    await orchestrator.dispatch('FIX_LAYOUT', { target: ta })
    expect(ta.value).toBe('hello مرحبا world')
    expect(ta.selectionStart).toBeGreaterThan(0)
  })

  it('17 — ignored token stays unchanged on FIX_LAYOUT', async () => {
    layout.setProfileState({
      layoutProfile: {
        sourceLayout: 'en-US-qwerty',
        enabledLayouts: ['en-US-qwerty', 'ar-101'],
      },
      personalExceptions: ['lvpfh'],
      events: [],
    })
    const ta = document.createElement('textarea')
    ta.value = 'lvpfh'
    document.body.append(ta)
    ta.focus()
    const result = await orchestrator.dispatch('FIX_LAYOUT')
    expect(ta.value).toBe('lvpfh')
    expect(result.status).not.toBe('success')
  })

  it('20 — paused extension blocks layout command', async () => {
    stateManager.settings.enabled = false
    const ta = document.createElement('textarea')
    ta.value = 'lvpfh'
    document.body.append(ta)
    ta.focus()
    const result = await orchestrator.dispatch('FIX_LAYOUT')
    expect(result.status).toBe('blocked')
  })

  it('detects shortcuts without collision', () => {
    expect(detectShortcut(shortcutEvent('KeyY'))).toBe('TRANSLATE')
    expect(detectShortcut(shortcutEvent('Comma'))).toBe('TRANSLATE')
    expect(detectShortcut(shortcutEvent('KeyP'))).toBe('FIX_LAYOUT')
    expect(detectShortcut(shortcutEvent('KeyE'))).toBe('CORRECT')
    expect(detectShortcut(shortcutEvent('KeyL'))).toBe('SPEED_BOX')
  })

  it('auto pipeline does not dispatch feature commands from typing', async () => {
    applyUserWritingPolicy({
      helpStyle: 'auto',
      fixWrongTyping: true,
      improveEnglish: false,
      arabicToEnglishMode: false,
    })
    setInternalEngineMode('enforce')
    const ta = document.createElement('textarea')
    ta.value = 'lvpfh '
    document.body.append(ta)
    ta.focus()
    await runFieldCycle(ta, engine.sessions.getOrCreate(ta))
    expect(orchestrator.autoCommandsFromInput).toBe(0)
  })
})
