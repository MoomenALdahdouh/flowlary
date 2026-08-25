import { describe, expect, it } from 'vitest'
import { applyCorrectionEvent, revertCount } from '../../../extension/src/features/layout/profile/trust.ts'
import { isExceptedToken, addException } from '../../../extension/src/features/layout/profile/exceptions.ts'
import { REVERT_EXCEPTION_THRESHOLD } from '../../../extension/src/features/layout/profile/types.ts'

describe('layout profile trust', () => {
  it('ignored correction adds personal exception', () => {
    const result = applyCorrectionEvent([], [], 'ignored', 'lvpfh')
    expect(isExceptedToken('lvpfh', result.exceptions)).toBe(true)
    expect(result.addedException).toBe(true)
  })

  it('revert threshold adds exception', () => {
    let events = applyCorrectionEvent([], [], 'reverted', 'lvpfh').events
    events = applyCorrectionEvent(events, [], 'reverted', 'lvpfh').events
    expect(revertCount(events, 'lvpfh')).toBe(REVERT_EXCEPTION_THRESHOLD)
    const final = applyCorrectionEvent(events, addException([], 'x'), 'reverted', 'lvpfh')
    expect(isExceptedToken('lvpfh', final.exceptions)).toBe(true)
  })

  it('accepted correction does not add exception', () => {
    const result = applyCorrectionEvent([], [], 'accepted', 'lvpfh', 'مرحبا')
    expect(result.exceptions).toEqual([])
  })
})
