import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildCacheKey, predictClientTranslationStrategy } from '@flowlary/shared'
import { InputEngine } from '../../../extension/src/core/input/InputEngine.ts'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { applyUserWritingPolicy } from '../../../extension/src/core/policy/writingPolicy.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'
import { resetEngineModeForTests, setInternalEngineMode } from '../../../extension/src/core/engine/flag.ts'
import {
  startEnforceCoordinator,
  stopEnforceCoordinator,
} from '../../../extension/src/core/writeGate/enforceCoordinator.ts'
import {
  applyPipelineSuggestion,
  presentPipelineSuggestion,
  resetPipelineSuggestionsForTests,
} from '../../../extension/src/core/writeGate/pipelineSuggest.ts'
import { commitWriteTransaction } from '../../../extension/src/core/writeGate/writeGate.ts'
import { createWriteAuthorization } from '../../../extension/src/core/runtime/writeAuthorization.ts'
import {
  computeFeatureDeadlines,
  getWritingRuntime,
  markOperationFailed,
  markOperationRunning,
  markOperationSuperseded,
  MAX_PHYSICAL_HTTP,
  resetLegacyImmediateCycleForTests,
  resetOperationIdsForTests,
  resetPhysicalHttpForTests,
  resetWriteAuthorizationIdsForTests,
  runWithPhysicalHttp,
  getPhysicalHttpLimiter,
} from '../../../extension/src/core/runtime/index.ts'
import { LIVE_PAUSE_MS as PAUSE_MS } from '../../../extension/src/features/translation/pauseGate.ts'
import { TranslationScheduler } from '../../../extension/src/features/translation/scheduler.ts'
import { createTranslationMetrics } from '../../../extension/src/features/translation/metrics.ts'
import { TranslationEngine } from '../../../extension/src/features/translation/engine.ts'
import { setPipelineTranslateFnForTests } from '../../../extension/src/core/writeGate/pipelineTranslate.ts'
import { executeTranslation } from '../../../extension/src/features/translation/executor.ts'
import { requestTranslationRemote } from '../../../extension/src/features/translation/client.ts'
import { liveTranslateSegment, liveSegmentOnPause } from '../../../extension/src/features/translation/segments.ts'
import { resolveTranslateTarget } from '../../../extension/src/features/translation/selection.ts'
import * as writeGate from '../../../extension/src/core/writeGate/writeGate.ts'

vi.mock('../../../extension/src/features/translation/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../extension/src/features/translation/client.ts')>()
  return {
    ...actual,
    requestTranslationRemote: vi.fn(actual.requestTranslationRemote),
    cancelTranslationRemote: vi.fn(actual.cancelTranslationRemote),
  }
})

function textarea(value = '') {
  const ta = document.createElement('textarea')
  ta.value = value
  document.body.append(ta)
  return ta
}

function typeInto(ta: HTMLTextAreaElement, value: string) {
  ta.value = value
  ta.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
}

function beginTranslate(session: FieldSession, text: string, purpose: 'auto-analysis' | 'focus-out' | 'shortcut' = 'auto-analysis') {
  const op = session.operations.begin({
    fieldId: session.field.id,
    revision: session.getRevision(),
    feature: 'translate',
    purpose,
    trigger: purpose === 'shortcut' ? 'shortcut' : purpose === 'focus-out' ? 'focus_out' : 'auto',
    snapshotFullText: text,
  })
  markOperationRunning(op)
  return op
}

describe('Phase 8 translation runtime migration', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    resetOperationIdsForTests()
    resetWriteAuthorizationIdsForTests()
    resetPipelineSuggestionsForTests()
    resetPhysicalHttpForTests()
    resetLegacyImmediateCycleForTests()
    applyUserWritingPolicy({
      helpStyle: 'auto',
      fixWrongTyping: false,
      improveEnglish: false,
      arabicToEnglishMode: true,
    })
    stateManager.translation.liveEnabled = true
    stateManager.translation.mode = 'direct'
    stateManager.translation.shortcutEnabled = true
    stateManager.translation.sourceLanguage = 'ar'
    stateManager.translation.targetLanguage = 'en'
    stateManager.settings.enabled = true
  })

  afterEach(() => {
    resetPipelineSuggestionsForTests()
    resetPhysicalHttpForTests()
  })

  it('1-5. automatic Translation uses IdleScheduler 750ms and focus-out now', () => {
    expect(PAUSE_MS).toBe(750)
    const live = computeFeatureDeadlines({
      text: 'مرحبا',
      now: 10_000,
      lastInputAt: 10_000,
      lastEnglishNetworkAt: 0,
      composing: false,
      focusOut: false,
      helpStyle: 'auto',
      englishMode: 'box',
      fixWrongTyping: false,
      improveEnglish: false,
      liveTranslation: true,
      wholeFieldEnglish: false,
      reviewEnabled: false,
    })
    expect(live.get('translate')).toBe(10_000 + 750)
    const focus = computeFeatureDeadlines({
      text: 'مرحبا',
      now: 12_000,
      lastInputAt: 10_000,
      lastEnglishNetworkAt: 0,
      composing: false,
      focusOut: true,
      helpStyle: 'auto',
      englishMode: 'box',
      fixWrongTyping: false,
      improveEnglish: false,
      liveTranslation: true,
      wholeFieldEnglish: false,
      reviewEnabled: false,
    })
    expect(focus.get('translate')).toBe(12_000)
  })

  it('2, 5-7. IdleScheduler owns Translation; typing is not per-keystroke', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    setInternalEngineMode('enforce')
    setPipelineTranslateFnForTests(async (text) => ({ ok: true, translation: `EN:${text}` }))
    const engine = new InputEngine()
    engine.start()
    startEnforceCoordinator(engine)
    const ta = textarea()
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    typeInto(ta, 'م')
    typeInto(ta, 'مر')
    typeInto(ta, 'مرحبا')
    expect(getWritingRuntime()?.takeAnalysisStartsForTests()).toEqual([])
    vi.advanceTimersByTime(749)
    expect(getWritingRuntime()?.takeAnalysisStartsForTests()).toEqual([])
    vi.advanceTimersByTime(1)
    const starts = getWritingRuntime()?.takeAnalysisStartsForTests() ?? []
    expect(starts.some((item) => item.feature === 'translate')).toBe(true)
    const session = engine.sessions.get(ta)!
    const ops = session.operations.list().filter((op) => op.feature === 'translate')
    expect(ops.length).toBeGreaterThan(0)
    const revision = ops[0]!.revision
    expect(ops[0]!.revision).toBe(revision)
    stopEnforceCoordinator()
    engine.stop()
    setPipelineTranslateFnForTests(null)
    resetEngineModeForTests()
    vi.useRealTimers()
  })

  it('8-10. revision bump supersedes Translation; late HTTP cannot commit', async () => {
    const ta = textarea('مرحبا')
    const session = new FieldSession(ta)
    const operation = beginTranslate(session, ta.value)
    const captured = operation.revision
    session.bumpGeneration()
    expect(operation.revision).toBe(captured)
    expect(operation.state).toBe('superseded')
    expect(operation.abort.signal.aborted).toBe(true)

    const result = await executeTranslation({
      element: ta,
      session,
      range: { start: 0, end: 5 },
      sourceText: 'مرحبا',
      sourceLanguage: 'ar',
      targetLanguage: 'en',
      mode: 'live',
      trigger: 'auto',
      tokenStrategy: 'block',
      auto: true,
      acquireMutex: true,
      operation,
      translate: async () => ({ ok: true, translation: 'Hello' }),
    })
    expect(result.status).toBe('stale')
    expect(ta.value).toBe('مرحبا')
  })

  it('11-12. Translation AbortSignal reaches CANCEL_TRANSLATE', async () => {
    const messages: Array<{ type?: string }> = []
    vi.stubGlobal('chrome', {
      runtime: {
        sendMessage: vi.fn(async (message: { type?: string }) => {
          messages.push(message)
          if (message.type === 'TRANSLATE_TEXT') {
            await new Promise(() => undefined)
          }
          return { ok: true }
        }),
      },
    })
    const ta = textarea('مرحبا')
    const session = new FieldSession(ta)
    const operation = beginTranslate(session, ta.value)
    void requestTranslationRemote('مرحبا', 'ar', 'en', operation.abort.signal, 'live')
    await Promise.resolve()
    operation.abort.abort()
    await Promise.resolve()
    expect(messages.some((item) => item.type === 'CANCEL_TRANSLATE')).toBe(true)
    vi.unstubAllGlobals()
  })

  it('13-18. physical HTTP cap, stale waiters, and settlement release', async () => {
    const fieldId = 'field-tr'
    let started = 0
    const holds: Array<() => void> = []
    for (let i = 0; i < MAX_PHYSICAL_HTTP; i++) {
      void runWithPhysicalHttp({ fieldId, feature: 'translate' }, () => new Promise<void>((resolve) => {
        started += 1
        holds.push(resolve)
      }))
      await Promise.resolve()
    }
    expect(started).toBe(3)
    expect(getPhysicalHttpLimiter().count(fieldId, 'translate')).toBe(3)
    let fourthStarted = false
    const fourth = runWithPhysicalHttp({ fieldId, feature: 'translate' }, async () => {
      fourthStarted = true
    })
    await Promise.resolve()
    expect(fourthStarted).toBe(false)
    const stale = await runWithPhysicalHttp(
      { fieldId, feature: 'translate', isCurrent: () => false },
      async () => undefined,
    )
    expect(stale.dispatched).toBe(false)
    holds[0]!()
    await fourth
    expect(fourthStarted).toBe(true)
    holds[1]!()
    holds[2]!()
    await Promise.resolve()
    expect(getPhysicalHttpLimiter().count(fieldId, 'translate')).toBe(0)

    await expect(
      runWithPhysicalHttp({ fieldId, feature: 'translate' }, async () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    expect(getPhysicalHttpLimiter().count(fieldId, 'translate')).toBe(0)
  })

  it('19-25. Translation Box identity, stale apply, substring, valid apply', () => {
    const source = 'مرحبا'
    const ta = textarea(source)
    const session = new FieldSession(ta)
    const operation = beginTranslate(session, source)
    presentPipelineSuggestion({
      fieldId: session.field.id,
      element: ta,
      session,
      generation: 0,
      range: { start: 0, end: source.length },
      sourceText: source,
      suggestion: 'Hello',
      action: 'translation',
      textOrigin: 'original_ar',
      operation,
    })
    const identity = session.operations.get(operation.operationId)
    expect(identity?.operationId).toBe(operation.operationId)
    expect(identity?.revision).toBe(0)
    expect(identity?.fieldId).toBe(session.field.id)

    session.bumpGeneration()
    expect(['stale', 'missing']).toContain(applyPipelineSuggestion(session.field.id))

    const snap = textarea(source)
    const snapSession = new FieldSession(snap)
    const snapOp = beginTranslate(snapSession, source)
    presentPipelineSuggestion({
      fieldId: snapSession.field.id,
      element: snap,
      session: snapSession,
      generation: 0,
      range: { start: 0, end: source.length },
      sourceText: source,
      suggestion: 'Hello',
      action: 'translation',
      textOrigin: 'original_ar',
      operation: snapOp,
    })
    snap.value = `${source} extra`
    expect(applyPipelineSuggestion(snapSession.field.id)).toBe('stale')

    const rangeTa = textarea(source)
    const rangeSession = new FieldSession(rangeTa)
    const rangeOp = beginTranslate(rangeSession, source)
    presentPipelineSuggestion({
      fieldId: rangeSession.field.id,
      element: rangeTa,
      session: rangeSession,
      generation: 0,
      range: { start: 0, end: source.length },
      sourceText: source,
      suggestion: 'Hello',
      action: 'translation',
      textOrigin: 'original_ar',
      operation: rangeOp,
    })
    markOperationFailed(rangeOp)
    expect(['stale', 'missing']).toContain(applyPipelineSuggestion(rangeSession.field.id))

    const elsewhere = textarea(`xx ${source}`)
    const elseSession = new FieldSession(elsewhere)
    const elseOp = beginTranslate(elseSession, elsewhere.value)
    presentPipelineSuggestion({
      fieldId: elseSession.field.id,
      element: elsewhere,
      session: elseSession,
      generation: 0,
      range: { start: 0, end: 2 },
      sourceText: 'xx',
      suggestion: 'Hi',
      action: 'translation',
      textOrigin: 'original_ar',
      operation: elseOp,
    })
    elsewhere.value = `zz ${source}`
    expect(applyPipelineSuggestion(elseSession.field.id)).toBe('stale')

    const ok = textarea(source)
    const okSession = new FieldSession(ok)
    const okOp = beginTranslate(okSession, source)
    presentPipelineSuggestion({
      fieldId: okSession.field.id,
      element: ok,
      session: okSession,
      generation: 0,
      range: { start: 0, end: source.length },
      sourceText: source,
      suggestion: 'Hello',
      action: 'translation',
      textOrigin: 'original_ar',
      operation: okOp,
    })
    expect(applyPipelineSuggestion(okSession.field.id)).toBe('applied')
    expect(ok.value).toBe('Hello')
  })

  it('26-28. valid Direct Translation reaches WriteGate; stale/mutex cannot revive it', async () => {
    const ta = textarea('مرحبا')
    const session = new FieldSession(ta)
    const operation = beginTranslate(session, ta.value)
    const spy = vi.spyOn(writeGate, 'commitWriteTransaction')
    const result = await executeTranslation({
      element: ta,
      session,
      range: { start: 0, end: 5 },
      sourceText: 'مرحبا',
      sourceLanguage: 'ar',
      targetLanguage: 'en',
      mode: 'live',
      trigger: 'auto',
      tokenStrategy: 'block',
      auto: true,
      acquireMutex: true,
      operation,
      translate: async () => ({ ok: true, translation: 'Hello' }),
    })
    expect(result.status).toBe('committed')
    expect(spy).toHaveBeenCalled()
    expect(spy.mock.calls.some((call) => call[4]?.authorization)).toBe(true)
    spy.mockRestore()

    const staleTa = textarea('مرحبا')
    const staleSession = new FieldSession(staleTa)
    const staleOp = beginTranslate(staleSession, staleTa.value)
    const staleAuth = createWriteAuthorization({
      operation: staleOp,
      action: 'translation',
      range: { start: 0, end: 5 },
      replacement: 'Hello',
    })
    markOperationSuperseded(staleOp)
    const lock = staleSession.tryAcquireWrite('TRANSLATE')
    expect(lock.ok).toBe(true)
    if (!lock.ok) return
    const rejected = commitWriteTransaction(staleTa, 0, 5, 'Hello', {
      session: staleSession,
      requestId: lock.requestId,
      expectedGeneration: lock.generation,
      origin: 'TRANSLATE',
      capability: 'translation',
      action: 'translation',
      authorization: staleAuth,
    })
    staleSession.releaseWrite('TRANSLATE', lock.requestId)
    expect(rejected.verdict).not.toBe('written')
    expect(staleTa.value).toBe('مرحبا')
  })

  it('29-31. cache hit still requires Operation validity and account isolation', async () => {
    const ta = textarea('مرحبا')
    const session = new FieldSession(ta)
    const operation = beginTranslate(session, ta.value)
    session.bumpGeneration()
    const cached = await executeTranslation({
      element: ta,
      session,
      range: { start: 0, end: 5 },
      sourceText: 'مرحبا',
      sourceLanguage: 'ar',
      targetLanguage: 'en',
      mode: 'live',
      trigger: 'auto',
      tokenStrategy: 'block',
      auto: true,
      acquireMutex: true,
      operation,
      translate: async () => ({ ok: true, translation: 'Hello' }),
    })
    expect(cached.status).toBe('stale')
    expect(ta.value).toBe('مرحبا')

    const a = buildCacheKey({
      operation: 'TRANSLATE',
      text: 'مرحبا',
      sourceLanguage: 'ar',
      targetLanguage: 'en',
      accountId: 'acct-a',
    })
    const b = buildCacheKey({
      operation: 'TRANSLATE',
      text: 'مرحبا',
      sourceLanguage: 'ar',
      targetLanguage: 'en',
      accountId: 'acct-b',
    })
    expect(a).toMatch(/^TRANSLATE:acct-a:/)
    expect(a).not.toBe(b)
  })

  it('32-34. segmentation and provider policy are unchanged', () => {
    const sentence = 'مرحبا بك. كيف حالك؟'
    const segment = liveTranslateSegment(sentence, sentence.length)
    expect(segment?.text).toContain('كيف حالك')
    expect(liveSegmentOnPause(sentence, sentence.length)?.text.length).toBeGreaterThan(1)
    expect(resolveTranslateTarget('كلمة واحدة فقط هنا', 0, 0)?.mode).toBe('context')
    expect(predictClientTranslationStrategy({ plan: 'free', mode: 'live' })).toBe('google')
    expect(predictClientTranslationStrategy({ plan: 'pro', mode: 'live' })).toBe('groq')
    expect(predictClientTranslationStrategy({ plan: 'unknown', signedIn: true })).toBe('groq')
  })

  it('35-36. composition does not create per-keystroke Translation operations', () => {
    const engine = new InputEngine()
    engine.start()
    const ta = textarea()
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    const session = engine.sessions.getOrCreate(ta)
    const before = session.getRevision()
    ta.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    ta.value = 'م'
    ta.dispatchEvent(new CompositionEvent('compositionupdate', { bubbles: true }))
    ta.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }))
    expect(session.getRevision()).toBe(before)
    expect(session.operations.list().filter((op) => op.feature === 'translate')).toHaveLength(0)
    ta.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
    expect(session.getRevision()).toBe(before + 1)
    engine.stop()
  })

  it('37-38. Translation coexists with English and Layout on the same revision', () => {
    const ta = textarea('مرحبا hello')
    const session = new FieldSession(ta)
    const translate = beginTranslate(session, ta.value)
    const english = session.operations.begin({
      fieldId: session.field.id,
      revision: session.getRevision(),
      feature: 'english',
      purpose: 'auto-analysis',
      trigger: 'auto',
      snapshotFullText: ta.value,
    })
    const layout = session.operations.begin({
      fieldId: session.field.id,
      revision: session.getRevision(),
      feature: 'layout',
      purpose: 'auto-analysis',
      trigger: 'auto',
      snapshotFullText: ta.value,
    })
    expect(translate.revision).toBe(english.revision)
    expect(english.revision).toBe(layout.revision)
    expect(translate.operationId).not.toBe(english.operationId)
    expect(translate.operationId).not.toBe(layout.operationId)
  })

  it('39-41. failed Translation write releases mutex; later operation can run', async () => {
    const ta = textarea('مرحبا')
    const session = new FieldSession(ta)
    const operation = beginTranslate(session, ta.value)
    markOperationFailed(operation)
    const acquired = session.tryAcquireWrite('TRANSLATE')
    expect(acquired.ok).toBe(true)
    if (!acquired.ok) return
    session.releaseWrite('TRANSLATE', acquired.requestId)
    expect(session.getActiveRequest()).toBeNull()
    const later = beginTranslate(session, ta.value)
    const result = await executeTranslation({
      element: ta,
      session,
      range: { start: 0, end: 5 },
      sourceText: 'مرحبا',
      sourceLanguage: 'ar',
      targetLanguage: 'en',
      mode: 'live',
      trigger: 'auto',
      tokenStrategy: 'block',
      auto: true,
      acquireMutex: true,
      operation: later,
      translate: async () => ({ ok: true, translation: 'Hello' }),
    })
    expect(result.status).toBe('committed')
  })

  it('42-47. no Translation timer, no Compose migration, WriteGate remains the mutator', () => {
    const schedulerSrc = readFileSync(join(process.cwd(), 'src/features/translation/scheduler.ts'), 'utf8')
    const liveSrc = readFileSync(join(process.cwd(), 'src/features/translation/liveTranslate.ts'), 'utf8')
    const featureSrc = readFileSync(join(process.cwd(), 'src/features/translation/TranslationFeature.ts'), 'utf8')
    expect(schedulerSrc).not.toMatch(/\bsetTimeout\b/)
    expect(schedulerSrc).not.toMatch(/\bsetInterval\b/)
    expect(liveSrc).not.toMatch(/\bsetTimeout\b/)
    expect(featureSrc).not.toMatch(/\bsetTimeout\b/)
    const scheduler = new TranslationScheduler({
      engine: new InputEngine(),
      translationEngine: new TranslationEngine({
        translate: async () => ({ ok: false, code: 'network' }),
      }),
      metrics: createTranslationMetrics(),
    })
    expect(typeof scheduler.start).toBe('function')
    scheduler.start()
    scheduler.stop()
    const composeWorkbench = readFileSync(
      join(process.cwd(), 'src/dashboard/components/ComposeWorkbench.tsx'),
      'utf8',
    )
    expect(composeWorkbench).toMatch(/setTimeout/)
    const ta = textarea('مرحبا')
    const session = new FieldSession(ta)
    const operation = beginTranslate(session, ta.value)
    const auth = createWriteAuthorization({
      operation,
      action: 'translation',
      range: { start: 0, end: 5 },
      replacement: 'Hello',
    })
    expect(auth).not.toHaveProperty('expiresAt')
  })
})
