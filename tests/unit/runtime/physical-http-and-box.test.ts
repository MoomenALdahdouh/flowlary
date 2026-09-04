import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { bumpUserGeneration } from '../../../extension/src/core/dom/generation.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'
import { commitWriteTransaction } from '../../../extension/src/core/writeGate/writeGate.ts'
import {
  applyPipelineSuggestion,
  getActivePipelineSuggestion,
  getPipelineSuggestionState,
  getSameRevisionReanalysisCountForTests,
  invalidateStalePipelineSuggestion,
  presentPipelineSuggestion,
  resetPipelineSuggestionsForTests,
} from '../../../extension/src/core/writeGate/pipelineSuggest.ts'
import {
  MAX_PHYSICAL_HTTP,
  getPhysicalHttpLimiter,
  resetPhysicalHttpForTests,
  runWithPhysicalHttp,
} from '../../../extension/src/core/runtime/physicalHttp.ts'
import {
  createBoxSuggestion,
  evaluateBoxApplyAuthorization,
} from '../../../extension/src/core/runtime/suggestion.ts'
import { markOperationRunning } from '../../../extension/src/core/runtime/Operation.ts'
import { requestTranslationRemote } from '../../../extension/src/features/translation/client.ts'
import { requestCorrectionRemote } from '../../../extension/src/features/correction/client.ts'

function textarea(value: string) {
  const ta = document.createElement('textarea')
  ta.value = value
  document.body.append(ta)
  return ta
}

function beginOp(session: FieldSession, text: string, feature: 'layout' | 'english' | 'translate' = 'layout') {
  const op = session.operations.begin({
    fieldId: session.field.id,
    revision: session.getRevision(),
    feature,
    purpose: 'auto-analysis',
    trigger: 'auto',
    snapshotFullText: text,
  })
  markOperationRunning(op)
  return op
}

describe('Phase 4 physical HTTP cap', () => {
  beforeEach(() => {
    resetPhysicalHttpForTests()
  })

  afterEach(() => {
    resetPhysicalHttpForTests()
  })

  it('allows 0 → 1 → 2 → 3 open requests', async () => {
    const limiter = getPhysicalHttpLimiter()
    const fieldId = 'field-a'
    const holds: Array<() => void> = []
    for (let i = 0; i < MAX_PHYSICAL_HTTP; i++) {
      let release!: () => void
      const gate = runWithPhysicalHttp({ fieldId, feature: 'english' }, () => new Promise<void>((resolve) => {
        release = resolve
      }))
      holds.push(() => release())
      await Promise.resolve()
      expect(limiter.count(fieldId, 'english')).toBe(i + 1)
      void gate
    }
    expect(limiter.count(fieldId, 'english')).toBe(3)
    for (const release of holds) release()
    await Promise.resolve()
    expect(limiter.count(fieldId, 'english')).toBe(0)
  })

  it('does not dispatch a fourth request while three remain open', async () => {
    const fieldId = 'field-a'
    let dispatched = 0
    const holds: Array<() => void> = []
    const start = () =>
      runWithPhysicalHttp({ fieldId, feature: 'english' }, async () => {
        dispatched += 1
        await new Promise<void>((resolve) => holds.push(resolve))
      })
    const first = [start(), start(), start()]
    await vi.waitFor(() => {
      expect(dispatched).toBe(3)
    })
    const fourth = start()
    await Promise.resolve()
    expect(dispatched).toBe(3)
    holds[0]!()
    await vi.waitFor(() => {
      expect(dispatched).toBe(4)
    })
    holds[1]!()
    holds[2]!()
    holds[3]!()
    await Promise.all([...first, fourth])
  })

  it('counts aborted-but-open requests toward the cap', async () => {
    const fieldId = 'field-a'
    const controller = new AbortController()
    let dispatched = 0
    const hanging = () =>
      runWithPhysicalHttp(
        {
          fieldId,
          feature: 'english',
          isCurrent: () => true,
        },
        async () => {
          dispatched += 1
          await new Promise<void>(() => undefined)
        },
      )
    void hanging()
    void hanging()
    void hanging()
    await Promise.resolve()
    controller.abort()
    expect(getPhysicalHttpLimiter().count(fieldId, 'english')).toBe(3)
    let fourthDispatched = false
    const fourth = runWithPhysicalHttp({ fieldId, feature: 'english' }, async () => {
      fourthDispatched = true
    })
    await Promise.resolve()
    expect(fourthDispatched).toBe(false)
    expect(dispatched).toBe(3)
    void fourth
  })

  it('lets a waiting current operation use a freed slot', async () => {
    const session = new FieldSession(textarea('hello'))
    const fieldId = session.field.id
    const op = beginOp(session, 'hello', 'english')
    const holds: Array<() => void> = []
    const start = (isCurrent: () => boolean) =>
      runWithPhysicalHttp({ fieldId, feature: 'english', isCurrent }, async () => {
        await new Promise<void>((resolve) => holds.push(resolve))
        return 'ok'
      })
    void start(() => true)
    void start(() => true)
    void start(() => true)
    await Promise.resolve()
    const waiting = runWithPhysicalHttp(
      { fieldId, feature: 'english', isCurrent: () => op.revision === session.getRevision() },
      async () => 'ok',
    )
    await Promise.resolve()
    expect(getPhysicalHttpLimiter().count(fieldId, 'english')).toBe(3)
    holds[0]!()
    await expect(waiting).resolves.toEqual({ dispatched: true, value: 'ok' })
    holds[1]!()
    holds[2]!()
  })

  it('discards a waiting stale operation rather than dispatching it', async () => {
    const session = new FieldSession(textarea('hello'))
    const fieldId = session.field.id
    const op = beginOp(session, 'hello', 'english')
    const holds: Array<() => void> = []
    const start = () =>
      runWithPhysicalHttp(
        {
          fieldId,
          feature: 'english',
          isCurrent: () => op.revision === session.getRevision() && op.state !== 'superseded',
        },
        async () => 'sent',
      )
    const parked = () =>
      runWithPhysicalHttp({ fieldId, feature: 'english', isCurrent: () => true }, () =>
        new Promise<string>((resolve) => holds.push(() => resolve('hold'))),
      )
    void parked()
    void parked()
    void parked()
    await Promise.resolve()
    const waiting = start()
    session.bumpGeneration()
    holds[0]!()
    await expect(waiting).resolves.toEqual({ dispatched: false })
    holds[1]!()
    holds[2]!()
  })

  it('releases the slot after failed, successful, and settled aborted requests', async () => {
    const fieldId = 'field-a'
    await expect(
      runWithPhysicalHttp({ fieldId, feature: 'translate' }, async () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    expect(getPhysicalHttpLimiter().count(fieldId, 'translate')).toBe(0)

    await expect(
      runWithPhysicalHttp({ fieldId, feature: 'translate' }, async () => 'ok'),
    ).resolves.toEqual({ dispatched: true, value: 'ok' })
    expect(getPhysicalHttpLimiter().count(fieldId, 'translate')).toBe(0)

    const controller = new AbortController()
    const pending = runWithPhysicalHttp({ fieldId, feature: 'translate' }, async () => {
      await new Promise<void>((resolve) => {
        if (controller.signal.aborted) {
          resolve()
          return
        }
        controller.signal.addEventListener('abort', () => resolve(), { once: true })
      })
      return 'aborted-settled'
    })
    await vi.waitFor(() => {
      expect(getPhysicalHttpLimiter().count(fieldId, 'translate')).toBe(1)
    })
    controller.abort()
    await pending
    expect(getPhysicalHttpLimiter().count(fieldId, 'translate')).toBe(0)
  })

  it('keeps English and Translation caps independent', async () => {
    const fieldId = 'field-a'
    const hold = () => new Promise<void>(() => undefined)
    void runWithPhysicalHttp({ fieldId, feature: 'english' }, hold)
    void runWithPhysicalHttp({ fieldId, feature: 'english' }, hold)
    void runWithPhysicalHttp({ fieldId, feature: 'english' }, hold)
    await Promise.resolve()
    expect(getPhysicalHttpLimiter().count(fieldId, 'english')).toBe(3)
    const translate = runWithPhysicalHttp({ fieldId, feature: 'translate' }, async () => 't')
    await expect(translate).resolves.toEqual({ dispatched: true, value: 't' })
    expect(getPhysicalHttpLimiter().count(fieldId, 'translate')).toBe(0)
  })

  it('does not use the cap as a freshness clock', () => {
    const session = new FieldSession(textarea('hello'))
    const revision = session.getRevision()
    expect(getPhysicalHttpLimiter().count(session.field.id, 'english')).toBe(0)
    session.bumpGeneration()
    expect(session.getRevision()).toBe(revision + 1)
    expect(getPhysicalHttpLimiter().count(session.field.id, 'english')).toBe(0)
  })

  it('gates requestTranslationRemote and requestCorrectionRemote behind the cap', async () => {
    vi.stubGlobal('chrome', {
      runtime: {
        sendMessage: vi.fn(async () => new Promise(() => undefined)),
      },
    })
    const session = new FieldSession(textarea('مرحبا'))
    const physical = { fieldId: session.field.id, feature: 'translate' as const }
    void requestTranslationRemote('مرحبا', 'ar', 'en', undefined, 'live', undefined, physical)
    void requestTranslationRemote('مرحبا', 'ar', 'en', undefined, 'live', undefined, physical)
    void requestTranslationRemote('مرحبا', 'ar', 'en', undefined, 'live', undefined, physical)
    await Promise.resolve()
    expect(getPhysicalHttpLimiter().count(session.field.id, 'translate')).toBe(3)
    const english = {
      fieldId: session.field.id,
      feature: 'english' as const,
    }
    void requestCorrectionRemote('c1', 'teh', 'textarea', undefined, undefined, undefined, english)
    await Promise.resolve()
    expect(getPhysicalHttpLimiter().count(session.field.id, 'english')).toBe(1)
    vi.unstubAllGlobals()
  })
})

describe('Phase 4 Box identity', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    resetPipelineSuggestionsForTests()
    stateManager.settings = {
      enabled: true,
      pausedUntil: null,
      excludedDomains: [],
      version: 1,
      helpStyle: 'suggestions',
    }
  })

  afterEach(() => {
    resetPipelineSuggestionsForTests()
  })

  it('captures operationId/revision/fieldId/snapshot/range/replacement', () => {
    const ta = textarea('hello')
    const session = new FieldSession(ta)
    const operation = beginOp(session, 'hello')
    presentPipelineSuggestion({
      fieldId: session.field.id,
      element: ta,
      session,
      generation: session.getRevision(),
      range: { start: 0, end: 5 },
      sourceText: 'hello',
      suggestion: 'Hello',
      action: 'layout_fix',
      textOrigin: 'layout_mismatch_suspected',
      operation,
    })
    const identity = getActivePipelineSuggestion(session.field.id)?.identity
    expect(identity).toMatchObject({
      operationId: operation.operationId,
      revision: operation.revision,
      fieldId: session.field.id,
      snapshotFullText: 'hello',
      range: { start: 0, end: 5 },
      rangeText: 'hello',
      replacement: 'Hello',
      state: 'ready',
    })
    expect(identity?.snapshotHash).toBeTruthy()
  })

  it('hides a READY Box after revision bump', () => {
    const ta = textarea('hello')
    const session = new FieldSession(ta)
    presentPipelineSuggestion({
      fieldId: session.field.id,
      element: ta,
      session,
      generation: 0,
      range: { start: 0, end: 5 },
      sourceText: 'hello',
      suggestion: 'Hello',
      action: 'layout_fix',
      textOrigin: 'layout_mismatch_suspected',
      operation: beginOp(session, 'hello'),
    })
    expect(getPipelineSuggestionState(session.field.id)).toBe('ready')
    session.bumpGeneration()
    expect(getActivePipelineSuggestion(session.field.id)).toBeNull()
    expect(getPipelineSuggestionState(session.field.id)).toBe('hidden')
  })

  it('rejects apply after revision change even if the substring still exists', () => {
    const ta = textarea('hello')
    const session = new FieldSession(ta)
    const operation = beginOp(session, 'hello')
    presentPipelineSuggestion({
      fieldId: session.field.id,
      element: ta,
      session,
      generation: 0,
      range: { start: 0, end: 5 },
      sourceText: 'hello',
      suggestion: 'Hello',
      action: 'layout_fix',
      textOrigin: 'layout_mismatch_suspected',
      operation,
    })
    ta.value = 'hello world'
    bumpUserGeneration(ta, session)
    expect(applyPipelineSuggestion(session.field.id)).toBe('missing')
    expect(ta.value).toBe('hello world')
  })

  it('rejects apply after acquiring a fresh mutex', () => {
    const ta = textarea('hello')
    const session = new FieldSession(ta)
    const operation = beginOp(session, 'hello')
    presentPipelineSuggestion({
      fieldId: session.field.id,
      element: ta,
      session,
      generation: 0,
      range: { start: 0, end: 5 },
      sourceText: 'hello',
      suggestion: 'Hello',
      action: 'layout_fix',
      textOrigin: 'layout_mismatch_suspected',
      operation,
    })
    session.bumpGeneration()
    const lock = session.tryAcquireWrite('FIX_LAYOUT')
    expect(lock.ok).toBe(true)
    expect(applyPipelineSuggestion(session.field.id)).toBe('missing')
    expect(ta.value).toBe('hello')
    if (lock.ok) session.releaseWrite('FIX_LAYOUT', lock.requestId)
  })

  it('rejects snapshot, range, and range-text mismatches', () => {
    const ta = textarea('hello')
    const session = new FieldSession(ta)
    const operation = beginOp(session, 'hello')
    const suggestion = createBoxSuggestion({
      operation,
      range: { start: 0, end: 5 },
      replacement: 'Hello',
      action: 'layout_fix',
      textOrigin: 'layout_mismatch_suspected',
    })
    ta.value = 'hello!'
    expect(evaluateBoxApplyAuthorization({ suggestion, session, element: ta, operation }).reason).toBe(
      'snapshot_mismatch',
    )
    ta.value = 'hello'
    expect(evaluateBoxApplyAuthorization({
      suggestion: { ...suggestion, range: { start: 0, end: 4 } },
      session,
      element: ta,
      operation,
    }).reason).toBe('range_text_mismatch')
    expect(evaluateBoxApplyAuthorization({
      suggestion: { ...suggestion, rangeText: 'hallo' },
      session,
      element: ta,
      operation,
    }).reason).toBe('range_text_mismatch')
  })

  it('applies a valid unchanged Box through WriteGate', () => {
    const ta = textarea('hello')
    const session = new FieldSession(ta)
    const operation = beginOp(session, 'hello')
    presentPipelineSuggestion({
      fieldId: session.field.id,
      element: ta,
      session,
      generation: 0,
      range: { start: 0, end: 5 },
      sourceText: 'hello',
      suggestion: 'Hello',
      action: 'layout_fix',
      textOrigin: 'layout_mismatch_suspected',
      operation,
    })
    expect(applyPipelineSuggestion(session.field.id)).toBe('applied')
    expect(ta.value).toBe('Hello')
  })

  it('does not write when the DOM changes without a revision bump', () => {
    const ta = textarea('hello')
    const session = new FieldSession(ta)
    const operation = beginOp(session, 'hello')
    presentPipelineSuggestion({
      fieldId: session.field.id,
      element: ta,
      session,
      generation: 0,
      range: { start: 0, end: 5 },
      sourceText: 'hello',
      suggestion: 'Hello',
      action: 'layout_fix',
      textOrigin: 'layout_mismatch_suspected',
      operation,
    })
    ta.value = 'other'
    expect(session.getRevision()).toBe(0)
    expect(applyPipelineSuggestion(session.field.id)).toBe('stale')
    expect(ta.value).toBe('other')
  })

  it('bounds same-revision reanalysis to one attempt and does not poll', () => {
    const ta = textarea('hello')
    const session = new FieldSession(ta)
    const operation = beginOp(session, 'hello')
    presentPipelineSuggestion({
      fieldId: session.field.id,
      element: ta,
      session,
      generation: 0,
      range: { start: 0, end: 5 },
      sourceText: 'hello',
      suggestion: 'Hello',
      action: 'layout_fix',
      textOrigin: 'layout_mismatch_suspected',
      operation,
    })
    ta.value = 'changed'
    invalidateStalePipelineSuggestion(session, 'changed')
    expect(getSameRevisionReanalysisCountForTests()).toBe(1)
    presentPipelineSuggestion({
      fieldId: session.field.id,
      element: ta,
      session,
      generation: 0,
      range: { start: 0, end: 7 },
      sourceText: 'changed',
      suggestion: 'Changed',
      action: 'layout_fix',
      textOrigin: 'layout_mismatch_suspected',
      operation: beginOp(session, 'changed'),
    })
    ta.value = 'changed again'
    invalidateStalePipelineSuggestion(session, 'changed again')
    expect(getSameRevisionReanalysisCountForTests()).toBe(1)
    expect(session.trySameRevisionReanalysis()).toBe(false)
  })

  it('keeps WriteGate as the only field mutator on apply', () => {
    const ta = textarea('hello')
    const session = new FieldSession(ta)
    const spy = vi.spyOn({ commitWriteTransaction }, 'commitWriteTransaction')
    void spy
    const operation = beginOp(session, 'hello')
    presentPipelineSuggestion({
      fieldId: session.field.id,
      element: ta,
      session,
      generation: 0,
      range: { start: 0, end: 5 },
      sourceText: 'hello',
      suggestion: 'Hello',
      action: 'layout_fix',
      textOrigin: 'layout_mismatch_suspected',
      operation,
    })
    expect(applyPipelineSuggestion(session.field.id)).toBe('applied')
    expect(ta.value).toBe('Hello')
  })
})
