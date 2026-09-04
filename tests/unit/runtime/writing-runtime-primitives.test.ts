import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { withWriteOrigin } from '../../../extension/src/core/dom/writeOrigin.ts'
import { InputEngine } from '../../../extension/src/core/input/InputEngine.ts'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { resetComposition } from '../../../extension/src/core/dom/composition.ts'
import {
  assertTraceHasNoUserText,
  isOperationFresh,
  isOperationPermanentlyStale,
  markOperationSucceeded,
  resetOperationIdsForTests,
  setRuntimeTraceSinkForTests,
} from '../../../extension/src/core/runtime/index.ts'

function textarea(value = '') {
  const ta = document.createElement('textarea')
  ta.value = value
  document.body.append(ta)
  return ta
}

function beginEnglish(session: FieldSession, text: string) {
  return session.operations.begin({
    fieldId: session.field.id,
    revision: session.getRevision(),
    feature: 'english',
    purpose: 'auto-analysis',
    trigger: 'auto',
    snapshotFullText: text,
  })
}

describe('writing runtime primitives', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    resetComposition()
    resetOperationIdsForTests()
    setRuntimeTraceSinkForTests(null)
  })

  afterEach(() => {
    setRuntimeTraceSinkForTests(null)
    resetComposition()
  })

  it('revision increments exactly once per ordinary USER input', () => {
    const engine = new InputEngine()
    const ta = textarea()
    engine.start()
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    const session = engine.getActiveSession()!
    expect(session.getRevision()).toBe(0)
    expect(session.getRevision()).toBe(session.getGeneration())
    ta.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
    expect(session.getRevision()).toBe(1)
    ta.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
    expect(session.getRevision()).toBe(2)
    engine.stop()
  })

  it('SYSTEM writes do not increment revision', () => {
    const engine = new InputEngine()
    const ta = textarea()
    engine.start()
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    const session = engine.getActiveSession()!
    ta.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
    expect(session.getRevision()).toBe(1)
    withWriteOrigin('CORRECT', () => {
      ta.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
    })
    expect(session.getRevision()).toBe(1)
    ta.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' }))
    expect(session.getRevision()).toBe(1)
    engine.stop()
  })

  it('composition sequence increments revision exactly once', () => {
    const engine = new InputEngine()
    const ta = textarea()
    engine.start()
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    const session = engine.getActiveSession()!
    ta.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    expect(session.getRevision()).toBe(0)
    ta.dispatchEvent(new CompositionEvent('compositionupdate', { bubbles: true }))
    ta.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertCompositionText' }))
    expect(session.getRevision()).toBe(0)
    expect(session.isComposing()).toBe(true)
    ta.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
    expect(session.getRevision()).toBe(1)
    expect(session.isComposing()).toBe(false)
    ta.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertCompositionText' }))
    ta.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromComposition' }))
    expect(session.getRevision()).toBe(1)
    ta.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
    expect(session.getRevision()).toBe(2)
    engine.stop()
  })

  it('old Operation becomes permanently stale after revision bump', () => {
    const session = new FieldSession(textarea('hello'))
    const op = beginEnglish(session, 'hello')
    expect(isOperationFresh(op, session.getRevision())).toBe(true)
    session.bumpGeneration()
    expect(isOperationPermanentlyStale(op, session.getRevision())).toBe(true)
    expect(isOperationFresh(op, session.getRevision())).toBe(false)
    expect(op.state).toBe('superseded')
  })

  it('old Operation cannot become fresh again', () => {
    const session = new FieldSession(textarea('hello'))
    const op = beginEnglish(session, 'hello')
    const capturedRevision = op.revision
    session.bumpGeneration()
    const lock = session.tryAcquireWrite('CORRECT')
    expect(lock.ok).toBe(true)
    if (lock.ok) session.releaseWrite('CORRECT', lock.requestId)
    markOperationSucceeded(op)
    expect(op.revision).toBe(capturedRevision)
    expect(op.revision).not.toBe(session.getRevision())
    expect(isOperationFresh(op, session.getRevision())).toBe(false)
    expect(isOperationPermanentlyStale(op, session.getRevision())).toBe(true)
  })

  it('different features can coexist on the same revision', () => {
    const session = new FieldSession(textarea('مرحبا hello'))
    const english = beginEnglish(session, 'مرحبا hello')
    const translate = session.operations.begin({
      fieldId: session.field.id,
      revision: session.getRevision(),
      feature: 'translate',
      purpose: 'auto-analysis',
      trigger: 'auto',
      snapshotFullText: 'مرحبا hello',
    })
    expect(english.revision).toBe(translate.revision)
    expect(english.operationId).not.toBe(translate.operationId)
    expect(isOperationFresh(english, session.getRevision())).toBe(true)
    expect(isOperationFresh(translate, session.getRevision())).toBe(true)
  })

  it('duplicate same-feature/same-revision/purpose operations coalesce', () => {
    const session = new FieldSession(textarea('hello'))
    const first = beginEnglish(session, 'hello')
    const second = beginEnglish(session, 'hello world')
    expect(second.operationId).toBe(first.operationId)
    expect(session.operations.list()).toHaveLength(1)
  })

  it('Abort is triggered on revision invalidation', () => {
    const session = new FieldSession(textarea('hello'))
    const op = beginEnglish(session, 'hello')
    expect(op.abort.signal.aborted).toBe(false)
    session.bumpGeneration()
    expect(op.abort.signal.aborted).toBe(true)
  })

  it('an aborted operation remains stale even if its promise later resolves successfully', async () => {
    const session = new FieldSession(textarea('hello'))
    const op = beginEnglish(session, 'hello')
    const pending = new Promise<{ ok: true; text: string }>((resolve) => {
      setTimeout(() => resolve({ ok: true, text: 'Hello' }), 0)
    })
    session.bumpGeneration()
    const result = await pending
    expect(result.ok).toBe(true)
    expect(isOperationFresh(op, session.getRevision())).toBe(false)
    expect(isOperationPermanentlyStale(op, session.getRevision())).toBe(true)
  })

  it('instrumentation does not log raw user text', () => {
    const lines: string[] = []
    setRuntimeTraceSinkForTests((line) => lines.push(line))
    const secret = 'UNIQUE_USER_SECRET_PHRASE_9911'
    const session = new FieldSession(textarea(secret))
    beginEnglish(session, secret)
    session.bumpGeneration()
    expect(lines.length).toBeGreaterThan(0)
    for (const line of lines) {
      expect(assertTraceHasNoUserText(line, secret)).toBe(true)
      expect(line).not.toContain(secret)
    }
  })
})
