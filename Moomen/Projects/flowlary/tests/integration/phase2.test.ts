import { describe, expect, it, beforeEach } from 'vitest'
import { FieldSession } from '../../extension/src/core/session/FieldSession.ts'
import {
  createSnapshot,
  readText,
  writeReplacement,
  verifySnapshot,
} from '../../extension/src/core/dom/editor.ts'
import { bumpUserGeneration, syncDomGeneration } from '../../extension/src/core/dom/generation.ts'
import { InputEngine } from '../../extension/src/core/input/InputEngine.ts'
import { evaluateFieldSafety } from '../../extension/src/core/safety/index.ts'

describe('Phase 2 integration', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('TEST 1 — rejects stale AI result when generation advances', () => {
    const ta = document.createElement('textarea')
    ta.value = 'hello'
    document.body.append(ta)
    const session = new FieldSession(ta)
    syncDomGeneration(ta, session)

    const acquired = session.tryAcquireWrite('CORRECT')
    expect(acquired.ok).toBe(true)
    if (!acquired.ok) return

    bumpUserGeneration(ta, session)
    const result = writeReplacement(ta, 0, 5, 'world', {
      session,
      requestId: acquired.requestId,
      expectedGeneration: acquired.generation,
      origin: 'CORRECT',
    })
    expect(result.verdict).toBe('stale')
  })

  it('TEST 2 — allows only one write mutex holder', () => {
    const ta = document.createElement('textarea')
    document.body.append(ta)
    const session = new FieldSession(ta)

    const t1 = session.tryAcquireWrite('TRANSLATE')
    const l1 = session.tryAcquireWrite('FIX_LAYOUT')
    const c1 = session.tryAcquireWrite('CORRECT')

    expect(t1.ok).toBe(true)
    expect(l1.ok).toBe(false)
    expect(c1.ok).toBe(false)
    if (t1.ok) session.releaseWrite('TRANSLATE', t1.requestId)
  })

  it('TEST 3 — does not commit after abort', () => {
    const ta = document.createElement('textarea')
    ta.value = 'hello'
    document.body.append(ta)
    const session = new FieldSession(ta)
    syncDomGeneration(ta, session)

    const acquired = session.tryAcquireWrite('CORRECT')
    if (!acquired.ok) throw new Error('expected acquire')
    session.abortActiveRequest()

    const result = writeReplacement(ta, 0, 5, 'world', {
      session,
      requestId: acquired.requestId,
      expectedGeneration: acquired.generation,
      origin: 'CORRECT',
    })
    expect(['stale', 'rejected']).toContain(result.verdict)
    expect(readText(ta)).toBe('hello')
  })

  it('TEST 4 — does not bump generation on programmatic input event', () => {
    const engine = new InputEngine()
    const ta = document.createElement('textarea')
    ta.value = 'hello'
    document.body.append(ta)
    engine.start()

    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    ta.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
    const afterUser = engine.getActiveSession()?.getGeneration() ?? 0

    writeReplacement(ta, 0, 5, 'world', { origin: 'CORRECT' })
    ta.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText' }),
    )
    const afterProgrammatic = engine.getActiveSession()?.getGeneration() ?? 0
    expect(afterProgrammatic).toBe(afterUser)
  })

  it('TEST 5 — blocks commit during composition', () => {
    const ta = document.createElement('textarea')
    ta.value = 'hello'
    document.body.append(ta)
    const session = new FieldSession(ta)
    session.setComposing(true)

    expect(session.tryAcquireWrite('CORRECT').ok).toBe(false)

    session.setComposing(false)
    expect(session.tryAcquireWrite('CORRECT').ok).toBe(true)
  })

  it('TEST 6 — allows prose and blocks password, token, and code regions', () => {
    const prose = document.createElement('textarea')
    document.body.append(prose)
    expect(evaluateFieldSafety(prose).allowed).toBe(true)

    const password = document.createElement('input')
    password.type = 'password'
    document.body.append(password)
    expect(evaluateFieldSafety(password).allowed).toBe(false)

    expect(
      evaluateFieldSafety(prose, {
        token: 'sk-abcdefghijklmnopqrstuvwxyz123456',
      }).allowed,
    ).toBe(false)

    const code = document.createElement('div')
    code.className = 'monaco-editor'
    document.body.append(code)
    expect(evaluateFieldSafety(code).allowed).toBe(false)
  })

  it('TEST 7 — replaces nested contenteditable selection preserving text', () => {
    const edit = document.createElement('div')
    edit.contentEditable = 'true'
    edit.innerHTML = 'Hello <b>world</b>!'
    document.body.append(edit)

    const result = writeReplacement(edit, 6, 11, 'universe', { origin: 'TRANSLATE' })
    expect(result.verdict).toBe('written')
    expect(readText(edit)).toBe('Hello universe!')
  })

  it('TEST 8 — detects stale snapshot after external DOM modification', () => {
    const ta = document.createElement('textarea')
    ta.value = 'hello'
    document.body.append(ta)
    const session = new FieldSession(ta)
    syncDomGeneration(ta, session)
    const snap = createSnapshot(ta, session.getGeneration())
    ta.value = 'changed'
    expect(verifySnapshot(snap)).toBe('text-mismatch')
    const acquired = session.tryAcquireWrite('CORRECT')
    if (!acquired.ok) throw new Error('acquire failed')
    const result = writeReplacement(ta, 0, 5, 'world', {
      session,
      requestId: acquired.requestId,
      expectedGeneration: snap.generation,
      baselineSnapshot: snap,
      origin: 'CORRECT',
    })
    expect(result.verdict).toBe('stale')
    expect(readText(ta)).toBe('changed')
  })
})
