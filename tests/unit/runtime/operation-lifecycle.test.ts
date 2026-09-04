import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { InputEngine } from '../../../extension/src/core/input/InputEngine.ts'
import { applyUserWritingPolicy } from '../../../extension/src/core/policy/writingPolicy.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'
import { resetEngineModeForTests, setInternalEngineMode } from '../../../extension/src/core/engine/flag.ts'
import {
  startEnforceCoordinator,
  stopEnforceCoordinator,
} from '../../../extension/src/core/writeGate/enforceCoordinator.ts'
import * as pipeline from '../../../extension/src/core/writeGate/pipeline.ts'
import {
  hidePipelineSuggestion,
  presentPipelineSuggestion,
} from '../../../extension/src/core/writeGate/pipelineSuggest.ts'
import {
  fulfillTranslationDecision,
  setPipelineTranslateFnForTests,
} from '../../../extension/src/core/writeGate/pipelineTranslate.ts'
import { executeTranslation } from '../../../extension/src/features/translation/executor.ts'
import {
  getLastTranslationNetworkSignalForTests,
  requestTranslationRemote,
} from '../../../extension/src/features/translation/client.ts'
import {
  cancelTranslateRequest,
  getLastTranslateFetchSignalForTests,
  handleTranslateText,
  resetTranslateHandlerForTests,
} from '../../../extension/src/background/translate.ts'
import { createMockChromeStorage } from '../../helpers/mockChromeStorage.ts'
import { seedFlowlaryAccountAuth } from '../../helpers/mockFlowlaryAuth.ts'
import { resetFlowlaryCacheForTests } from '../../../extension/src/storage/cache/index.ts'
import type { TranslationOutcome } from '../../../extension/src/features/translation/types.ts'
import {
  evaluateOperationValidity,
  getWritingRuntime,
  isOperationCurrent,
  markOperationAborted,
  markOperationCompleted,
  markOperationFailed,
  markOperationRunning,
  registerEnglishIdleAnalyzer,
  resetLegacyImmediateCycleForTests,
  resetOperationIdsForTests,
} from '../../../extension/src/core/runtime/index.ts'

function textarea(value = '') {
  const ta = document.createElement('textarea')
  ta.value = value
  document.body.append(ta)
  return ta
}

function begin(
  session: FieldSession,
  feature: 'english' | 'translate' | 'layout' | 'pipeline' = 'english',
  text = 'hello',
) {
  return session.operations.begin({
    fieldId: session.field.id,
    revision: session.getRevision(),
    feature,
    purpose: 'auto-analysis',
    trigger: 'auto',
    snapshotFullText: text,
  })
}

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

describe('Phase 3 operation lifecycle', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    resetOperationIdsForTests()
    registerEnglishIdleAnalyzer(null)
    resetLegacyImmediateCycleForTests()
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  })

  afterEach(() => {
    registerEnglishIdleAnalyzer(null)
    setPipelineTranslateFnForTests(null)
  })

  it('1. captures the FieldRevision at creation', () => {
    const session = new FieldSession(textarea('hello'))
    session.bumpGeneration()
    session.bumpGeneration()
    const op = begin(session)
    expect(op.revision).toBe(2)
    expect(op.revision).toBe(session.getRevision())
    expect(op.fieldId).toBe(session.field.id)
    expect(op.abort.signal.aborted).toBe(false)
    expect(op.state).toBe('pending')
  })

  it('2. refuses mutation of Operation.revision', () => {
    const op = begin(new FieldSession(textarea('hello')))
    const captured = op.revision
    expect(() => {
      ;(op as { revision: number }).revision = 99
    }).toThrow()
    expect(op.revision).toBe(captured)
  })

  it('3–5. revision bump supersedes, aborts, and keeps the operation stale forever', () => {
    const session = new FieldSession(textarea('hello'))
    const op = begin(session)
    markOperationRunning(op)
    session.bumpGeneration()
    expect(op.state).toBe('superseded')
    expect(op.abort.signal.aborted).toBe(true)
    expect(isOperationCurrent(op, session.getRevision())).toBe(false)
    expect(evaluateOperationValidity(op, session.getRevision())).toEqual({
      ok: false,
      reason: 'superseded',
    })
    markOperationCompleted(op)
    markOperationRunning(op)
    expect(op.state).toBe('superseded')
    expect(op.revision).not.toBe(session.getRevision())
    expect(isOperationCurrent(op, session.getRevision())).toBe(false)
  })

  it('6. a current operation can complete normally', () => {
    const session = new FieldSession(textarea('hello'))
    const op = begin(session)
    markOperationRunning(op)
    markOperationCompleted(op)
    expect(op.state).toBe('completed')
    expect(evaluateOperationValidity(op, session.getRevision())).toEqual({ ok: true })
  })

  it('7. a stale operation cannot complete as current', () => {
    const session = new FieldSession(textarea('hello'))
    const op = begin(session)
    markOperationRunning(op)
    session.bumpGeneration()
    markOperationCompleted(op)
    expect(op.state).toBe('superseded')
    expect(isOperationCurrent(op, session.getRevision())).toBe(false)
  })

  it('8. late HTTP 200 from an old revision cannot commit', async () => {
    const ta = textarea('مرحبا')
    const session = new FieldSession(ta)
    const op = begin(session, 'translate', ta.value)
    markOperationRunning(op)
    let finish: ((value: TranslationOutcome) => void) | undefined
    const pending = executeTranslation({
      element: ta,
      session,
      range: { start: 0, end: ta.value.length },
      sourceText: ta.value,
      sourceLanguage: 'ar',
      targetLanguage: 'en',
      mode: 'live',
      trigger: 'auto',
      tokenStrategy: 'block',
      acquireMutex: true,
      auto: true,
      recordHistoryEntry: false,
      operation: op,
      translate: () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    })
    await vi.waitFor(() => {
      expect(session.getActiveRequest()).not.toBeNull()
    })
    session.bumpGeneration()
    finish?.({ ok: true, translation: 'Hello' })
    const result = await pending
    expect(['stale', 'aborted']).toContain(result.status)
    expect(ta.value).toBe('مرحبا')
    expect(op.state).toBe('superseded')
  })

  it('9. a stale operation cannot display a Box result', () => {
    const ta = textarea('مرحبا')
    const session = new FieldSession(ta)
    const op = begin(session, 'translate', 'مرحبا')
    session.bumpGeneration()
    presentPipelineSuggestion({
      fieldId: session.field.id,
      element: ta,
      session,
      generation: op.revision,
      range: { start: 0, end: ta.value.length },
      sourceText: 'مرحبا',
      suggestion: 'Hello',
      action: 'translation',
      textOrigin: 'original_ar',
      operation: op,
    })
    expect(document.querySelector('[data-flowlary-suggestion-host]')).toBeNull()
    hidePipelineSuggestion(session.field.id)
  })

  it('10. abort requested is distinguishable from superseded/stale', () => {
    const session = new FieldSession(textarea('hello'))
    const aborted = begin(session)
    markOperationRunning(aborted)
    markOperationAborted(aborted)
    expect(aborted.state).toBe('aborted')
    expect(aborted.abort.signal.aborted).toBe(true)
    expect(evaluateOperationValidity(aborted, session.getRevision())).toEqual({
      ok: false,
      reason: 'aborted',
    })

    const superseded = session.operations.begin({
      fieldId: session.field.id,
      revision: session.getRevision(),
      feature: 'layout',
      purpose: 'auto-analysis',
      trigger: 'auto',
      snapshotFullText: 'hello',
    })
    expect(aborted.state).toBe('aborted')
    session.bumpGeneration()
    expect(superseded.state).toBe('superseded')
    expect(superseded.abort.signal.aborted).toBe(true)
    expect(evaluateOperationValidity(superseded, session.getRevision()).reason).toBe('superseded')
    expect(aborted.state).not.toBe('completed')
    expect(aborted.state).not.toBe('failed')
  })

  it('11. failed and completed states are distinguishable', () => {
    const session = new FieldSession(textarea('hello'))
    const done = begin(session)
    markOperationRunning(done)
    markOperationCompleted(done)
    const failed = session.operations.begin({
      fieldId: session.field.id,
      revision: session.getRevision(),
      feature: 'translate',
      purpose: 'auto-analysis',
      trigger: 'auto',
      snapshotFullText: 'hello',
    })
    markOperationRunning(failed)
    markOperationFailed(failed)
    expect(done.state).toBe('completed')
    expect(failed.state).toBe('failed')
    expect(evaluateOperationValidity(done, session.getRevision())).toEqual({ ok: true })
    expect(evaluateOperationValidity(failed, session.getRevision())).toEqual({
      ok: false,
      reason: 'failed',
    })
  })

  it('12. different features can coexist on the same revision', () => {
    const session = new FieldSession(textarea('مرحبا hello'))
    const english = begin(session, 'english', 'مرحبا hello')
    const translate = begin(session, 'translate', 'مرحبا hello')
    expect(english.operationId).not.toBe(translate.operationId)
    expect(english.revision).toBe(translate.revision)
    expect(isOperationCurrent(english, session.getRevision())).toBe(true)
    expect(isOperationCurrent(translate, session.getRevision())).toBe(true)
  })

  it('13. duplicate same revision/feature/purpose operations still coalesce', () => {
    const session = new FieldSession(textarea('hello'))
    const first = begin(session)
    const second = begin(session)
    expect(second.operationId).toBe(first.operationId)
    expect(session.operations.list()).toHaveLength(1)
  })

  it('14–15. Operation AbortSignal reaches executeTranslation and requestTranslationRemote', async () => {
    const ta = textarea('مرحبا')
    const session = new FieldSession(ta)
    const op = begin(session, 'translate', ta.value)
    markOperationRunning(op)
    let seen: AbortSignal | undefined
    await executeTranslation({
      element: ta,
      session,
      range: { start: 0, end: ta.value.length },
      sourceText: ta.value,
      sourceLanguage: 'ar',
      targetLanguage: 'en',
      mode: 'live',
      trigger: 'auto',
      tokenStrategy: 'block',
      acquireMutex: true,
      auto: true,
      recordHistoryEntry: false,
      operation: op,
      translate: async (_text, _src, _tgt, signal) => {
        seen = signal
        return { ok: true, translation: 'Hello' }
      },
    })
    expect(seen).toBeTruthy()
    expect(seen!.aborted).toBe(false)
    op.abort.abort()
    expect(seen!.aborted).toBe(true)

    const chromeSignal = new AbortController()
    vi.stubGlobal('chrome', {
      runtime: {
        sendMessage: vi.fn(async () => ({
          type: 'TRANSLATE_TEXT_RESULT',
          ok: true,
          translation: 'Hi',
          sourceLanguage: 'ar',
          targetLanguage: 'en',
        })),
      },
    })
    await requestTranslationRemote('مرحبا', 'ar', 'en', chromeSignal.signal, 'live')
    expect(getLastTranslationNetworkSignalForTests()).toBe(chromeSignal.signal)
    vi.unstubAllGlobals()
  })

  it('15b. Box translation also receives the Operation AbortSignal', async () => {
    applyUserWritingPolicy({ arabicToEnglishMode: true })
    stateManager.translation.mode = 'box'
    const ta = textarea('مرحبا')
    const session = new FieldSession(ta)
    session.ensureTranslationSession()
    const op = begin(session, 'translate', ta.value)
    markOperationRunning(op)
    let seen: AbortSignal | undefined
    setPipelineTranslateFnForTests(async (_text, _src, _tgt, signal) => {
      seen = signal
      return { ok: true, translation: 'Hello' }
    })
    await fulfillTranslationDecision(ta, session, { start: 0, end: ta.value.length }, session.getGeneration(), op)
    expect(seen).toBe(op.abort.signal)
    hidePipelineSuggestion(session.field.id)
    stateManager.translation.mode = 'direct'
  })

  it('16. revision bump aborts the matching older operations only', () => {
    const session = new FieldSession(textarea('hello'))
    const oldEnglish = begin(session, 'english')
    const oldLayout = begin(session, 'layout')
    session.bumpGeneration()
    const current = begin(session, 'english')
    expect(oldEnglish.state).toBe('superseded')
    expect(oldLayout.state).toBe('superseded')
    expect(oldEnglish.abort.signal.aborted).toBe(true)
    expect(current.state).toBe('pending')
    expect(current.abort.signal.aborted).toBe(false)
    expect(isOperationCurrent(current, session.getRevision())).toBe(true)
  })

  it('17. cancellation cannot leave the runtime permanently busy', async () => {
    const ta = textarea('مرحبا')
    const session = new FieldSession(ta)
    const op = begin(session, 'translate', ta.value)
    markOperationRunning(op)
    let finish: ((value: TranslationOutcome) => void) | undefined
    const pending = executeTranslation({
      element: ta,
      session,
      range: { start: 0, end: ta.value.length },
      sourceText: ta.value,
      sourceLanguage: 'ar',
      targetLanguage: 'en',
      mode: 'live',
      trigger: 'auto',
      tokenStrategy: 'block',
      acquireMutex: true,
      auto: true,
      recordHistoryEntry: false,
      operation: op,
      translate: () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    })
    await vi.waitFor(() => {
      expect(session.getActiveRequest()).not.toBeNull()
    })
    expect(session.getActiveRequest()).not.toBeNull()
    session.bumpGeneration()
    expect(session.getActiveRequest()).toBeNull()
    const lock = session.tryAcquireWrite('TRANSLATE')
    expect(lock.ok).toBe(true)
    if (lock.ok) session.releaseWrite('TRANSLATE', lock.requestId)
    expect(isOperationCurrent(op, session.getRevision())).toBe(false)
    finish?.({ ok: true, translation: 'Hello' })
    await pending
    expect(session.getActiveRequest()).toBeNull()
    expect(ta.value).toBe('مرحبا')
  })
})

describe('Phase 3 scheduler-created operations', () => {
  let engine: InputEngine
  let cycleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    document.body.innerHTML = ''
    resetLegacyImmediateCycleForTests()
    resetOperationIdsForTests()
    registerEnglishIdleAnalyzer(null)
    stateManager.settings.enabled = true
    stateManager.settings.excludedDomains = []
    applyUserWritingPolicy({
      helpStyle: 'suggestions',
      fixWrongTyping: true,
      improveEnglish: true,
      arabicToEnglishMode: true,
    })
    stateManager.correction.mode = 'box'
    setInternalEngineMode('enforce')
    engine = new InputEngine()
    cycleSpy = vi.spyOn(pipeline, 'runFieldCycle').mockResolvedValue('noop')
    engine.start()
    startEnforceCoordinator(engine)
  })

  afterEach(() => {
    stopEnforceCoordinator()
    engine.stop()
    cycleSpy.mockRestore()
    resetEngineModeForTests()
    resetLegacyImmediateCycleForTests()
    registerEnglishIdleAnalyzer(null)
    vi.useRealTimers()
  })

  it('18. scheduler-created operations use the current FieldRevision', async () => {
    const ta = textarea()
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    ta.value = 'hello'
    ta.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
    const session = engine.getActiveSession()!
    const revision = session.getRevision()
    expect(revision).toBeGreaterThan(0)
    await vi.advanceTimersByTimeAsync(120)
    expect(cycleSpy).toHaveBeenCalled()
    const options = cycleSpy.mock.calls[0]?.[2]
    const ops = options?.operations ?? {}
    for (const operation of Object.values(ops)) {
      if (!operation) continue
      expect(operation.revision).toBe(revision)
      expect(operation.revision).toBe(session.getRevision())
    }
    expect(getWritingRuntime()?.takeAnalysisStartsForTests().every((item) => item.revision === revision)).toBe(true)
  })

  it('19. continuous typing does not create another scheduling mechanism', () => {
    const ta = textarea()
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    for (const chunk of ['h', 'he', 'hel', 'hell', 'hello']) {
      ta.value = chunk
      ta.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
    }
    expect(cycleSpy).not.toHaveBeenCalled()
    expect(getWritingRuntime()?.getScheduler().pendingTimerCount()).toBe(1)
  })
})

describe('Phase 3 translation fetch AbortSignal', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    const mock = createMockChromeStorage()
    seedFlowlaryAccountAuth(mock)
    mock.install()
    resetFlowlaryCacheForTests()
    resetTranslateHandlerForTests()
    stateManager.correction.consentAccepted = true
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.unstubAllGlobals()
    resetFlowlaryCacheForTests()
    resetTranslateHandlerForTests()
  })

  it('14b. cancel aborts the inflight translation fetch signal', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        })
      }),
    )
    const pending = handleTranslateText({
      type: 'TRANSLATE_TEXT',
      text: 'مرحبا كيف حالك',
      sourceLanguage: 'ar',
      targetLanguage: 'en',
      mode: 'live',
      requestId: 'tr-phase3',
    })
    await vi.waitFor(() => {
      expect(fetch).toHaveBeenCalled()
    })
    const signal = getLastTranslateFetchSignalForTests()
    expect(signal).toBeTruthy()
    const init = (fetch as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[1] as RequestInit
    expect(init.signal).toBe(signal)
    cancelTranslateRequest('tr-phase3')
    const result = await pending
    expect(result).toEqual({ type: 'TRANSLATE_TEXT_ERROR', ok: false, code: 'aborted' })
    expect(signal!.aborted).toBe(true)
  })
})
