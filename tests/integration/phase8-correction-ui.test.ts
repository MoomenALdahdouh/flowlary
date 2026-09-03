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
import { applyUserWritingPolicy } from '../../extension/src/core/policy/writingPolicy.ts'
import { setInternalEngineMode } from '../../extension/src/core/engine/flag.ts'
import { runFieldCycle } from '../../extension/src/core/writeGate/pipeline.ts'
import {
  resetPipelineEnglishForTests,
  setPipelineEnglishDebounceMsForTests,
} from '../../extension/src/core/writeGate/pipelineEnglish.ts'
import {
  getActivePipelineSuggestion,
  resetPipelineSuggestionsForTests,
} from '../../extension/src/core/writeGate/pipelineSuggest.ts'

const SUGGEST_HOST = 'data-flowlary-suggestion-host'

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
    stateManager.correction.highlights = true
    stateManager.correction.mode = 'box'
    stateManager.translation.liveEnabled = false
    applyUserWritingPolicy({
      helpStyle: 'suggestions',
      improveEnglish: true,
      fixWrongTyping: true,
      arabicToEnglishMode: false,
    })
    setInternalEngineMode('enforce')
    setPipelineEnglishDebounceMsForTests(0)

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
    resetPipelineEnglishForTests()
    resetPipelineSuggestionsForTests()
    orchestrator.stop()
    correction.stop()
    engine.stop()
    resetComposition()
    vi.useRealTimers()
  })

  it('A — pipeline suggestion card appears for remote English', async () => {
    const ta = document.createElement('textarea')
    document.body.append(ta)
    ta.value = 'I dont know what to write today'
    ta.focus()
    await runFieldCycle(ta, engine.sessions.getOrCreate(ta))
    await flushDebounce()
    await vi.waitFor(() => expect(document.querySelector(`[${SUGGEST_HOST}]`)).toBeTruthy())
  })

  it('B — accept writes corrected text', async () => {
    const ta = document.createElement('textarea')
    document.body.append(ta)
    ta.value = 'I dont know what to write today'
    ta.focus()
    await runFieldCycle(ta, engine.sessions.getOrCreate(ta))
    await flushDebounce()
    await vi.waitFor(() => document.querySelector(`[${SUGGEST_HOST}]`))

    const host = document.querySelector(`[${SUGGEST_HOST}]`) as HTMLElement
    const card = host.shadowRoot!.querySelector('.card') as HTMLElement
    card.click()
    await Promise.resolve()

    expect(ta.value).toContain("don't")
    expect(document.querySelector(`[${SUGGEST_HOST}]`)).toBeNull()
  })

  it('C — dismiss leaves text unchanged', async () => {
    const ta = document.createElement('textarea')
    document.body.append(ta)
    const original = 'I dont know what to write today'
    ta.value = original
    ta.focus()
    await runFieldCycle(ta, engine.sessions.getOrCreate(ta))
    await flushDebounce()
    await vi.waitFor(() => document.querySelector(`[${SUGGEST_HOST}]`))

    const host = document.querySelector(`[${SUGGEST_HOST}]`) as HTMLElement
    const card = host.shadowRoot!.querySelector('.card') as HTMLElement
    card.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(ta.value).toBe(original)
  })

  it('D — user edit invalidates card', async () => {
    const ta = document.createElement('textarea')
    document.body.append(ta)
    ta.value = 'I dont know what'
    ta.focus()
    const session = engine.sessions.getOrCreate(ta)
    await runFieldCycle(ta, session)
    await flushDebounce()
    await vi.waitFor(() => document.querySelector(`[${SUGGEST_HOST}]`))

    ta.value = 'I dont know what happened next'
    await runFieldCycle(ta, session)

    const active = getActivePipelineSuggestion(session.field.id)
    expect(active?.sourceText === 'I dont know what').toBe(false)
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

  it('I — pipeline English assist does not loop after a suggestion', async () => {
    const ta = document.createElement('textarea')
    document.body.append(ta)
    ta.value = 'I dont know what to write today'
    ta.focus()
    const session = engine.sessions.getOrCreate(ta)
    await runFieldCycle(ta, session)
    await flushDebounce()
    const callsAfterWrite = correctCalls
    await runFieldCycle(ta, session)
    await flushDebounce()
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

    ta1.value = 'I dont know what to write today'
    ta1.focus()
    await runFieldCycle(ta1, engine.sessions.getOrCreate(ta1))
    await flushDebounce()
    await vi.waitFor(() => document.querySelector(`[${SUGGEST_HOST}]`))

    ta2.value = 'I dont know either way today'
    ta2.focus()
    await runFieldCycle(ta2, engine.sessions.getOrCreate(ta2))
    await flushDebounce()
    const hosts = document.querySelectorAll(`[${SUGGEST_HOST}]`)
    expect(hosts.length).toBeGreaterThan(0)
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
