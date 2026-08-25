import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InputEngine } from '../../extension/src/core/input/InputEngine.ts'
import { CommandRouter } from '../../extension/src/core/router/CommandRouter.ts'
import { CommandOrchestrator } from '../../extension/src/core/router/CommandOrchestrator.ts'
import { createCorrectionFeature } from '../../extension/src/features/correction/CorrectionFeature.ts'
import { createTranslationFeature } from '../../extension/src/features/translation/TranslationFeature.ts'
import { createLayoutFeature } from '../../extension/src/features/layout/LayoutFeature.ts'
import { stateManager } from '../../extension/src/core/state/StateManager.ts'
import { resetComposition } from '../../extension/src/core/dom/composition.ts'
import { HOST_ATTR } from '../../extension/src/features/correction/ui/CorrectionCard.ts'
import { withWriteOrigin } from '../../extension/src/core/dom/writeOrigin.ts'
import { writeReplacement } from '../../extension/src/core/dom/editor.ts'

vi.mock('../../extension/src/features/correction/client.ts', () => ({
  requestCorrectionRemote: vi.fn(),
  cancelCorrectionRemote: vi.fn(),
}))

import { requestCorrectionRemote } from '../../extension/src/features/correction/client.ts'

const mockCorrect = vi.mocked(requestCorrectionRemote)

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

function focusAndType(el: HTMLTextAreaElement | HTMLInputElement, value: string): void {
  el.value = value
  el.focus()
  el.setSelectionRange(value.length, value.length)
  el.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
  el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
}

async function flushDebounce(): Promise<void> {
  await vi.advanceTimersByTimeAsync(200)
  await Promise.resolve()
  await Promise.resolve()
}

describe('Phase 8 — CorrectionCard + direct-edit integration', () => {
  let engine: InputEngine
  let router: CommandRouter
  let orchestrator: CommandOrchestrator
  let correction: ReturnType<typeof createCorrectionFeature>
  let correctCalls = 0

  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    vi.useFakeTimers()
    document.body.innerHTML = ''
    correctCalls = 0
    mockCorrect.mockReset()

    stateManager.settings.enabled = true
    stateManager.settings.excludedDomains = []
    stateManager.correction.enabled = true
    stateManager.correction.consentAccepted = true
    stateManager.correction.groqApiKey = 'gsk_test_key'
    stateManager.correction.highlights = true
    stateManager.correction.mode = 'box'
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
    correction = createCorrectionFeature({ engine })
    router.registerCorrection(correction)

    const translation = createTranslationFeature({
      engine,
      provider: async () => ({ ok: true, translation: 'x' }),
    })
    router.registerTranslation(translation)

    const layout = createLayoutFeature({ engine })
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
    correction.stop()
    engine.stop()
    resetComposition()
    vi.useRealTimers()
  })

  it('A — correction result shows card in box mode', async () => {
    const ta = document.createElement('textarea')
    document.body.append(ta)
    focusAndType(ta, 'I dont know what to write today')
    await flushDebounce()
    await vi.waitFor(() => expect(document.querySelector(`[${HOST_ATTR}]`)).toBeTruthy())
    expect(correctCalls).toBeGreaterThan(0)
    expect(correction.metrics.correction_card_shown).toBeGreaterThan(0)
  })

  it('B — accept writes corrected text', async () => {
    const ta = document.createElement('textarea')
    document.body.append(ta)
    focusAndType(ta, 'I dont know what to write today')
    await flushDebounce()
    await vi.waitFor(() => document.querySelector(`[${HOST_ATTR}]`))

    const host = document.querySelector(`[${HOST_ATTR}]`) as HTMLElement
    const apply = host.shadowRoot!.querySelector('.apply') as HTMLButtonElement
    apply.click()
    await Promise.resolve()

    expect(ta.value).toContain("don't")
    expect(correction.metrics.correction_card_accepted).toBe(1)
    expect(document.querySelector(`[${HOST_ATTR}]`)).toBeNull()
  })

  it('C — dismiss leaves text unchanged', async () => {
    const ta = document.createElement('textarea')
    document.body.append(ta)
    const original = 'I dont know what to write today'
    focusAndType(ta, original)
    await flushDebounce()
    await vi.waitFor(() => document.querySelector(`[${HOST_ATTR}]`))

    const host = document.querySelector(`[${HOST_ATTR}]`) as HTMLElement
    host.shadowRoot!.querySelector('.dismiss')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(ta.value).toBe(original)
    expect(correction.metrics.correction_card_dismissed).toBe(1)
  })

  it('D — user edit invalidates card', async () => {
    const ta = document.createElement('textarea')
    document.body.append(ta)
    focusAndType(ta, 'I dont know what')
    await flushDebounce()
    await vi.waitFor(() => document.querySelector(`[${HOST_ATTR}]`))

    ta.value = 'I dont know what happened next'
    ta.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
    await Promise.resolve()

    expect(document.querySelector(`[${HOST_ATTR}]`)).toBeNull()
    expect(correction.metrics.correction_card_stale).toBeGreaterThan(0)
  })

  it('E — stale accept does not write', async () => {
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

  it('F — correction and translation cannot write simultaneously', async () => {
    const ta = document.createElement('textarea')
    ta.value = 'I dont know what to write today'
    document.body.append(ta)
    ta.focus()

    const session = engine.sessions.getOrCreate(ta)
    const lock = session.tryAcquireWrite('TRANSLATE')
    expect(lock.ok).toBe(true)

    await orchestrator.dispatch('CORRECT')
    expect(mockCorrect).not.toHaveBeenCalled()

    session.releaseWrite('TRANSLATE', lock.requestId)
  })

  it('G — correction and layout cannot write simultaneously', async () => {
    const ta = document.createElement('textarea')
    ta.value = 'I dont know what to write today'
    document.body.append(ta)
    ta.focus()

    const session = engine.sessions.getOrCreate(ta)
    const lock = session.tryAcquireWrite('LAYOUT')
    expect(lock.ok).toBe(true)

    await orchestrator.dispatch('CORRECT')
    expect(mockCorrect).not.toHaveBeenCalled()

    session.releaseWrite('LAYOUT', lock.requestId)
  })

  it('H — direct edit uses WriteOrigin.CORRECT', async () => {
    stateManager.correction.mode = 'direct'
    const ta = document.createElement('textarea')
    ta.value = 'I dont know what to write today'
    document.body.append(ta)
    ta.focus()
    await orchestrator.dispatch('CORRECT')
    expect(ta.value).toContain("don't")
    expect(correction.metrics.correction_direct_edit).toBeGreaterThan(0)
    expect(correction.metrics.correction_commits).toBeGreaterThan(0)
    expect(document.querySelector(`[${HOST_ATTR}]`)).toBeNull()
  })

  it('I — correction write does not trigger another correction', async () => {
    stateManager.correction.mode = 'direct'
    const ta = document.createElement('textarea')
    document.body.append(ta)
    focusAndType(ta, 'I dont know what to write today')
    await flushDebounce()
    await vi.waitFor(() => expect(correctCalls).toBe(1))
    expect(ta.value).toContain("don't")

    const callsAfterWrite = correctCalls
    await vi.advanceTimersByTimeAsync(500)
    expect(correctCalls).toBe(callsAfterWrite)
  })

  it('J — safety-blocked field never shows card', async () => {
    const input = document.createElement('input')
    input.type = 'password'
    document.body.append(input)
    focusAndType(input as unknown as HTMLTextAreaElement, 'I dont know secret')
    await flushDebounce()
    expect(document.querySelector(`[${HOST_ATTR}]`)).toBeNull()
    expect(correctCalls).toBe(0)
  })

  it('K — Arabic text does not show card', async () => {
    const ta = document.createElement('textarea')
    document.body.append(ta)
    focusAndType(ta, 'مرحبا كيف حالك اليوم')
    await flushDebounce()
    expect(document.querySelector(`[${HOST_ATTR}]`)).toBeNull()
    expect(correctCalls).toBe(0)
  })

  it('L — code editor region does not show card', async () => {
    const wrap = document.createElement('div')
    wrap.className = 'monaco-editor'
    const ta = document.createElement('textarea')
    wrap.append(ta)
    document.body.append(wrap)
    focusAndType(ta, 'I dont know what to write today')
    await flushDebounce()
    expect(document.querySelector(`[${HOST_ATTR}]`)).toBeNull()
    expect(correctCalls).toBe(0)
  })

  it('one card per field with multiple fields', async () => {
    const ta1 = document.createElement('textarea')
    const ta2 = document.createElement('textarea')
    document.body.append(ta1, ta2)

    focusAndType(ta1, 'I dont know what to write today')
    await flushDebounce()
    await vi.waitFor(() => document.querySelector(`[${HOST_ATTR}]`))
    const host1 = document.querySelector(`[${HOST_ATTR}]`) as HTMLElement
    expect(host1.previousElementSibling).toBe(ta1)

    focusAndType(ta2, 'I dont know either way today')
    await flushDebounce()
    await vi.waitFor(() => expect(correctCalls).toBe(2))
    const hosts = document.querySelectorAll(`[${HOST_ATTR}]`)
    expect(hosts.length).toBeLessThanOrEqual(2)
  })

  it('WriteOrigin.CORRECT bypasses user input generation', () => {
    const ta = document.createElement('textarea')
    document.body.append(ta)
    ta.value = 'hello'
    const session = engine.sessions.getOrCreate(ta)
    const genBefore = session.getGeneration()

    withWriteOrigin('CORRECT', () => {
      writeReplacement(ta, 0, ta.value.length, 'hello world', {
        origin: 'CORRECT',
        session,
        requestId: session.nextRequestId(),
        expectedGeneration: session.getGeneration(),
      })
    })

    expect(session.getGeneration()).toBe(genBefore)
  })
})
