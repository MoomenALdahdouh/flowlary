import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CORRECTION_DEFAULTS } from '@flowlary/shared'
import { InputEngine } from '../../../extension/src/core/input/InputEngine.ts'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { applyUserWritingPolicy } from '../../../extension/src/core/policy/writingPolicy.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'
import { resetEngineModeForTests, setInternalEngineMode } from '../../../extension/src/core/engine/flag.ts'
import {
  startEnforceCoordinator,
  stopEnforceCoordinator,
} from '../../../extension/src/core/writeGate/enforceCoordinator.ts'
import * as pipeline from '../../../extension/src/core/writeGate/pipeline.ts'
import { fulfillWritingDecision } from '../../../extension/src/core/writeGate/pipeline.ts'
import {
  applyPipelineSuggestion,
  presentPipelineSuggestion,
  resetPipelineSuggestionsForTests,
} from '../../../extension/src/core/writeGate/pipelineSuggest.ts'
import { commitWriteTransaction } from '../../../extension/src/core/writeGate/writeGate.ts'
import { createWriteAuthorization } from '../../../extension/src/core/runtime/writeAuthorization.ts'
import {
  computeFeatureDeadlines,
  englishDelayMs,
  getWritingRuntime,
  markOperationFailed,
  markOperationRunning,
  markOperationSuperseded,
  MAX_PHYSICAL_HTTP,
  getPhysicalHttpLimiter,
  resetLegacyImmediateCycleForTests,
  resetOperationIdsForTests,
  resetPhysicalHttpForTests,
  resetWriteAuthorizationIdsForTests,
} from '../../../extension/src/core/runtime/index.ts'
import { createLayoutFeature } from '../../../extension/src/features/layout/LayoutFeature.ts'
import { LayoutClassifier } from '../../../extension/src/features/layout/classifier/LayoutClassifier.ts'
import { createLayoutCache } from '../../../extension/src/features/layout/cache/LayoutCache.ts'
import { createLayoutMetrics } from '../../../extension/src/features/layout/metrics.ts'
import { createMemoryCacheCoordinator } from '@flowlary/shared'
import { analyzeFieldText } from '../../../extension/src/core/engine/chunks.ts'
import { collectHypotheses } from '../../../extension/src/core/engine/hypotheses.ts'
import { candidatesFromHypotheses } from '../../../extension/src/core/engine/candidates.ts'
import { decideWriting } from '../../../extension/src/core/engine/decide.ts'
import { buildFieldContext } from '../../../extension/src/core/engine/context.ts'
import * as writeGate from '../../../extension/src/core/writeGate/writeGate.ts'

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

function beginLayout(session: FieldSession, text: string) {
  const op = session.operations.begin({
    fieldId: session.field.id,
    revision: session.getRevision(),
    feature: 'layout',
    purpose: 'auto-analysis',
    trigger: 'auto',
    snapshotFullText: text,
  })
  markOperationRunning(op)
  return op
}

describe('Phase 6 layout runtime migration', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    resetOperationIdsForTests()
    resetWriteAuthorizationIdsForTests()
    resetPipelineSuggestionsForTests()
    resetPhysicalHttpForTests()
    resetLegacyImmediateCycleForTests()
    applyUserWritingPolicy({
      helpStyle: 'auto',
      fixWrongTyping: true,
      improveEnglish: false,
      arabicToEnglishMode: false,
    })
    stateManager.layout.autoEnabled = true
    stateManager.layout.mode = 'direct'
    stateManager.layout.directShortcutEnabled = true
    stateManager.layout.sourceLayout = 'en-US-qwerty'
    stateManager.layout.targetLayouts = ['ar-101']
    stateManager.settings.enabled = true
  })

  afterEach(() => {
    resetPipelineSuggestionsForTests()
    resetPhysicalHttpForTests()
  })

  it('1-2. automatic Layout uses IdleScheduler English delay and has no Layout timer', () => {
    const delay = englishDelayMs('word ', 'direct')
    expect(delay).toBe(CORRECTION_DEFAULTS.LIVE_DIRECT_WORD_BOUNDARY_DEBOUNCE_MS)
    const due = computeFeatureDeadlines({
      text: 'word ',
      now: 10_000,
      lastInputAt: 10_000,
      lastEnglishNetworkAt: 0,
      composing: false,
      focusOut: false,
      helpStyle: 'auto',
      englishMode: 'direct',
      fixWrongTyping: true,
      improveEnglish: false,
      liveTranslation: false,
      wholeFieldEnglish: false,
      reviewEnabled: false,
    })
    expect(due.get('layout')).toBe(10_000 + delay)
    expect(due.get('layout')).not.toBe(10_000 + 400)
    const schedulerSrc = readFileSync(
      join(process.cwd(), 'src/features/layout/scheduler.ts'),
      'utf8',
    )
    expect(schedulerSrc).not.toMatch(/\bsetTimeout\b/)
    expect(schedulerSrc).not.toMatch(/\bsetInterval\b/)
    expect(schedulerSrc).not.toMatch(/400/)
  })

  it('3-5. Layout analysis is an IdleScheduler Operation, not per-keystroke', async () => {
    vi.useFakeTimers()
    setInternalEngineMode('enforce')
    const engine = new InputEngine()
    const cycleSpy = vi.spyOn(pipeline, 'runFieldCycle').mockResolvedValue('noop')
    engine.start()
    startEnforceCoordinator(engine)
    const ta = textarea()
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    typeInto(ta, 'h')
    typeInto(ta, 'he')
    typeInto(ta, 'hel')
    expect(cycleSpy).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(englishDelayMs('hel', 'direct'))
    expect(cycleSpy).toHaveBeenCalled()
    const due = cycleSpy.mock.calls[0]?.[2]?.dueFeatures
    expect(due?.has('layout')).toBe(true)
    const ops = cycleSpy.mock.calls[0]?.[2]?.operations
    expect(ops?.layout?.feature).toBe('layout')
    expect(ops?.layout?.revision).toBe(engine.getActiveSession()!.getRevision())
    expect(Object.getOwnPropertyDescriptor(ops!.layout!, 'revision')?.writable).toBe(false)
    const starts = getWritingRuntime()?.takeAnalysisStartsForTests() ?? []
    expect(starts.some((item) => item.feature === 'layout')).toBe(true)
    stopEnforceCoordinator()
    engine.stop()
    cycleSpy.mockRestore()
    resetEngineModeForTests()
    vi.useRealTimers()
  })

  it('6-7. valid Direct Layout uses the current Operation and WriteGate', () => {
    const ta = textarea('lvpfh ')
    const session = new FieldSession(ta)
    const text = ta.value
    const operation = beginLayout(session, text)
    const context = buildFieldContext({
      element: ta,
      session,
      cycleId: 'layout-direct',
      composing: false,
      textLength: text.length,
    })
    const analysis = analyzeFieldText(text)
    const hypotheses = collectHypotheses(text, text.length, context, analysis)
    const candidates = candidatesFromHypotheses(hypotheses, context)
    const decision = decideWriting(context, analysis, candidates, {
      observeOnly: false,
      hypotheses,
    })
    const spy = vi.spyOn(writeGate, 'commitWriteTransaction')
    const outcome = fulfillWritingDecision({
      element: ta,
      session,
      generation: session.getGeneration(),
      text,
      analysis,
      candidates,
      decision,
      commitOpenToken: true,
      operation,
    })
    expect(outcome === 'applied' || outcome === 'suggestion' || outcome === 'noop').toBe(true)
    if (outcome === 'applied') {
      expect(spy).toHaveBeenCalled()
      expect(spy.mock.calls[0]?.[4]?.authorization?.operationId).toBe(operation.operationId)
      expect(spy.mock.calls[0]?.[4]?.authorization?.revision).toBe(operation.revision)
    }
    spy.mockRestore()
  })

  it('8-10. stale / superseded Layout Operation cannot write', () => {
    const ta = textarea('lvpfh')
    const session = new FieldSession(ta)
    const operation = beginLayout(session, 'lvpfh')
    const auth = createWriteAuthorization({
      operation,
      action: 'layout_fix',
      range: { start: 0, end: 5 },
      replacement: 'مرحبا',
    })
    session.bumpGeneration()
    const acquired = session.tryAcquireWrite('FIX_LAYOUT')
    expect(acquired.ok).toBe(true)
    if (!acquired.ok) return
    const stale = commitWriteTransaction(ta, 0, 5, 'مرحبا', {
      session,
      requestId: acquired.requestId,
      expectedGeneration: acquired.generation,
      origin: 'FIX_LAYOUT',
      capability: 'layout',
      action: 'layout_fix',
      authorization: auth,
    })
    session.releaseWrite('FIX_LAYOUT', acquired.requestId)
    expect(stale.verdict).not.toBe('written')
    expect(ta.value).toBe('lvpfh')

    const live = textarea('lvpfh')
    const liveSession = new FieldSession(live)
    const late = beginLayout(liveSession, 'lvpfh')
    const lateAuth = createWriteAuthorization({
      operation: late,
      action: 'layout_fix',
      range: { start: 0, end: 5 },
      replacement: 'مرحبا',
    })
    markOperationSuperseded(late)
    const lock = liveSession.tryAcquireWrite('FIX_LAYOUT')
    expect(lock.ok).toBe(true)
    if (!lock.ok) return
    const rejected = commitWriteTransaction(live, 0, 5, 'مرحبا', {
      session: liveSession,
      requestId: lock.requestId,
      expectedGeneration: lock.generation,
      origin: 'FIX_LAYOUT',
      capability: 'layout',
      action: 'layout_fix',
      authorization: lateAuth,
    })
    liveSession.releaseWrite('FIX_LAYOUT', lock.requestId)
    expect(rejected.reason).toBe('superseded')
    expect(live.value).toBe('lvpfh')
  })

  it('9. revision change invalidates Layout Operation', () => {
    const ta = textarea('hello')
    const session = new FieldSession(ta)
    const operation = beginLayout(session, 'hello')
    const captured = operation.revision
    session.bumpGeneration()
    expect(operation.revision).toBe(captured)
    expect(operation.state).toBe('superseded')
  })

  it('11-17. Layout Box identity, stale apply, substring, snapshot, range, valid apply', () => {
    const ta = textarea('lvpfh')
    const session = new FieldSession(ta)
    const operation = beginLayout(session, 'lvpfh')
    presentPipelineSuggestion({
      fieldId: session.field.id,
      element: ta,
      session,
      generation: 0,
      range: { start: 0, end: 5 },
      sourceText: 'lvpfh',
      suggestion: 'مرحبا',
      action: 'layout_fix',
      textOrigin: 'layout_mismatch_suspected',
      operation,
    })
    const identity = session.operations.get(operation.operationId)
    expect(identity?.operationId).toBe(operation.operationId)
    expect(identity?.revision).toBe(0)
    expect(identity?.fieldId).toBe(session.field.id)

    const other = textarea('xxxxx lvpfh')
    const otherSession = new FieldSession(other)
    presentPipelineSuggestion({
      fieldId: otherSession.field.id,
      element: other,
      session: otherSession,
      generation: 0,
      range: { start: 0, end: 5 },
      sourceText: 'xxxxx',
      suggestion: 'Hello',
      action: 'layout_fix',
      textOrigin: 'layout_mismatch_suspected',
      operation: beginLayout(otherSession, 'xxxxx lvpfh'),
    })
    other.value = 'yyyyy lvpfh'
    expect(applyPipelineSuggestion(otherSession.field.id)).toBe('stale')
    expect(other.value).toBe('yyyyy lvpfh')

    const snap = textarea('lvpfh')
    const snapSession = new FieldSession(snap)
    const snapOp = beginLayout(snapSession, 'lvpfh')
    presentPipelineSuggestion({
      fieldId: snapSession.field.id,
      element: snap,
      session: snapSession,
      generation: 0,
      range: { start: 0, end: 5 },
      sourceText: 'lvpfh',
      suggestion: 'مرحبا',
      action: 'layout_fix',
      textOrigin: 'layout_mismatch_suspected',
      operation: snapOp,
    })
    snap.value = 'hello'
    expect(applyPipelineSuggestion(snapSession.field.id)).toBe('stale')

    const rangeTa = textarea('lvpfh')
    const rangeSession = new FieldSession(rangeTa)
    const rangeOp = beginLayout(rangeSession, 'lvpfh')
    presentPipelineSuggestion({
      fieldId: rangeSession.field.id,
      element: rangeTa,
      session: rangeSession,
      generation: 0,
      range: { start: 0, end: 5 },
      sourceText: 'lvpfh',
      suggestion: 'مرحبا',
      action: 'layout_fix',
      textOrigin: 'layout_mismatch_suspected',
      operation: rangeOp,
    })
    markOperationFailed(rangeOp)
    expect(['stale', 'missing']).toContain(applyPipelineSuggestion(rangeSession.field.id))

    const lateBox = textarea('lvpfh')
    const lateSession = new FieldSession(lateBox)
    const lateOp = beginLayout(lateSession, 'lvpfh')
    markOperationSuperseded(lateOp)
    presentPipelineSuggestion({
      fieldId: lateSession.field.id,
      element: lateBox,
      session: lateSession,
      generation: 0,
      range: { start: 0, end: 5 },
      sourceText: 'lvpfh',
      suggestion: 'مرحبا',
      action: 'layout_fix',
      textOrigin: 'layout_mismatch_suspected',
      operation: lateOp,
    })
    expect(applyPipelineSuggestion(lateSession.field.id)).toBe('missing')
    expect(lateBox.value).toBe('lvpfh')

    expect(applyPipelineSuggestion(session.field.id)).toBe('applied')
    expect(ta.value).toBe('مرحبا')
  })

  it('18-19. Layout shortcut uses WriteAuthorization and WriteGate', async () => {
    const engine = new InputEngine()
    const layout = createLayoutFeature({ engine })
    layout.start()
    const ta = textarea('lvpfh')
    ta.focus()
    const session = engine.sessions.getOrCreate(ta)
    const acquire = session.tryAcquireWrite('FIX_LAYOUT')
    expect(acquire.ok).toBe(true)
    if (!acquire.ok) return
    const spy = vi.spyOn(writeGate, 'commitWriteTransaction')
    const result = await layout.execute({
      type: 'FIX_LAYOUT',
      field: session.field,
      text: ta.value,
      generation: acquire.generation,
      requestId: acquire.requestId,
    })
    expect(result.ok).toBe(true)
    expect(spy).toHaveBeenCalled()
    expect(spy.mock.calls[0]?.[4]?.authorization).toBeTruthy()
    expect(ta.value).toBe('مرحبا')
    session.releaseWrite('FIX_LAYOUT', acquire.requestId)
    spy.mockRestore()
    layout.stop()
    engine.stop()
  })

  it('20-21. composition does not create per-keystroke Layout operations; end bumps once', () => {
    vi.useFakeTimers()
    setInternalEngineMode('enforce')
    const engine = new InputEngine()
    const cycleSpy = vi.spyOn(pipeline, 'runFieldCycle').mockResolvedValue('noop')
    engine.start()
    startEnforceCoordinator(engine)
    const ta = textarea()
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    const session = engine.getActiveSession()!
    ta.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    ta.dispatchEvent(new CompositionEvent('compositionupdate', { bubbles: true }))
    ta.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertCompositionText' }))
    expect(session.getRevision()).toBe(0)
    expect(cycleSpy).not.toHaveBeenCalled()
    ta.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
    expect(session.getRevision()).toBe(1)
    expect(cycleSpy).not.toHaveBeenCalled()
    stopEnforceCoordinator()
    engine.stop()
    cycleSpy.mockRestore()
    resetEngineModeForTests()
    vi.useRealTimers()
  })

  it('22. Layout coexists with English and Translation Operations on the same revision', () => {
    const ta = textarea('مرحبا hello')
    const session = new FieldSession(ta)
    const layout = session.operations.begin({
      fieldId: session.field.id,
      revision: session.getRevision(),
      feature: 'layout',
      purpose: 'auto-analysis',
      trigger: 'auto',
      snapshotFullText: ta.value,
    })
    const english = session.operations.begin({
      fieldId: session.field.id,
      revision: session.getRevision(),
      feature: 'english',
      purpose: 'auto-analysis',
      trigger: 'auto',
      snapshotFullText: ta.value,
    })
    const translate = session.operations.begin({
      fieldId: session.field.id,
      revision: session.getRevision(),
      feature: 'translate',
      purpose: 'auto-analysis',
      trigger: 'auto',
      snapshotFullText: ta.value,
    })
    expect(layout.revision).toBe(english.revision)
    expect(english.revision).toBe(translate.revision)
    expect(layout.operationId).not.toBe(english.operationId)
    expect(layout.operationId).not.toBe(translate.operationId)
  })

  it('23. Layout classifier network uses the physical HTTP limiter', async () => {
    const metrics = createLayoutMetrics()
    const cache = createLayoutCache(createMemoryCacheCoordinator())
    let started = 0
    const classifier = new LayoutClassifier({
      cache,
      metrics,
      classifyRemote: () => new Promise(() => {
        started += 1
      }),
    })
    const profile = {
      sourceLayout: 'en-US-qwerty' as const,
      enabledLayouts: ['en-US-qwerty'] as const,
    }
    const fieldId = 'field-layout'
    for (let i = 0; i < MAX_PHYSICAL_HTTP; i++) {
      const word = `xqz${i}vqz`
      expect(classifier.localHint(word, profile, '')).toBeNull()
      void classifier.classify(word, profile, '', undefined, { fieldId })
      await Promise.resolve()
      await Promise.resolve()
    }
    expect(started).toBe(MAX_PHYSICAL_HTTP)
    expect(getPhysicalHttpLimiter().count(fieldId, 'layout')).toBe(MAX_PHYSICAL_HTTP)
    const fourth = classifier.classify('xqz9vqz', profile, '', undefined, { fieldId })
    await Promise.resolve()
    await Promise.resolve()
    expect(started).toBe(MAX_PHYSICAL_HTTP)
    expect(getPhysicalHttpLimiter().count(fieldId, 'layout')).toBe(MAX_PHYSICAL_HTTP)
    void fourth
  })

  it('24-25. failed Layout write releases mutex and is not permanently busy', () => {
    const ta = textarea('lvpfh')
    const session = new FieldSession(ta)
    const operation = beginLayout(session, 'lvpfh')
    const auth = createWriteAuthorization({
      operation,
      action: 'layout_fix',
      range: { start: 0, end: 5 },
      replacement: 'مرحبا',
    })
    markOperationFailed(operation)
    const acquired = session.tryAcquireWrite('FIX_LAYOUT')
    expect(acquired.ok).toBe(true)
    if (!acquired.ok) return
    commitWriteTransaction(ta, 0, 5, 'مرحبا', {
      session,
      requestId: acquired.requestId,
      expectedGeneration: acquired.generation,
      origin: 'FIX_LAYOUT',
      capability: 'layout',
      action: 'layout_fix',
      authorization: auth,
    })
    session.releaseWrite('FIX_LAYOUT', acquired.requestId)
    expect(session.getActiveRequest()).toBeNull()
    const again = session.tryAcquireWrite('FIX_LAYOUT')
    expect(again.ok).toBe(true)
    if (again.ok) session.releaseWrite('FIX_LAYOUT', again.requestId)
  })

  it('26-28. WriteGate remains the only host-field mutator; no second clock or Layout timer', () => {
    const schedulerSrc = readFileSync(join(process.cwd(), 'src/features/layout/scheduler.ts'), 'utf8')
    const featureSrc = readFileSync(join(process.cwd(), 'src/features/layout/LayoutFeature.ts'), 'utf8')
    expect(schedulerSrc).not.toMatch(/\bsetTimeout\b/)
    expect(featureSrc).not.toMatch(/\bsetTimeout\b/)
    expect(featureSrc).not.toMatch(/commitWriteTransaction/)
    expect(featureSrc).not.toMatch(/writeReplacement/)
    const ta = textarea('lvpfh')
    const session = new FieldSession(ta)
    const operation = beginLayout(session, 'lvpfh')
    const auth = createWriteAuthorization({
      operation,
      action: 'layout_fix',
      range: { start: 0, end: 5 },
      replacement: 'مرحبا',
    })
    expect(auth.revision).toBe(session.getRevision())
    expect(auth).not.toHaveProperty('expiresAt')
  })
})
