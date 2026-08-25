import { describe, expect, it } from 'vitest'
import { FieldSession } from '../../extension/src/core/session/FieldSession.ts'

describe('FieldSession', () => {
  it('increments generation', () => {
    const el = document.createElement('textarea')
    const session = new FieldSession(el)
    expect(session.getGeneration()).toBe(0)
    session.bumpGeneration()
    expect(session.getGeneration()).toBe(1)
    session.bumpGeneration()
    expect(session.getGeneration()).toBe(2)
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

  it('tracks active operation lifecycle', () => {
    const el = document.createElement('textarea')
    const session = new FieldSession(el)
    const controller = session.beginOperation('CORRECT')
    expect(controller).toBeInstanceOf(AbortController)
    session.completeOperation('CORRECT')
    expect(session.getLastWriter()).toBe('CORRECT')
  })
})
