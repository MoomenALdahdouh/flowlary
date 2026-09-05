import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InputEngine } from '../../extension/src/core/input/InputEngine.ts'
import { CommandRouter } from '../../extension/src/core/router/CommandRouter.ts'
import { CommandOrchestrator } from '../../extension/src/core/router/CommandOrchestrator.ts'
import { createTranslationFeature } from '../../extension/src/features/translation/TranslationFeature.ts'
import { createStubCorrectionFeature } from '@flowlary/shared'
import { createLayoutFeature } from '../../extension/src/features/layout/LayoutFeature.ts'
import { stateManager } from '../../extension/src/core/state/StateManager.ts'
import { detectShortcut } from '../../extension/src/core/input/shortcuts.ts'
import { writeReplacement } from '../../extension/src/core/dom/editor.ts'
import { createMemoryCacheCoordinator } from '@flowlary/shared'
import { OWNED_DOCUMENT_EVENTS } from '../../extension/src/core/events/EventBus.ts'

function shortcutEvent(code: string) {
  return new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ctrlKey: true,
    shiftKey: true,
    code,
  })
}

describe('Phase 5 — Translation module integration', () => {
  let engine: InputEngine
  let router: CommandRouter
  let orchestrator: CommandOrchestrator
  let translateCalls = 0
  let correct: ReturnType<typeof vi.fn>
  let layoutFixCalls = 0

  beforeEach(() => {
    document.body.innerHTML = ''
    translateCalls = 0
    layoutFixCalls = 0
    stateManager.settings.enabled = true
    stateManager.settings.pausedUntil = null
    stateManager.settings.excludedDomains = []
    stateManager.translation.shortcutEnabled = true
    stateManager.translation.liveEnabled = false
    stateManager.translation.sourceLanguage = 'ar'
    stateManager.translation.targetLanguage = 'en'

    engine = new InputEngine()
    router = new CommandRouter()
    correct = vi.fn(createStubCorrectionFeature().execute)
    router.registerCorrection({ execute: correct })

    const translation = createTranslationFeature({
      engine,
      provider: async (request) => {
        translateCalls += 1
        return { ok: true, translation: `EN:${request.text}` }
      },
    })
    router.registerTranslation(translation)

    const layout = createLayoutFeature({ engine })
    const originalExecute = layout.execute.bind(layout)
    layout.execute = async (command) => {
      layoutFixCalls += 1
      return originalExecute(command)
    }
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
    engine.stop()
  })

  it('1 — Ctrl/Cmd+Shift+Y dispatches TRANSLATE', async () => {
    const ta = document.createElement('textarea')
    ta.value = 'مرحبا'
    document.body.append(ta)
    ta.focus()
    ta.dispatchEvent(shortcutEvent('KeyY'))
    await vi.waitFor(() => expect(orchestrator.lastResult?.status).toBe('success'))
    expect(orchestrator.executed).toContain('TRANSLATE')
  })

  it('2 — shortcut uses physical KeyY code (Comma still accepted)', () => {
    expect(detectShortcut(shortcutEvent('KeyY'))).toBe('TRANSLATE')
    expect(detectShortcut(shortcutEvent('Comma'))).toBe('TRANSLATE')
  })

  it('3 — translates active textarea', async () => {
    const ta = document.createElement('textarea')
    ta.value = 'مرحبا'
    document.body.append(ta)
    ta.focus()
    const result = await orchestrator.dispatch('TRANSLATE')
    expect(result.status).toBe('success')
    expect(ta.value).toBe('EN:مرحبا')
    expect(translateCalls).toBe(1)
  })

  it('4 — translates contenteditable', async () => {
    const edit = document.createElement('div')
    edit.contentEditable = 'true'
    edit.textContent = 'مرحبا'
    document.body.append(edit)
    edit.focus()
    const range = document.createRange()
    range.selectNodeContents(edit)
    range.collapse(false)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
    const result = await orchestrator.dispatch('TRANSLATE')
    expect(result.status).toBe('success')
    expect(edit.textContent).toBe('EN:مرحبا')
  })

  it('5 — translates selected text only', async () => {
    const ta = document.createElement('textarea')
    ta.value = 'I want شراء هذا المنتج today.'
    document.body.append(ta)
    ta.focus()
    const selected = 'شراء هذا المنتج'
    const start = ta.value.indexOf(selected)
    ta.setSelectionRange(start, start + selected.length)
    await orchestrator.dispatch('TRANSLATE')
    expect(ta.value).toBe('I want EN:شراء هذا المنتج today.')
  })

  it('6 — blocks unsafe password field before provider', async () => {
    const input = document.createElement('input')
    input.type = 'password'
    input.value = 'secret'
    document.body.append(input)
    input.focus()
    const result = await orchestrator.dispatch('TRANSLATE')
    expect(result.status).toBe('blocked')
    expect(translateCalls).toBe(0)
  })

  it('7 — mutex busy blocks second TRANSLATE', () => {
    const ta = document.createElement('textarea')
    document.body.append(ta)
    const session = engine.sessions.getOrCreate(ta)
    session.tryAcquireWrite('FIX_LAYOUT')
    expect(session.tryAcquireWrite('TRANSLATE').ok).toBe(false)
  })

  it('8 — stale when generation advances before write', async () => {
    const ta = document.createElement('textarea')
    ta.value = 'مرحبا'
    document.body.append(ta)
    const session = engine.sessions.getOrCreate(ta)
    const acquire = session.tryAcquireWrite('TRANSLATE')
    if (!acquire.ok) return
    session.bumpGeneration()
    const translation = createTranslationFeature({
      engine,
      provider: async (request) => ({ ok: true, translation: `EN:${request.text}` }),
    })
    const result = await translation.execute({
      type: 'TRANSLATE',
      field: session.field,
      text: ta.value,
      generation: acquire.generation,
      requestId: acquire.requestId,
      sourceLanguage: 'ar',
      targetLanguage: 'en',
    })
    expect(result.stale).toBe(true)
    session.releaseWrite('TRANSLATE', acquire.requestId)
  })

  it('9 — controlled TRANSLATE write does not bump generation', () => {
    const ta = document.createElement('textarea')
    ta.value = 'مرحبا'
    document.body.append(ta)
    const session = engine.sessions.getOrCreate(ta)
    const before = session.getGeneration()
    writeReplacement(ta, 0, 5, 'hello', { origin: 'TRANSLATE', session })
    expect(session.getGeneration()).toBe(before)
  })

  it('10 — failure leaves original text unchanged', async () => {
    const ta = document.createElement('textarea')
    ta.value = 'مرحبا'
    document.body.append(ta)
    ta.focus()
    router.register('TRANSLATE', async () => ({
      ok: false,
      operation: 'TRANSLATE',
      error: 'translation_unavailable',
    }))
    await orchestrator.dispatch('TRANSLATE')
    expect(ta.value).toBe('مرحبا')
  })

  it('11 — empty field does not call provider', async () => {
    const ta = document.createElement('textarea')
    ta.value = '   '
    document.body.append(ta)
    ta.focus()
    await orchestrator.dispatch('TRANSLATE')
    expect(translateCalls).toBe(0)
  })

  it('12 — TRANSLATE does not chain CORRECT', async () => {
    const ta = document.createElement('textarea')
    ta.value = 'مرحبا'
    document.body.append(ta)
    ta.focus()
    await orchestrator.dispatch('TRANSLATE')
    expect(correct).not.toHaveBeenCalled()
  })

  it('13 — TRANSLATE does not chain FIX_LAYOUT', async () => {
    const ta = document.createElement('textarea')
    ta.value = 'مرحبا'
    document.body.append(ta)
    ta.focus()
    await orchestrator.dispatch('TRANSLATE')
    expect(layoutFixCalls).toBe(0)
  })

  it('14 — cache keys isolated from FIX_LAYOUT', () => {
    const cache = createMemoryCacheCoordinator()
    const tKey = cache.buildKey({
      operation: 'TRANSLATE',
      text: 'hello',
      sourceLanguage: 'ar',
      targetLanguage: 'en',
    })
    const fKey = cache.buildKey({
      operation: 'FIX_LAYOUT',
      text: 'hello',
      layoutSource: 'en-US-qwerty',
      layoutCandidates: ['ar-101'],
    })
    expect(tKey.startsWith('TRANSLATE:')).toBe(true)
    expect(fKey.startsWith('FIX_LAYOUT:')).toBe(true)
    expect(tKey).not.toBe(fKey)
  })

  it('15 — no feature adds global document listeners', () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const translation = createTranslationFeature({ engine: new InputEngine() })
    translation.prepareLiveScheduler()
    const globalAdds = addSpy.mock.calls.filter(([type]) =>
      OWNED_DOCUMENT_EVENTS.includes(type as (typeof OWNED_DOCUMENT_EVENTS)[number]),
    )
    expect(globalAdds.length).toBe(0)
    addSpy.mockRestore()
  })

  it('16 — paused extension blocks translation', async () => {
    stateManager.settings.enabled = false
    const ta = document.createElement('textarea')
    ta.value = 'مرحبا'
    document.body.append(ta)
    ta.focus()
    const result = await orchestrator.dispatch('TRANSLATE')
    expect(result.status).toBe('blocked')
    expect(translateCalls).toBe(0)
  })

  it('17 — protected token blocked before provider', async () => {
    const ta = document.createElement('textarea')
    ta.value = 'sk-abcdefghijklmnopqrstuvwxyz123456'
    document.body.append(ta)
    ta.focus()
    await orchestrator.dispatch('TRANSLATE')
    expect(translateCalls).toBe(0)
  })
})
