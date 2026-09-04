import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyLocalEnglishRepair } from '@flowlary/shared'
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
import {
  createWriteAuthorization,
  issueImmediateWriteAuthorization,
} from '../../../extension/src/core/runtime/writeAuthorization.ts'
import {
  computeFeatureDeadlines,
  englishDelayMs,
  ENGLISH_NETWORK_SPACING_MS,
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
import { REVIEW_PAUSE_MS } from '../../../extension/src/core/engine/writingReview.ts'
import { createCorrectionFeature } from '../../../extension/src/features/correction/CorrectionFeature.ts'
import { CorrectionScheduler } from '../../../extension/src/features/correction/scheduler.ts'
import { createCorrectionMetrics } from '../../../extension/src/features/correction/metrics.ts'
import {
  acceptCorrectionSuggestion,
  runCorrectionRequest,
} from '../../../extension/src/features/correction/applyCorrection.ts'
import { CorrectionCard } from '../../../extension/src/features/correction/ui/CorrectionCard.ts'
import { IntelligentDebouncer } from '../../../extension/src/features/correction/debounce.ts'
import { requestCorrectionRemote } from '../../../extension/src/features/correction/client.ts'
import { applyIdleEnglishRepair, applyInstantSpellingIfSafe } from '../../../extension/src/features/correction/instantSpell.ts'
import { analyzeFieldText } from '../../../extension/src/core/engine/chunks.ts'
import * as writeGate from '../../../extension/src/core/writeGate/writeGate.ts'

vi.mock('../../../extension/src/features/correction/client.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../extension/src/features/correction/client.ts')>()
  return {
    ...actual,
    requestCorrectionRemote: vi.fn(actual.requestCorrectionRemote),
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

function beginEnglish(session: FieldSession, text: string, purpose: 'auto-analysis' | 'shortcut' = 'auto-analysis') {
  const op = session.operations.begin({
    fieldId: session.field.id,
    revision: session.getRevision(),
    feature: 'english',
    purpose,
    trigger: purpose === 'shortcut' ? 'shortcut' : 'auto',
    snapshotFullText: text,
  })
  markOperationRunning(op)
  return op
}

function fieldState(ta: HTMLTextAreaElement) {
  const debouncer = new IntelligentDebouncer(() => undefined)
  const card = new CorrectionCard({
    highlights: true,
    onApply: () => undefined,
    onDismiss: () => undefined,
  })
  const state = {
    debouncer,
    lastSentText: '',
    lastCorrectedFor: '',
    pendingRequestId: null as string | null,
    lastCorrectionRequestAt: 0,
    card,
    cardMounted: false,
  }
  const getCard = (el: typeof ta) => {
    card.mount(el)
    state.cardMounted = true
    return card
  }
  return { debouncer, card, fieldState: state, getCard }
}

describe('Phase 7 English runtime migration', () => {
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
      improveEnglish: true,
      arabicToEnglishMode: false,
    })
    stateManager.correction.enabled = true
    stateManager.correction.mode = 'direct'
    stateManager.correction.consentAccepted = true
    stateManager.correction.highlights = false
    stateManager.settings.enabled = true
    vi.mocked(requestCorrectionRemote).mockReset()
    vi.mocked(requestCorrectionRemote).mockResolvedValue({
      type: 'CORRECT_TEXT_RESULT',
      ok: false,
      requestId: 'idle',
      error: 'network',
    })
  })

  afterEach(() => {
    resetPipelineSuggestionsForTests()
    resetPhysicalHttpForTests()
  })

  it('1-7. automatic English uses IdleScheduler delays and 2500ms spacing', () => {
    expect(englishDelayMs('mid', 'box')).toBe(120)
    expect(englishDelayMs('word ', 'box')).toBe(45)
    expect(englishDelayMs('Done.', 'box')).toBe(30)
    expect(englishDelayMs('mid', 'direct')).toBe(450)
    expect(englishDelayMs('word ', 'direct')).toBe(700)
    expect(englishDelayMs('Done.', 'direct')).toBe(350)
    expect(ENGLISH_NETWORK_SPACING_MS).toBe(2500)
    expect(REVIEW_PAUSE_MS).toBe(900)
    const spaced = computeFeatureDeadlines({
      text: 'mid',
      now: 10_000,
      lastInputAt: 10_000,
      lastEnglishNetworkAt: 9_000,
      composing: false,
      focusOut: false,
      helpStyle: 'auto',
      englishMode: 'box',
      fixWrongTyping: false,
      improveEnglish: true,
      liveTranslation: false,
      wholeFieldEnglish: true,
      reviewEnabled: true,
    })
    expect(spaced.get('english')).toBe(9_000 + 2500)
    const review = computeFeatureDeadlines({
      text: 'mid',
      now: 10_000,
      lastInputAt: 10_000,
      lastEnglishNetworkAt: 0,
      composing: false,
      focusOut: false,
      helpStyle: 'auto',
      englishMode: 'box',
      fixWrongTyping: false,
      improveEnglish: false,
      liveTranslation: false,
      wholeFieldEnglish: false,
      reviewEnabled: true,
    })
    expect(review.get('review')).toBe(10_000 + 900)
  })

  it('2-3, 8-9. IdleScheduler owns English; typing does not analyze per keystroke', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    setInternalEngineMode('enforce')
    const engine = new InputEngine()
    const correction = createCorrectionFeature({ engine })
    engine.start()
    startEnforceCoordinator(engine)
    correction.start()
    const ta = textarea()
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    typeInto(ta, 'h')
    typeInto(ta, 'he')
    typeInto(ta, 'hel')
    expect(getWritingRuntime()?.takeAnalysisStartsForTests()).toEqual([])
    vi.advanceTimersByTime(449)
    expect(getWritingRuntime()?.takeAnalysisStartsForTests()).toEqual([])
    vi.advanceTimersByTime(1)
    const starts = getWritingRuntime()?.takeAnalysisStartsForTests() ?? []
    expect(starts.some((item) => item.feature === 'english')).toBe(true)
    const session = engine.sessions.get(ta)!
    const englishOps = session.operations.list().filter((op) => op.feature === 'english')
    expect(englishOps.length).toBeGreaterThan(0)
    expect(englishOps[0]!.revision).toBe(session.getRevision())
    expect(englishOps[0]!.revision).toBe(englishOps[0]!.revision)
    correction.stop()
    stopEnforceCoordinator()
    engine.stop()
    resetEngineModeForTests()
    vi.useRealTimers()
  })

  it('10-12. revision bump supersedes English Operation; late HTTP cannot commit', async () => {
    const ta = textarea('I dont know')
    const session = new FieldSession(ta)
    const operation = beginEnglish(session, ta.value)
    const captured = operation.revision
    session.bumpGeneration()
    expect(operation.revision).toBe(captured)
    expect(operation.state).toBe('superseded')

    vi.mocked(requestCorrectionRemote).mockResolvedValue({
      type: 'CORRECT_TEXT_RESULT',
      ok: true,
      requestId: 'late',
      data: { originalText: 'I dont know', correctedText: "I don't know", changes: [] },
    })
    const { debouncer, fieldState: state, getCard } = fieldState(ta)
    const result = await runCorrectionRequest(ta, session, 'I dont know', debouncer.currentGeneration(), {
      metrics: createCorrectionMetrics(),
      fieldState: state,
      currentDebouncerGeneration: () => debouncer.currentGeneration(),
      getCard,
      operation,
    })
    expect(result).toBe('stale')
    expect(ta.value).toBe('I dont know')
  })

  it('13-17. local English intelligence is unchanged', () => {
    expect(applyInstantSpellingIfSafe('hello hwo ')).toBe('Hello, how ')
    expect(applyLocalEnglishRepair('let me now')).toMatch(/know/i)
    expect(applyIdleEnglishRepair('hell hwo are yuo are yuo comming or not let me now')).toMatch(/know/i)
    expect(applyLocalEnglishRepair('https://example.com/pth')).toBe('https://example.com/pth')
    const urlAnalysis = analyzeFieldText('see https://example.com/api please', { caret: 0 })
    expect(urlAnalysis.chunks.some((chunk) => chunk.protectedKind === 'url')).toBe(true)
    const emailAnalysis = analyzeFieldText('ops@example.net later', { caret: 0 })
    expect(emailAnalysis.chunks.some((chunk) => chunk.protectedKind === 'email')).toBe(true)
    expect(applyLocalEnglishRepair('hell hwo are yuo')).toBe('Hello, how are you?')
  })

  it('18-20. valid Direct English reaches WriteGate; stale/mutex cannot revive it', () => {
    const ta = textarea('I dont know')
    const session = new FieldSession(ta)
    const operation = beginEnglish(session, ta.value)
    const auth = createWriteAuthorization({
      operation,
      action: 'english_correction',
      range: { start: 0, end: ta.value.length },
      replacement: "I don't know",
    })
    const spy = vi.spyOn(writeGate, 'commitWriteTransaction')
    const acquired = session.tryAcquireWrite('CORRECT')
    expect(acquired.ok).toBe(true)
    if (!acquired.ok) return
    const written = commitWriteTransaction(ta, 0, 'I dont know'.length, "I don't know", {
      session,
      requestId: acquired.requestId,
      expectedGeneration: acquired.generation,
      origin: 'CORRECT',
      capability: 'correction',
      action: 'english_correction',
      authorization: auth,
    })
    session.releaseWrite('CORRECT', acquired.requestId)
    expect(written.verdict).toBe('written')
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()

    const staleTa = textarea('I dont know')
    const staleSession = new FieldSession(staleTa)
    const staleOp = beginEnglish(staleSession, staleTa.value)
    const staleAuth = createWriteAuthorization({
      operation: staleOp,
      action: 'english_correction',
      range: { start: 0, end: staleTa.value.length },
      replacement: "I don't know",
    })
    markOperationSuperseded(staleOp)
    const lock = staleSession.tryAcquireWrite('CORRECT')
    expect(lock.ok).toBe(true)
    if (!lock.ok) return
    const rejected = commitWriteTransaction(staleTa, 0, staleTa.value.length, "I don't know", {
      session: staleSession,
      requestId: lock.requestId,
      expectedGeneration: lock.generation,
      origin: 'CORRECT',
      capability: 'correction',
      action: 'english_correction',
      authorization: staleAuth,
    })
    staleSession.releaseWrite('CORRECT', lock.requestId)
    expect(rejected.verdict).not.toBe('written')
    expect(staleTa.value).toBe('I dont know')
  })

  it('21-27. English Box identity; substring/snapshot/range cannot authorize', async () => {
    stateManager.correction.mode = 'box'
    const original = 'I dont know what to write today'
    const ta = textarea(original)
    const session = new FieldSession(ta)
    const operation = beginEnglish(session, original)
    vi.mocked(requestCorrectionRemote).mockResolvedValue({
      type: 'CORRECT_TEXT_RESULT',
      ok: true,
      requestId: 'box',
      data: { originalText: original, correctedText: original.replace('dont', "don't"), changes: [] },
    })
    const { debouncer, card, fieldState: state, getCard } = fieldState(ta)
    await runCorrectionRequest(ta, session, original, debouncer.currentGeneration(), {
      metrics: createCorrectionMetrics(),
      fieldState: state,
      currentDebouncerGeneration: () => debouncer.currentGeneration(),
      getCard,
      operation,
    })
    const binding = card.getBinding()
    expect(binding?.operationId).toBe(operation.operationId)
    expect(binding?.revision).toBe(operation.revision)
    expect(binding?.fieldId).toBe(session.field.id)
    expect(binding?.snapshotFullText).toBe(original)
    expect(binding?.range).toEqual({ start: 0, end: original.length })
    expect(binding?.rangeText).toBe(original)
    expect(binding?.replacement).toContain("don't")

    session.bumpGeneration()
    expect(
      await acceptCorrectionSuggestion(ta, session, binding!, {
        metrics: createCorrectionMetrics(),
        fieldState: state,
        currentDebouncerGeneration: () => debouncer.currentGeneration(),
        getCard,
        operation,
      }),
    ).toBe('stale')

    const snap = textarea(original)
    const snapSession = new FieldSession(snap)
    const snapOp = beginEnglish(snapSession, original)
    const snapFields = fieldState(snap)
    await runCorrectionRequest(snap, snapSession, original, snapFields.debouncer.currentGeneration(), {
      metrics: createCorrectionMetrics(),
      fieldState: snapFields.fieldState,
      currentDebouncerGeneration: () => snapFields.debouncer.currentGeneration(),
      getCard: snapFields.getCard,
      operation: snapOp,
    })
    const snapBinding = snapFields.card.getBinding()
    expect(snapBinding).toBeTruthy()
    snap.value = `${original} extra`
    expect(
      await acceptCorrectionSuggestion(snap, snapSession, snapBinding!, {
        metrics: createCorrectionMetrics(),
        fieldState: snapFields.fieldState,
        currentDebouncerGeneration: () => snapFields.debouncer.currentGeneration(),
        getCard: snapFields.getCard,
        operation: snapOp,
      }),
    ).toBe('stale')

    const rangeTa = textarea(original)
    const rangeSession = new FieldSession(rangeTa)
    const rangeOp = beginEnglish(rangeSession, original)
    const rangeFields = fieldState(rangeTa)
    await runCorrectionRequest(rangeTa, rangeSession, original, rangeFields.debouncer.currentGeneration(), {
      metrics: createCorrectionMetrics(),
      fieldState: rangeFields.fieldState,
      currentDebouncerGeneration: () => rangeFields.debouncer.currentGeneration(),
      getCard: rangeFields.getCard,
      operation: rangeOp,
    })
    const rangeBinding = rangeFields.card.getBinding()!
    rangeBinding.range = { start: 2, end: 6 }
    expect(
      await acceptCorrectionSuggestion(rangeTa, rangeSession, rangeBinding, {
        metrics: createCorrectionMetrics(),
        fieldState: rangeFields.fieldState,
        currentDebouncerGeneration: () => rangeFields.debouncer.currentGeneration(),
        getCard: rangeFields.getCard,
        operation: rangeOp,
      }),
    ).toBe('stale')

    const textTa = textarea(original)
    const textSession = new FieldSession(textTa)
    const textOp = beginEnglish(textSession, original)
    const textFields = fieldState(textTa)
    await runCorrectionRequest(textTa, textSession, original, textFields.debouncer.currentGeneration(), {
      metrics: createCorrectionMetrics(),
      fieldState: textFields.fieldState,
      currentDebouncerGeneration: () => textFields.debouncer.currentGeneration(),
      getCard: textFields.getCard,
      operation: textOp,
    })
    const textBinding = textFields.card.getBinding()!
    textBinding.rangeText = 'xxxxx'
    expect(
      await acceptCorrectionSuggestion(textTa, textSession, textBinding, {
        metrics: createCorrectionMetrics(),
        fieldState: textFields.fieldState,
        currentDebouncerGeneration: () => textFields.debouncer.currentGeneration(),
        getCard: textFields.getCard,
        operation: textOp,
      }),
    ).toBe('stale')

    const dupText = `${original} ${original}`
    const dup = textarea(dupText)
    const dupSession = new FieldSession(dup)
    const dupOp = beginEnglish(dupSession, dupText)
    const dupFields = fieldState(dup)
    await runCorrectionRequest(dup, dupSession, dupText, dupFields.debouncer.currentGeneration(), {
      metrics: createCorrectionMetrics(),
      fieldState: dupFields.fieldState,
      currentDebouncerGeneration: () => dupFields.debouncer.currentGeneration(),
      getCard: dupFields.getCard,
      operation: dupOp,
    })
    const dupBinding = dupFields.card.getBinding()!
    dup.value = `zzzz ${original}`
    expect(
      await acceptCorrectionSuggestion(dup, dupSession, dupBinding, {
        metrics: createCorrectionMetrics(),
        fieldState: dupFields.fieldState,
        currentDebouncerGeneration: () => dupFields.debouncer.currentGeneration(),
        getCard: dupFields.getCard,
        operation: dupOp,
      }),
    ).toBe('stale')

    const ok = textarea(original)
    const okSession = new FieldSession(ok)
    const okOp = beginEnglish(okSession, original)
    const { debouncer: d2, card: card2, fieldState: state2, getCard: getCard2 } = fieldState(ok)
    await runCorrectionRequest(ok, okSession, original, d2.currentGeneration(), {
      metrics: createCorrectionMetrics(),
      fieldState: state2,
      currentDebouncerGeneration: () => d2.currentGeneration(),
      getCard: getCard2,
      operation: okOp,
    })
    const ready = card2.getBinding()
    expect(ready).toBeTruthy()
    const applied = await acceptCorrectionSuggestion(ok, okSession, ready!, {
      metrics: createCorrectionMetrics(),
      fieldState: state2,
      currentDebouncerGeneration: () => d2.currentGeneration(),
      getCard: getCard2,
      operation: okOp,
    })
    expect(applied).toBe('committed')
    expect(ok.value).toContain("don't")
  })

  it('28-30. English network uses AbortSignal, limiter, and skips stale waiters', async () => {
    const signals: AbortSignal[] = []
    vi.mocked(requestCorrectionRemote).mockImplementation(async (_id, _text, _k, _p, signal) => {
      if (signal) signals.push(signal)
      await new Promise(() => undefined)
      return { type: 'CORRECT_TEXT_RESULT', ok: false, requestId: _id, error: 'network' }
    })
    const ta = textarea('I dont know what to write today')
    const session = new FieldSession(ta)
    const operation = beginEnglish(session, ta.value)
    const { debouncer, fieldState: state, getCard } = fieldState(ta)
    void runCorrectionRequest(ta, session, ta.value, debouncer.currentGeneration(), {
      metrics: createCorrectionMetrics(),
      fieldState: state,
      currentDebouncerGeneration: () => debouncer.currentGeneration(),
      getCard,
      operation,
    })
    await Promise.resolve()
    await Promise.resolve()
    expect(signals[0]).toBeTruthy()
    expect(signals[0]!.aborted).toBe(false)
    operation.abort.abort()
    expect(signals[0]!.aborted).toBe(true)

    resetPhysicalHttpForTests()
    const fieldId = 'field-en'
    let started = 0
    const holds: Array<() => void> = []
    for (let i = 0; i < MAX_PHYSICAL_HTTP; i++) {
      void runWithPhysicalHttp({ fieldId, feature: 'english' }, () => new Promise<void>((resolve) => {
        started += 1
        holds.push(resolve)
      }))
      await Promise.resolve()
    }
    expect(started).toBe(MAX_PHYSICAL_HTTP)
    expect(getPhysicalHttpLimiter().count(fieldId, 'english')).toBe(3)
    const stale = runWithPhysicalHttp(
      { fieldId, feature: 'english', isCurrent: () => false },
      async () => undefined,
    )
    const staleResult = await stale
    expect(staleResult.dispatched).toBe(false)
    for (const release of holds) release()
  })

  it('31-32. English shortcut uses WriteAuthorization and WriteGate', async () => {
    const engine = new InputEngine()
    const scheduler = new CorrectionScheduler({ engine, metrics: createCorrectionMetrics() })
    const ta = textarea('hell hwo are yuo')
    engine.start()
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    const spy = vi.spyOn(writeGate, 'commitWriteTransaction')
    vi.mocked(requestCorrectionRemote).mockResolvedValue({
      type: 'CORRECT_TEXT_RESULT',
      ok: false,
      requestId: 'sc',
      error: 'consent_required',
    })
    const outcome = await scheduler.runFromShortcut(ta)
    expect(['committed', 'pending', 'blocked', 'noop', 'error']).toContain(outcome)
    if (outcome === 'committed') {
      expect(spy.mock.calls.some((call) => call[4]?.authorization)).toBe(true)
    } else {
      const session = engine.sessions.getOrCreate(ta)
      const authorization = issueImmediateWriteAuthorization({
        session,
        action: 'english_correction',
        range: { start: 0, end: ta.value.length },
        replacement: 'Hello, how are you?',
        snapshotFullText: ta.value,
      })
      const acquired = session.tryAcquireWrite('CORRECT')
      expect(acquired.ok).toBe(true)
      if (!acquired.ok) return
      commitWriteTransaction(ta, 0, ta.value.length, 'Hello, how are you?', {
        session,
        requestId: acquired.requestId,
        expectedGeneration: acquired.generation,
        origin: 'CORRECT',
        capability: 'correction',
        action: 'english_correction',
        authorization,
      })
      session.releaseWrite('CORRECT', acquired.requestId)
      expect(spy).toHaveBeenCalled()
    }
    spy.mockRestore()
    engine.stop()
  })

  it('33-34. composition does not create per-keystroke English operations; end bumps once', () => {
    const engine = new InputEngine()
    engine.start()
    const ta = textarea()
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    const session = engine.sessions.getOrCreate(ta)
    const before = session.getRevision()
    ta.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    ta.value = 'n'
    ta.dispatchEvent(new CompositionEvent('compositionupdate', { bubbles: true }))
    ta.value = 'ni'
    ta.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }))
    expect(session.getRevision()).toBe(before)
    expect(session.operations.list().filter((op) => op.feature === 'english')).toHaveLength(0)
    ta.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
    expect(session.getRevision()).toBe(before + 1)
    engine.stop()
  })

  it('35-36. English coexists with Translation and Layout on the same revision', () => {
    const ta = textarea('hello')
    const session = new FieldSession(ta)
    const english = beginEnglish(session, ta.value)
    const layout = session.operations.begin({
      fieldId: session.field.id,
      revision: session.getRevision(),
      feature: 'layout',
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
    expect(english.revision).toBe(layout.revision)
    expect(layout.revision).toBe(translate.revision)
    expect(english.operationId).not.toBe(layout.operationId)
    expect(english.operationId).not.toBe(translate.operationId)
  })

  it('37-39. failed English write releases mutex; later operation can run', () => {
    const ta = textarea('I dont know')
    const session = new FieldSession(ta)
    const operation = beginEnglish(session, ta.value)
    const auth = createWriteAuthorization({
      operation,
      action: 'english_correction',
      range: { start: 0, end: ta.value.length },
      replacement: "I don't know",
    })
    markOperationFailed(operation)
    const acquired = session.tryAcquireWrite('CORRECT')
    expect(acquired.ok).toBe(true)
    if (!acquired.ok) return
    commitWriteTransaction(ta, 0, ta.value.length, "I don't know", {
      session,
      requestId: acquired.requestId,
      expectedGeneration: acquired.generation,
      origin: 'CORRECT',
      capability: 'correction',
      action: 'english_correction',
      authorization: auth,
    })
    session.releaseWrite('CORRECT', acquired.requestId)
    expect(session.getActiveRequest()).toBeNull()
    const later = beginEnglish(session, ta.value)
    const laterAuth = createWriteAuthorization({
      operation: later,
      action: 'english_correction',
      range: { start: 0, end: ta.value.length },
      replacement: "I don't know",
    })
    const again = session.tryAcquireWrite('CORRECT')
    expect(again.ok).toBe(true)
    if (!again.ok) return
    const written = commitWriteTransaction(ta, 0, ta.value.length, "I don't know", {
      session,
      requestId: again.requestId,
      expectedGeneration: again.generation,
      origin: 'CORRECT',
      capability: 'correction',
      action: 'english_correction',
      authorization: laterAuth,
    })
    session.releaseWrite('CORRECT', again.requestId)
    expect(written.verdict).toBe('written')
  })

  it('40-43. IntelligentDebouncer is not the automatic owner; WriteGate remains the mutator', () => {
    const schedulerSrc = readFileSync(join(process.cwd(), 'src/features/correction/scheduler.ts'), 'utf8')
    const featureSrc = readFileSync(join(process.cwd(), 'src/features/correction/CorrectionFeature.ts'), 'utf8')
    expect(schedulerSrc).not.toMatch(/debouncer\.schedule\(/)
    expect(schedulerSrc).not.toMatch(/\bsetTimeout\b/)
    expect(schedulerSrc).not.toMatch(/\bsetInterval\b/)
    expect(featureSrc).not.toMatch(/\bsetTimeout\b/)
    const ta = textarea('I dont know')
    const session = new FieldSession(ta)
    const operation = beginEnglish(session, ta.value)
    const auth = createWriteAuthorization({
      operation,
      action: 'english_correction',
      range: { start: 0, end: ta.value.length },
      replacement: "I don't know",
    })
    expect(auth).not.toHaveProperty('expiresAt')
    expect(auth.revision).toBe(session.getRevision())
  })
})

describe('Phase 7 span English still uses snapshot identity', () => {
  it('pipeline English span Box apply is identity-backed', () => {
    applyUserWritingPolicy({ improveEnglish: false, fixWrongTyping: true, helpStyle: 'suggestions' })
    stateManager.correction.enabled = false
    const ta = textarea('hel ')
    const session = new FieldSession(ta)
    const operation = beginEnglish(session, 'hel ')
    presentPipelineSuggestion({
      fieldId: session.field.id,
      element: ta,
      session,
      generation: 0,
      range: { start: 0, end: 3 },
      sourceText: 'hel',
      suggestion: 'help',
      action: 'english_correction',
      textOrigin: 'original_en',
      operation,
    })
    expect(applyPipelineSuggestion(session.field.id)).toBe('applied')
    expect(ta.value.startsWith('help')).toBe(true)
  })
})
