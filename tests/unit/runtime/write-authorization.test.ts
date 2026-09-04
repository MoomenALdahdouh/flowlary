import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { InputEngine } from '../../../extension/src/core/input/InputEngine.ts'
import { syncDomGeneration } from '../../../extension/src/core/dom/generation.ts'
import { commitWriteTransaction } from '../../../extension/src/core/writeGate/writeGate.ts'
import {
  applyPipelineSuggestion,
  presentPipelineSuggestion,
  resetPipelineSuggestionsForTests,
} from '../../../extension/src/core/writeGate/pipelineSuggest.ts'
import { executeTranslation } from '../../../extension/src/features/translation/executor.ts'
import {
  createWriteAuthorization,
  evaluateWriteAuthorization,
  resetOperationIdsForTests,
  resetWriteAuthorizationIdsForTests,
} from '../../../extension/src/core/runtime/index.ts'
import {
  markOperationAborted,
  markOperationFailed,
  markOperationRunning,
  markOperationSuperseded,
} from '../../../extension/src/core/runtime/Operation.ts'
import { applyUserWritingPolicy } from '../../../extension/src/core/policy/writingPolicy.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'

function textarea(value: string) {
  const ta = document.createElement('textarea')
  ta.value = value
  document.body.append(ta)
  return ta
}

function beginOp(
  session: FieldSession,
  text: string,
  feature: 'layout' | 'english' | 'translate' = 'layout',
) {
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

function write(session: FieldSession, element: HTMLTextAreaElement, auth: ReturnType<typeof createWriteAuthorization>) {
  const acquired = session.tryAcquireWrite('CORRECT')
  expect(acquired.ok).toBe(true)
  if (!acquired.ok) throw new Error('mutex')
  try {
    return commitWriteTransaction(element, auth.range.start, auth.range.end, auth.replacement, {
      session,
      requestId: acquired.requestId,
      expectedGeneration: acquired.generation,
      origin: 'CORRECT',
      auto: false,
      capability: auth.action === 'layout_fix' ? 'layout' : auth.action === 'translation' ? 'translation' : 'correction',
      trigger: 'auto',
      action: auth.action,
      authorization: auth,
    })
  } finally {
    session.releaseWrite('CORRECT', acquired.requestId)
  }
}

describe('Phase 5 write authorization', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    resetOperationIdsForTests()
    resetWriteAuthorizationIdsForTests()
    resetPipelineSuggestionsForTests()
    applyUserWritingPolicy({
      helpStyle: 'auto',
      improveEnglish: true,
      fixWrongTyping: true,
      arabicToEnglishMode: true,
    })
    stateManager.correction.enabled = true
    stateManager.correction.mode = 'direct'
    stateManager.translation.enabled = true
    stateManager.translation.mode = 'direct'
  })

  afterEach(() => {
    resetPipelineSuggestionsForTests()
  })

  it('1. valid current authorization can write', () => {
    const ta = textarea('hello')
    const session = new FieldSession(ta)
    const operation = beginOp(session, 'hello')
    const auth = createWriteAuthorization({
      operation,
      action: 'english_correction',
      range: { start: 0, end: 5 },
      replacement: 'Hello',
    })
    expect(write(session, ta, auth).verdict).toBe('written')
    expect(ta.value).toBe('Hello')
  })

  it('2-3. authorization captures immutable operationId and revision', () => {
    const ta = textarea('hello')
    const session = new FieldSession(ta)
    const operation = beginOp(session, 'hello')
    const auth = createWriteAuthorization({
      operation,
      action: 'layout_fix',
      range: { start: 0, end: 5 },
      replacement: 'Hello',
    })
    expect(auth.operationId).toBe(operation.operationId)
    expect(auth.revision).toBe(operation.revision)
    expect(Object.getOwnPropertyDescriptor(auth, 'operationId')?.writable).toBe(false)
    expect(Object.getOwnPropertyDescriptor(auth, 'revision')?.writable).toBe(false)
    expect(() => {
      ;(auth as { revision: number }).revision = 99
    }).toThrow()
    expect(auth.revision).toBe(0)
    expect(auth.operationId).toBe(operation.operationId)
  })

  it('4. wrong operationId is rejected', () => {
    const ta = textarea('hello')
    const session = new FieldSession(ta)
    const operation = beginOp(session, 'hello')
    const auth = createWriteAuthorization({
      operation,
      action: 'english_correction',
      range: { start: 0, end: 5 },
      replacement: 'Hello',
    })
    const forged = { ...auth, operationId: 'op-missing' }
    const acquired = session.tryAcquireWrite('CORRECT')
    expect(acquired.ok).toBe(true)
    if (!acquired.ok) return
    const result = commitWriteTransaction(ta, 0, 5, 'Hello', {
      session,
      requestId: acquired.requestId,
      expectedGeneration: acquired.generation,
      origin: 'CORRECT',
      capability: 'correction',
      action: 'english_correction',
      authorization: forged,
    })
    session.releaseWrite('CORRECT', acquired.requestId)
    expect(result.verdict).not.toBe('written')
    expect(ta.value).toBe('hello')
  })

  it('5. wrong fieldId is rejected', () => {
    const ta = textarea('hello')
    const session = new FieldSession(ta)
    const operation = beginOp(session, 'hello')
    const auth = createWriteAuthorization({
      operation,
      action: 'english_correction',
      range: { start: 0, end: 5 },
      replacement: 'Hello',
    })
    const other = textarea('hello')
    const otherSession = new FieldSession(other)
    const check = evaluateWriteAuthorization({
      authorization: auth,
      session: otherSession,
      element: other,
      operation,
      start: 0,
      end: 5,
      replacement: 'Hello',
      action: 'english_correction',
    })
    expect(check.ok).toBe(false)
    if (!check.ok) expect(check.reason).toBe('field_mismatch')
  })

  it('6-7. wrong revision and old-revision authorization are rejected', () => {
    const ta = textarea('hello')
    const session = new FieldSession(ta)
    const operation = beginOp(session, 'hello')
    const auth = createWriteAuthorization({
      operation,
      action: 'english_correction',
      range: { start: 0, end: 5 },
      replacement: 'Hello',
    })
    session.bumpGeneration()
    expect(write(session, ta, auth).verdict).toBe('stale')
    expect(ta.value).toBe('hello')
  })

  it('8. superseded operation authorization is rejected', () => {
    const ta = textarea('hello')
    const session = new FieldSession(ta)
    const operation = beginOp(session, 'hello')
    const auth = createWriteAuthorization({
      operation,
      action: 'english_correction',
      range: { start: 0, end: 5 },
      replacement: 'Hello',
    })
    markOperationSuperseded(operation)
    expect(write(session, ta, auth).reason).toBe('superseded')
    expect(ta.value).toBe('hello')
  })

  it('9. aborted operation authorization is rejected', () => {
    const ta = textarea('hello')
    const session = new FieldSession(ta)
    const operation = beginOp(session, 'hello')
    const auth = createWriteAuthorization({
      operation,
      action: 'english_correction',
      range: { start: 0, end: 5 },
      replacement: 'Hello',
    })
    markOperationAborted(operation)
    expect(write(session, ta, auth).reason).toBe('aborted')
    expect(ta.value).toBe('hello')
  })

  it('10. failed operation authorization is rejected', () => {
    const ta = textarea('hello')
    const session = new FieldSession(ta)
    const operation = beginOp(session, 'hello')
    const auth = createWriteAuthorization({
      operation,
      action: 'english_correction',
      range: { start: 0, end: 5 },
      replacement: 'Hello',
    })
    markOperationFailed(operation)
    expect(write(session, ta, auth).reason).toBe('failed')
    expect(ta.value).toBe('hello')
  })

  it('11. successful/current operation authorization works', () => {
    const ta = textarea('hello')
    const session = new FieldSession(ta)
    const operation = beginOp(session, 'hello')
    const auth = createWriteAuthorization({
      operation,
      action: 'english_correction',
      range: { start: 0, end: 5 },
      replacement: 'Hello',
    })
    expect(write(session, ta, auth).verdict).toBe('written')
  })

  it('12. mutex acquisition does not revive stale authorization', () => {
    const ta = textarea('hello')
    const session = new FieldSession(ta)
    const operation = beginOp(session, 'hello')
    const auth = createWriteAuthorization({
      operation,
      action: 'english_correction',
      range: { start: 0, end: 5 },
      replacement: 'Hello',
    })
    session.bumpGeneration()
    const acquired = session.tryAcquireWrite('CORRECT')
    expect(acquired.ok).toBe(true)
    if (!acquired.ok) return
    const result = commitWriteTransaction(ta, 0, 5, 'Hello', {
      session,
      requestId: acquired.requestId,
      expectedGeneration: acquired.generation,
      origin: 'CORRECT',
      capability: 'correction',
      action: 'english_correction',
      authorization: auth,
    })
    session.releaseWrite('CORRECT', acquired.requestId)
    expect(result.verdict).toBe('stale')
    expect(ta.value).toBe('hello')
  })

  it('13. valid Box APPLY reaches WriteGate', () => {
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

  it('14-15. stale Box and Box from old revision cannot write', () => {
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
    expect(['stale', 'missing']).toContain(applyPipelineSuggestion(session.field.id))
    expect(ta.value).toBe('hello')
  })

  it('16. same substring elsewhere cannot authorize the write', () => {
    const ta = textarea('hello hello')
    const session = new FieldSession(ta)
    const operation = beginOp(session, 'hello hello')
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
    ta.value = 'xxxxx hello'
    expect(applyPipelineSuggestion(session.field.id)).toBe('stale')
    expect(ta.value).toBe('xxxxx hello')
  })

  it('17-19. snapshot, range, and rangeText mismatches are rejected', () => {
    const ta = textarea('hello')
    const session = new FieldSession(ta)
    const operation = beginOp(session, 'hello')
    const auth = createWriteAuthorization({
      operation,
      action: 'layout_fix',
      range: { start: 0, end: 5 },
      replacement: 'Hello',
    })
    ta.value = 'hallo'
    expect(write(session, ta, auth).reason).toBe('snapshot_mismatch')
    ta.value = 'hello'
    const acquired = session.tryAcquireWrite('CORRECT')
    expect(acquired.ok).toBe(true)
    if (!acquired.ok) return
    expect(
      commitWriteTransaction(ta, 1, 4, 'Hello', {
        session,
        requestId: acquired.requestId,
        expectedGeneration: acquired.generation,
        origin: 'FIX_LAYOUT',
        capability: 'layout',
        action: 'layout_fix',
        authorization: auth,
      }).reason,
    ).toBe('range_mismatch')
    expect(
      commitWriteTransaction(ta, 0, 5, 'Howdy', {
        session,
        requestId: acquired.requestId,
        expectedGeneration: acquired.generation,
        origin: 'FIX_LAYOUT',
        capability: 'layout',
        action: 'layout_fix',
        authorization: auth,
      }).reason,
    ).toBe('replacement_mismatch')
    session.releaseWrite('CORRECT', acquired.requestId)
    expect(ta.value).toBe('hello')
  })

  it('20. Direct English write requires authorization', () => {
    const ta = textarea('teh')
    const session = new FieldSession(ta)
    const acquired = session.tryAcquireWrite('CORRECT')
    expect(acquired.ok).toBe(true)
    if (!acquired.ok) return
    const denied = commitWriteTransaction(ta, 0, 3, 'the', {
      session,
      requestId: acquired.requestId,
      expectedGeneration: acquired.generation,
      origin: 'CORRECT',
      auto: true,
      capability: 'correction',
      action: 'english_correction',
    })
    expect(denied.reason).toBe('unauthorized')
    expect(ta.value).toBe('teh')
    const operation = beginOp(session, 'teh', 'english')
    const auth = createWriteAuthorization({
      operation,
      action: 'english_correction',
      range: { start: 0, end: 3 },
      replacement: 'the',
    })
    const allowed = commitWriteTransaction(ta, 0, 3, 'the', {
      session,
      requestId: acquired.requestId,
      expectedGeneration: acquired.generation,
      origin: 'CORRECT',
      auto: true,
      capability: 'correction',
      action: 'english_correction',
      authorization: auth,
    })
    session.releaseWrite('CORRECT', acquired.requestId)
    expect(allowed.verdict).toBe('written')
    expect(ta.value).toBe('the')
  })

  it('21. Direct translation write requires authorization', async () => {
    const ta = textarea('مرحبا')
    const session = new FieldSession(ta)
    const operation = beginOp(session, 'مرحبا', 'translate')
    const acquired = session.tryAcquireWrite('TRANSLATE')
    expect(acquired.ok).toBe(true)
    if (!acquired.ok) return
    const denied = commitWriteTransaction(ta, 0, ta.value.length, 'Hello', {
      session,
      requestId: acquired.requestId,
      expectedGeneration: acquired.generation,
      origin: 'TRANSLATE',
      capability: 'translation',
      action: 'translation',
    })
    expect(denied.reason).toBe('unauthorized')
    session.releaseWrite('TRANSLATE', acquired.requestId)

    const result = await executeTranslation({
      element: ta,
      session,
      range: { start: 0, end: ta.value.length },
      sourceText: ta.value,
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
    expect(ta.value).toBe('Hello')
  })

  it('22. Direct layout write requires authorization', () => {
    const ta = textarea('hsjo')
    const session = new FieldSession(ta)
    const operation = beginOp(session, 'hsjo', 'layout')
    const acquired = session.tryAcquireWrite('FIX_LAYOUT')
    expect(acquired.ok).toBe(true)
    if (!acquired.ok) return
    const denied = commitWriteTransaction(ta, 0, 4, 'asdf', {
      session,
      requestId: acquired.requestId,
      expectedGeneration: acquired.generation,
      origin: 'FIX_LAYOUT',
      capability: 'layout',
      action: 'layout_fix',
    })
    expect(denied.reason).toBe('unauthorized')
    const auth = createWriteAuthorization({
      operation,
      action: 'layout_fix',
      range: { start: 0, end: 4 },
      replacement: 'asdf',
    })
    const allowed = commitWriteTransaction(ta, 0, 4, 'asdf', {
      session,
      requestId: acquired.requestId,
      expectedGeneration: acquired.generation,
      origin: 'FIX_LAYOUT',
      capability: 'layout',
      action: 'layout_fix',
      authorization: auth,
    })
    session.releaseWrite('FIX_LAYOUT', acquired.requestId)
    expect(allowed.verdict).toBe('written')
    expect(ta.value).toBe('asdf')
  })

  it('23. SYSTEM commit does not bump FieldRevision', () => {
    const engine = new InputEngine()
    const ta = textarea('hello')
    engine.start()
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    const session = engine.getActiveSession()!
    const before = session.getRevision()
    const operation = beginOp(session, 'hello')
    const auth = createWriteAuthorization({
      operation,
      action: 'english_correction',
      range: { start: 0, end: 5 },
      replacement: 'Hello',
    })
    expect(write(session, ta, auth).verdict).toBe('written')
    expect(session.getRevision()).toBe(before)
    engine.stop()
  })

  it('24. SYSTEM commit does not recursively trigger another automatic write', () => {
    const engine = new InputEngine()
    const ta = textarea('hello')
    engine.start()
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    const session = engine.getActiveSession()!
    let userInputs = 0
    const unsub = engine.eventBus.subscribe((event) => {
      if (event.type === 'input' && event.origin === 'USER') userInputs += 1
    })
    const operation = beginOp(session, 'hello')
    const auth = createWriteAuthorization({
      operation,
      action: 'english_correction',
      range: { start: 0, end: 5 },
      replacement: 'Hello',
    })
    expect(write(session, ta, auth).verdict).toBe('written')
    expect(userInputs).toBe(0)
    unsub()
    engine.stop()
  })

  it('25. write failure releases mutex', () => {
    const ta = textarea('hello')
    const session = new FieldSession(ta)
    const operation = beginOp(session, 'hello')
    const auth = createWriteAuthorization({
      operation,
      action: 'english_correction',
      range: { start: 0, end: 5 },
      replacement: 'Hello',
    })
    session.bumpGeneration()
    const acquired = session.tryAcquireWrite('CORRECT')
    expect(acquired.ok).toBe(true)
    if (!acquired.ok) return
    commitWriteTransaction(ta, 0, 5, 'Hello', {
      session,
      requestId: acquired.requestId,
      expectedGeneration: acquired.generation,
      origin: 'CORRECT',
      capability: 'correction',
      action: 'english_correction',
      authorization: auth,
    })
    session.releaseWrite('CORRECT', acquired.requestId)
    const again = session.tryAcquireWrite('CORRECT')
    expect(again.ok).toBe(true)
    if (again.ok) session.releaseWrite('CORRECT', again.requestId)
  })

  it('26-27. authorization rejection does not leave runtime busy; later valid op can write', () => {
    const ta = textarea('hello')
    const session = new FieldSession(ta)
    const staleOp = beginOp(session, 'hello')
    const staleAuth = createWriteAuthorization({
      operation: staleOp,
      action: 'english_correction',
      range: { start: 0, end: 5 },
      replacement: 'Hello',
    })
    session.bumpGeneration()
    syncDomGeneration(ta, session)
    expect(write(session, ta, staleAuth).verdict).toBe('stale')
    expect(session.getActiveRequest()).toBeNull()
    ta.value = 'hello'
    const fresh = beginOp(session, 'hello')
    const freshAuth = createWriteAuthorization({
      operation: fresh,
      action: 'english_correction',
      range: { start: 0, end: 5 },
      replacement: 'Hello',
    })
    expect(write(session, ta, freshAuth).verdict).toBe('written')
    expect(ta.value).toBe('Hello')
  })

  it('28-29. WriteGate is the only host-field mutation path in production writing runtime', () => {
    const root = join(process.cwd(), 'src')
    const files: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) {
          if (name === 'dashboard' || name === 'popup') continue
          walk(path)
          continue
        }
        if (path.endsWith('.ts') && !path.endsWith('.test.ts')) files.push(path)
      }
    }
    walk(root)
    const writers = files.filter((path) => {
      if (path.endsWith('writeGate/writeGate.ts')) return false
      if (path.endsWith('dom/editor.ts')) return false
      if (path.endsWith('dom/write.ts')) return false
      const src = readFileSync(path, 'utf8')
      return /\bwriteReplacement\s*\(/.test(src) || /\bcommitReplacement\s*\(/.test(src)
    })
    expect(writers).toEqual([])
    const bypass = files.filter((path) => {
      if (path.endsWith('writeGate/writeGate.ts')) return false
      const src = readFileSync(path, 'utf8')
      return /\bcommitWriteTransaction\s*\(/.test(src) && !/\bauthorization\b/.test(src)
    })
    expect(bypass).toEqual([])
  })

  it('30. no second freshness clock on write authorization', () => {
    const ta = textarea('hello')
    const session = new FieldSession(ta)
    const operation = beginOp(session, 'hello')
    const auth = createWriteAuthorization({
      operation,
      action: 'english_correction',
      range: { start: 0, end: 5 },
      replacement: 'Hello',
    })
    expect(auth.revision).toBe(session.getRevision())
    expect(auth.revision).toBe(operation.revision)
    expect(auth).not.toHaveProperty('expiresAt')
    expect(auth).not.toHaveProperty('issuedAt')
    expect(auth).not.toHaveProperty('generationSkew')
  })

  it('missing authorization does not silently become a normal write', () => {
    const ta = textarea('hello')
    const session = new FieldSession(ta)
    const acquired = session.tryAcquireWrite('CORRECT')
    expect(acquired.ok).toBe(true)
    if (!acquired.ok) return
    const result = commitWriteTransaction(ta, 0, 5, 'Hello', {
      session,
      requestId: acquired.requestId,
      expectedGeneration: acquired.generation,
      origin: 'CORRECT',
      capability: 'correction',
    })
    session.releaseWrite('CORRECT', acquired.requestId)
    expect(result).toEqual({ verdict: 'rejected', reason: 'unauthorized' })
    expect(ta.value).toBe('hello')
  })
})
