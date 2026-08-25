import { describe, expect, it } from 'vitest'
import { FieldSession } from '../../extension/src/core/session/FieldSession.ts'

describe('FieldSession', () => {
  it('increments generation', () => {
    const el = document.createElement('textarea')
    const session = new FieldSession(el)
    expect(session.getGeneration()).toBe(0)
    session.bumpGeneration()
    expect(session.getGeneration()).toBe(1)
  })

  it('rejects stale operation when generation changed', () => {
    const el = document.createElement('textarea')
    const session = new FieldSession(el)
    const requestId = session.nextRequestId()
    const capturedGeneration = session.getGeneration()
    session.bumpGeneration()
    expect(session.isStale(capturedGeneration, requestId)).toBe(true)
    expect(session.isStale(session.getGeneration(), requestId)).toBe(false)
  })

  it('tryAcquireWrite enforces mutex', () => {
    const el = document.createElement('textarea')
    const session = new FieldSession(el)
    const first = session.tryAcquireWrite('CORRECT')
    const second = session.tryAcquireWrite('TRANSLATE')
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(false)
    if (first.ok) session.releaseWrite('CORRECT', first.requestId)
  })

  it('invalidates aborted request sequence', () => {
    const el = document.createElement('textarea')
    const session = new FieldSession(el)
    const acquired = session.tryAcquireWrite('CORRECT')
    if (!acquired.ok) throw new Error('acquire failed')
    session.abortActiveRequest()
    expect(session.canCommit(acquired.generation, acquired.requestId).ok).toBe(false)
  })

  it('blocks acquire during composition', () => {
    const el = document.createElement('textarea')
    const session = new FieldSession(el)
    session.setComposing(true)
    expect(session.tryAcquireWrite('CORRECT').ok).toBe(false)
  })

  it('tracks lastWriter on noteWrite', () => {
    const el = document.createElement('textarea')
    const session = new FieldSession(el)
    const acquired = session.tryAcquireWrite('FIX_LAYOUT')
    if (!acquired.ok) throw new Error('acquire failed')
    session.noteWrite('FIX_LAYOUT', acquired.requestId)
    expect(session.getLastWriter()).toBe('FIX_LAYOUT')
  })
})
