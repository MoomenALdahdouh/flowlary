import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InputEngine } from '../../extension/src/core/input/InputEngine.ts'
import { CommandRouter } from '../../extension/src/core/router/CommandRouter.ts'
import { CommandOrchestrator } from '../../extension/src/core/router/CommandOrchestrator.ts'
import { createCorrectionFeature } from '../../extension/src/features/correction/CorrectionFeature.ts'
import { createTranslationFeature } from '../../extension/src/features/translation/TranslationFeature.ts'
import { createLayoutFeature } from '../../extension/src/features/layout/LayoutFeature.ts'
import { stateManager } from '../../extension/src/core/state/StateManager.ts'
import { createMemoryCacheCoordinator } from '@flowlary/shared'
import { OWNED_DOCUMENT_EVENTS } from '../../extension/src/core/events/EventBus.ts'
import { resetComposition } from '../../extension/src/core/dom/composition.ts'

vi.mock('../../extension/src/features/correction/client.ts', () => ({
  requestCorrectionRemote: vi.fn(),
  cancelCorrectionRemote: vi.fn(),
}))

import { requestCorrectionRemote } from '../../extension/src/features/correction/client.ts'

const mockCorrect = vi.mocked(requestCorrectionRemote)

function focusAndType(ta: HTMLTextAreaElement, value: string): void {
  ta.value = value
  ta.focus()
  ta.setSelectionRange(value.length, value.length)
  ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
  ta.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
}

async function flushDebounce(): Promise<void> {
  await vi.advanceTimersByTimeAsync(200)
  await Promise.resolve()
  await Promise.resolve()
}

describe('Phase 7 — Correction module integration', () => {
  let engine: InputEngine
  let router: CommandRouter
  let orchestrator: CommandOrchestrator
  let correctCalls = 0
  let translateCalls = 0
  let layoutFixCalls = 0

  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = ''
    correctCalls = 0
    translateCalls = 0
    layoutFixCalls = 0
    mockCorrect.mockReset()

    stateManager.settings.enabled = true
    stateManager.settings.excludedDomains = []
    stateManager.correction.enabled = true
    stateManager.correction.consentAccepted = true
    stateManager.correction.aiProvider = 'byok'
    stateManager.correction.groqApiKey = 'gsk_test_key'
    stateManager.correction.mode = 'direct'
    stateManager.translation.liveEnabled = false

    mockCorrect.mockImplementation(async (requestId, text) => {
      correctCalls += 1
      return {
        type: 'CORRECT_TEXT_RESULT',
        ok: true,
        requestId,
        data: {
          originalText: text,
          correctedText: text.replace('dont', "don't"),
          changes: [],
        },
      }
    })

    engine = new InputEngine()
    router = new CommandRouter()

    const correction = createCorrectionFeature({ engine })
    router.registerCorrection(correction)

    const translation = createTranslationFeature({
      engine,
      provider: async () => {
        translateCalls += 1
        return { ok: true, translation: 'x' }
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
    correction.start()
    layout.start()
    translation.start()
    orchestrator.start()
  })

  afterEach(() => {
    orchestrator.stop()
    engine.stop()
    resetComposition()
    vi.useRealTimers()
  })

  it('A — debounced English input triggers correction', async () => {
    const ta = document.createElement('textarea')
    document.body.append(ta)
    focusAndType(ta, 'I dont know what to write today')
    await flushDebounce()
    await vi.waitFor(() => expect(correctCalls).toBeGreaterThan(0))
  })

  it('B — CORRECT does not invoke translation', async () => {
    const ta = document.createElement('textarea')
    ta.value = 'I dont know what to write today'
    document.body.append(ta)
    ta.focus()
    await orchestrator.dispatch('CORRECT')
    expect(translateCalls).toBe(0)
  })

  it('C — CORRECT does not invoke layout', async () => {
    const ta = document.createElement('textarea')
    ta.value = 'I dont know what to write today'
    document.body.append(ta)
    ta.focus()
    await orchestrator.dispatch('CORRECT')
    expect(layoutFixCalls).toBe(0)
  })

  it('D — password field blocks Groq call', async () => {
    const input = document.createElement('input')
    input.type = 'password'
    document.body.append(input)
    focusAndType(input as unknown as HTMLTextAreaElement, 'I dont know secret')
    await flushDebounce()
    expect(correctCalls).toBe(0)
  })

  it('E — Arabic-only text does not call Groq', async () => {
    const ta = document.createElement('textarea')
    document.body.append(ta)
    focusAndType(ta, 'مرحبا كيف حالك اليوم')
    await flushDebounce()
    expect(correctCalls).toBe(0)
  })

  it('F — missing API key blocks Groq call in BYOK mode', async () => {
    stateManager.correction.aiProvider = 'byok'
    stateManager.correction.groqApiKey = ''
    stateManager.correction.consentAccepted = true
    const ta = document.createElement('textarea')
    document.body.append(ta)
    focusAndType(ta, 'I dont know what to write today')
    await flushDebounce()
    expect(correctCalls).toBe(0)
  })

  it('G — stale result does not overwrite newer user text', async () => {
    let resolveSlow: ((value: unknown) => void) | null = null
    mockCorrect.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSlow = resolve
        }),
    )
    const ta = document.createElement('textarea')
    document.body.append(ta)
    focusAndType(ta, 'I dont know what')
    await vi.advanceTimersByTimeAsync(200)
    ta.value = 'I dont know what happened next'
    ta.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
    resolveSlow?.({
      type: 'CORRECT_TEXT_RESULT',
      ok: true,
      requestId: 'x',
      data: {
        originalText: 'I dont know what',
        correctedText: "I don't know what",
        changes: [],
      },
    })
    await Promise.resolve()
    expect(ta.value).toBe('I dont know what happened next')
  })

  it('H — cache keys isolated from TRANSLATE', () => {
    const cache = createMemoryCacheCoordinator()
    const cKey = cache.buildKey({ operation: 'CORRECT', text: 'hello' })
    const tKey = cache.buildKey({
      operation: 'TRANSLATE',
      text: 'hello',
      sourceLanguage: 'ar',
      targetLanguage: 'en',
    })
    expect(cKey.startsWith('CORRECT:')).toBe(true)
    expect(tKey.startsWith('TRANSLATE:')).toBe(true)
  })

  it('I — correction scheduler does not add document listeners', () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const correction = createCorrectionFeature({ engine: new InputEngine() })
    correction.start()
    const globalAdds = addSpy.mock.calls.filter(([type]) =>
      OWNED_DOCUMENT_EVENTS.includes(type as (typeof OWNED_DOCUMENT_EVENTS)[number]),
    )
    expect(globalAdds.length).toBe(0)
    addSpy.mockRestore()
  })

  it('J — instant spell fixes hwo locally in direct mode', async () => {
    const ta = document.createElement('textarea')
    document.body.append(ta)
    focusAndType(ta, 'hello hwo ')
    await flushDebounce()
    expect(ta.value).toContain('how')
  })
})
