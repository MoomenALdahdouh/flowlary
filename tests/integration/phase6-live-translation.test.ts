import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createStubCorrectionFeature } from '@flowlary/shared'
import { InputEngine } from '../../extension/src/core/input/InputEngine.ts'
import { CommandRouter } from '../../extension/src/core/router/CommandRouter.ts'
import { CommandOrchestrator } from '../../extension/src/core/router/CommandOrchestrator.ts'
import { createTranslationFeature } from '../../extension/src/features/translation/TranslationFeature.ts'
import { createLayoutFeature } from '../../extension/src/features/layout/LayoutFeature.ts'
import { stateManager } from '../../extension/src/core/state/StateManager.ts'
import { LIVE_PAUSE_MS } from '../../extension/src/features/translation/pauseGate.ts'
import { runLiveTranslation } from '../../extension/src/features/translation/liveTranslate.ts'
import { TranslationEngine } from '../../extension/src/features/translation/engine.ts'
import { createTranslationMetrics } from '../../extension/src/features/translation/metrics.ts'
import { writeReplacement } from '../../extension/src/core/dom/editor.ts'
import { OWNED_DOCUMENT_EVENTS } from '../../extension/src/core/events/EventBus.ts'
import { resetComposition } from '../../extension/src/core/dom/composition.ts'
import { setInternalEngineMode, resetEngineModeForTests } from '../../extension/src/core/engine/flag.ts'
import {
  startEnforceCoordinator,
  stopEnforceCoordinator,
} from '../../extension/src/core/writeGate/enforceCoordinator.ts'
import { setPipelineTranslateFnForTests } from '../../extension/src/core/writeGate/pipelineTranslate.ts'
import { applyUserWritingPolicy } from '../../extension/src/core/policy/writingPolicy.ts'

function enableLiveMode() {
  applyUserWritingPolicy({
    helpStyle: 'auto',
    fixWrongTyping: false,
    improveEnglish: false,
    arabicToEnglishMode: true,
  })
  stateManager.translation.liveEnabled = true
}

function focusAndType(ta: HTMLTextAreaElement, value: string): void {
  ta.value = value
  ta.focus()
  ta.setSelectionRange(value.length, value.length)
  ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
  ta.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
}

async function flushLiveTranslation(): Promise<void> {
  await vi.advanceTimersByTimeAsync(LIVE_PAUSE_MS)
  await Promise.resolve()
  await Promise.resolve()
}

describe('Phase 6 — Live translation', () => {
  let engine: InputEngine
  let router: CommandRouter
  let orchestrator: CommandOrchestrator
  let translateCalls = 0
  let translation: ReturnType<typeof createTranslationFeature>
  let correct: ReturnType<typeof vi.fn>
  let layoutFixCalls = 0

  beforeEach(() => {
    vi.useFakeTimers()
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
    stateManager.layout.autoEnabled = false

    engine = new InputEngine()
    router = new CommandRouter()
    correct = vi.fn(createStubCorrectionFeature().execute)
    router.registerCorrection({ execute: correct })

    translation = createTranslationFeature({
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
    setInternalEngineMode('enforce')
    startEnforceCoordinator(engine)
    setPipelineTranslateFnForTests(async (text) => {
      translateCalls += 1
      return { ok: true, translation: `EN:${text}` }
    })
    engine.start()
    layout.start()
    translation.start()
    orchestrator.start()
  })

  afterEach(() => {
    orchestrator.stop()
    translation.stop()
    stopEnforceCoordinator()
    engine.stop()
    resetComposition()
    setPipelineTranslateFnForTests(null)
    resetEngineModeForTests()
    vi.useRealTimers()
  })

  it('1 — live translation defaults OFF', () => {
    expect(stateManager.translation.liveEnabled).toBe(false)
    focusAndType(document.createElement('textarea'), 'مرحبا')
    vi.advanceTimersByTime(LIVE_PAUSE_MS + 50)
    expect(translateCalls).toBe(0)
  })

  it('2 — enabling live translation activates enforce retry path', async () => {
    enableLiveMode()
    const ta = document.createElement('textarea')
    document.body.append(ta)
    focusAndType(ta, 'مرحبا')
    await flushLiveTranslation()
    await vi.waitFor(() => expect(translateCalls).toBeGreaterThan(0))
  })

  it('3 — disabling live translation cancels pending work', async () => {
    enableLiveMode()
    const ta = document.createElement('textarea')
    document.body.append(ta)
    focusAndType(ta, 'مرحبا')
    applyUserWritingPolicy({
      helpStyle: 'auto',
      fixWrongTyping: false,
      improveEnglish: false,
      arabicToEnglishMode: false,
    })
    stateManager.translation.liveEnabled = false
    translation.setLiveEnabled(false)
    vi.advanceTimersByTime(LIVE_PAUSE_MS + 50)
    expect(translateCalls).toBe(0)
  })

  it('4 — input events reach enforce coordinator through EventBus', async () => {
    enableLiveMode()
    const ta = document.createElement('textarea')
    document.body.append(ta)
    focusAndType(ta, 'مرحبا')
    await flushLiveTranslation()
    await vi.waitFor(() => expect(translateCalls).toBeGreaterThan(0))
  })

  it('5 — TranslationFeature does not register document listeners', () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const module = createTranslationFeature({ engine: new InputEngine() })
    module.start()
    const globalAdds = addSpy.mock.calls.filter(([type]) =>
      OWNED_DOCUMENT_EVENTS.includes(type as (typeof OWNED_DOCUMENT_EVENTS)[number]),
    )
    expect(globalAdds.length).toBe(0)
    addSpy.mockRestore()
  })

  it('6 — enforce coordinator waits for debounce period', async () => {
    enableLiveMode()
    const ta = document.createElement('textarea')
    document.body.append(ta)
    focusAndType(ta, 'مرحبا')
    vi.advanceTimersByTime(LIVE_PAUSE_MS - 1)
    expect(translateCalls).toBe(0)
    vi.advanceTimersByTime(1)
    await flushLiveTranslation()
    await vi.waitFor(() => expect(translateCalls).toBe(1))
  })

  it('7 — repeated typing resets debounce', async () => {
    enableLiveMode()
    const ta = document.createElement('textarea')
    document.body.append(ta)
    focusAndType(ta, 'مر')
    vi.advanceTimersByTime(400)
    focusAndType(ta, 'مرحبا')
    vi.advanceTimersByTime(400)
    expect(translateCalls).toBe(0)
    vi.advanceTimersByTime(350)
    await flushLiveTranslation()
    await vi.waitFor(() => expect(translateCalls).toBe(1))
  })

  it('8 — no translation request for every keystroke', async () => {
    enableLiveMode()
    const ta = document.createElement('textarea')
    document.body.append(ta)
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    for (const ch of 'مرحبا') {
      ta.value += ch
      ta.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
      vi.advanceTimersByTime(100)
    }
    expect(translateCalls).toBe(0)
    vi.advanceTimersByTime(LIVE_PAUSE_MS)
    await flushLiveTranslation()
    await vi.waitFor(() => expect(translateCalls).toBe(1))
  })

  it('9 — current sentence segment selected on punctuation', async () => {
    enableLiveMode()
    const ta = document.createElement('textarea')
    document.body.append(ta)
    focusAndType(ta, 'مرحبا كيف حالك؟')
    vi.advanceTimersByTime(LIVE_PAUSE_MS)
    await flushLiveTranslation()
    await vi.waitFor(() => expect(translateCalls).toBe(1))
    expect(ta.value).toContain('EN:')
  })

  it('10 — empty segment ignored', async () => {
    enableLiveMode()
    const ta = document.createElement('textarea')
    document.body.append(ta)
    focusAndType(ta, '   ')
    vi.advanceTimersByTime(LIVE_PAUSE_MS)
    expect(translateCalls).toBe(0)
  })

  it('11 — unsafe field blocks live translation', async () => {
    enableLiveMode()
    const input = document.createElement('input')
    input.type = 'password'
    document.body.append(input)
    focusAndType(input, 'secret')
    vi.advanceTimersByTime(LIVE_PAUSE_MS)
    expect(translateCalls).toBe(0)
  })

  it('12 — protected token blocks live translation', async () => {
    enableLiveMode()
    const ta = document.createElement('textarea')
    document.body.append(ta)
    focusAndType(ta, 'sk-abcdefghijklmnopqrstuvwxyz123456')
    vi.advanceTimersByTime(LIVE_PAUSE_MS)
    expect(translateCalls).toBe(0)
  })

  it('13 — composition blocks translation', async () => {
    enableLiveMode()
    const ta = document.createElement('textarea')
    document.body.append(ta)
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    ta.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    ta.value = 'مرحبا'
    ta.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertCompositionText' }))
    vi.advanceTimersByTime(LIVE_PAUSE_MS)
    expect(translateCalls).toBe(0)
  })

  it('14 — composition end allows scheduling again', async () => {
    enableLiveMode()
    const ta = document.createElement('textarea')
    document.body.append(ta)
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    ta.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    ta.value = 'مرحبا كيف حالك؟'
    ta.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
    ta.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertCompositionText' }))
    vi.advanceTimersByTime(LIVE_PAUSE_MS)
    await flushLiveTranslation()
    await vi.waitFor(() => expect(translateCalls).toBe(1))
  })

  it('15 — same segment does not duplicate requests', async () => {
    enableLiveMode()
    const ta = document.createElement('textarea')
    document.body.append(ta)
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    focusAndType(ta, 'مرحبا')
    vi.advanceTimersByTime(400)
    ta.setSelectionRange(ta.value.length, ta.value.length)
    ta.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
    await flushLiveTranslation()
    expect(translateCalls).toBe(1)
  })

  it('16 — old response cannot overwrite newer user text', async () => {
    enableLiveMode()
    let resolveSlow: ((value: { ok: true; translation: string }) => void) | null = null
    const slowProvider = vi.fn(
      () =>
        new Promise<{ ok: true; translation: string }>((resolve) => {
          resolveSlow = resolve
        }),
    )
    setPipelineTranslateFnForTests(slowProvider)

    const ta = document.createElement('textarea')
    document.body.append(ta)
    focusAndType(ta, 'مرحبا كيف حالك؟')
    await flushLiveTranslation()
    await vi.waitFor(() => expect(slowProvider).toHaveBeenCalled())

    ta.value = 'مرحبا كيف حالك اليوم؟'
    ta.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
    resolveSlow?.({ ok: true, translation: 'Hello old' })
    await Promise.resolve()
    expect(ta.value).toBe('مرحبا كيف حالك اليوم؟')
  })

  it('17 — translation write uses WriteOrigin.TRANSLATE without re-trigger loop', async () => {
    enableLiveMode()
    const ta = document.createElement('textarea')
    document.body.append(ta)
    focusAndType(ta, 'مرحبا')
    await flushLiveTranslation()
    await vi.waitFor(() => expect(translateCalls).toBe(1))
    const afterWrite = translateCalls
    await flushLiveTranslation()
    expect(translateCalls).toBe(afterWrite)
  })

  it('18 — manual translation works when live mode OFF', async () => {
    stateManager.translation.liveEnabled = false
    const ta = document.createElement('textarea')
    ta.value = 'مرحبا'
    document.body.append(ta)
    ta.focus()
    await orchestrator.dispatch('TRANSLATE')
    expect(translateCalls).toBe(1)
    expect(ta.value).toContain('EN:')
  })

  it('19 — manual translation works when live mode ON', async () => {
    enableLiveMode()
    const ta = document.createElement('textarea')
    ta.value = 'مرحبا'
    document.body.append(ta)
    ta.focus()
    await orchestrator.dispatch('TRANSLATE')
    expect(translateCalls).toBe(1)
  })

  it('20 — live translation does not invoke CORRECT', async () => {
    enableLiveMode()
    const ta = document.createElement('textarea')
    document.body.append(ta)
    focusAndType(ta, 'مرحبا')
    await flushLiveTranslation()
    await vi.waitFor(() => expect(translateCalls).toBe(1))
    expect(correct).not.toHaveBeenCalled()
  })

  it('21 — live translation does not invoke FIX_LAYOUT', async () => {
    enableLiveMode()
    const ta = document.createElement('textarea')
    document.body.append(ta)
    focusAndType(ta, 'مرحبا')
    await flushLiveTranslation()
    await vi.waitFor(() => expect(translateCalls).toBe(1))
    expect(layoutFixCalls).toBe(0)
  })

  it('22 — network failure leaves text untouched', async () => {
    enableLiveMode()
    setPipelineTranslateFnForTests(async () => {
      translateCalls += 1
      return { ok: false, code: 'translation_unavailable' }
    })

    const ta = document.createElement('textarea')
    document.body.append(ta)
    const original = 'مرحبا كيف حالك؟'
    focusAndType(ta, original)
    await flushLiveTranslation()
    await vi.waitFor(() => expect(translateCalls).toBe(1))
    expect(ta.value).toBe(original)
  })

  it('23 — multiple fields remain isolated', async () => {
    enableLiveMode()
    const a = document.createElement('textarea')
    const b = document.createElement('textarea')
    document.body.append(a, b)
    focusAndType(a, 'مرحبا')
    await flushLiveTranslation()
    await vi.waitFor(() => expect(a.value).toContain('EN:'))
    focusAndType(b, 'كيف حالك')
    await flushLiveTranslation()
    await vi.waitFor(() => expect(b.value).toContain('EN:'))
    expect(a.value).not.toBe(b.value)
  })

  it('24 — field switch does not redirect result', async () => {
    enableLiveMode()
    let resolveSlow: ((value: { ok: true; translation: string }) => void) | null = null
    translation.stop()
    translation = createTranslationFeature({
      engine,
      provider: () =>
        new Promise<{ ok: true; translation: string }>((resolve) => {
          resolveSlow = resolve
        }),
    })
    router.registerTranslation(translation)
    translation.start()

    const a = document.createElement('textarea')
    const b = document.createElement('textarea')
    document.body.append(a, b)
    focusAndType(a, 'مرحبا')
    await flushLiveTranslation()
    b.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    resolveSlow?.({ ok: true, translation: 'EN:مرحبا' })
    await Promise.resolve()
    expect(b.value).toBe('')
  })

  it('25 — rapid typing does not produce request storm', async () => {
    enableLiveMode()
    const ta = document.createElement('textarea')
    document.body.append(ta)
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    for (let i = 0; i < 20; i += 1) {
      ta.value = `مرحبا ${'ا'.repeat(i + 1)}`
      ta.setSelectionRange(ta.value.length, ta.value.length)
      ta.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
      vi.advanceTimersByTime(50)
    }
    await flushLiveTranslation()
    await vi.waitFor(() => expect(translateCalls).toBeGreaterThan(0))
    expect(translateCalls).toBeLessThanOrEqual(2)
  })
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe('Phase 6 — Live translate unit', () => {
  beforeEach(() => {
    stateManager.settings.enabled = true
    enableLiveMode()
  })

  it('generation mismatch returns stale', async () => {
    const ta = document.createElement('textarea')
    ta.value = 'مرحبا كيف حالك؟'
    document.body.append(ta)
    const engine = new InputEngine()
    engine.start()
    const session = engine.sessions.getOrCreate(ta)

    const hold = deferred<{ ok: true; translation: string }>()
    const metrics = createTranslationMetrics()
    const pending = runLiveTranslation(ta, session, {
      engine: new TranslationEngine({
        async translate() {
          return hold.promise
        },
      }),
      metrics,
      fieldState: { lastRequestedKey: null, lastTranslatedKey: null },
    })
    session.bumpGeneration()
    hold.resolve({ ok: true, translation: 'Hello' })
    expect(await pending).toBe('stale')
    engine.stop()
  })

  it('mutex busy when manual translation holds lock', async () => {
    const ta = document.createElement('textarea')
    ta.value = 'مرحبا كيف حالك؟'
    document.body.append(ta)
    const inputEngine = new InputEngine()
    inputEngine.start()
    const session = inputEngine.sessions.getOrCreate(ta)
    const acquired = session.tryAcquireWrite('TRANSLATE')
    expect(acquired.ok).toBe(true)
    if (!acquired.ok) return

    const metrics = createTranslationMetrics()
    const result = await runLiveTranslation(ta, session, {
      engine: new TranslationEngine({
        async translate() {
          return { ok: true, translation: 'Hello' }
        },
      }),
      metrics,
      fieldState: { lastRequestedKey: null, lastTranslatedKey: null },
    })
    expect(result).toBe('busy')
    session.releaseWrite('TRANSLATE', acquired.requestId)
    inputEngine.stop()
  })
})

describe('Phase 6 — Adversarial races', () => {
  it('Scenario B — user edits field before response returns stale', async () => {
    const ta = document.createElement('textarea')
    ta.value = 'مرحبا'
    document.body.append(ta)
    const inputEngine = new InputEngine()
    inputEngine.start()
    const session = inputEngine.sessions.getOrCreate(ta)
    const gen = session.getGeneration()
    const acquired = session.tryAcquireWrite('TRANSLATE')
    expect(acquired.ok).toBe(true)
    if (!acquired.ok) return

    session.bumpGeneration()
    const write = writeReplacement(ta, 0, 5, 'Hello', {
      origin: 'TRANSLATE',
      session,
      requestId: acquired.requestId,
      expectedGeneration: gen,
    })
    expect(write.verdict).not.toBe('written')
    session.releaseWrite('TRANSLATE', acquired.requestId)
    inputEngine.stop()
  })
})
