import { describe, expect, it } from 'vitest'
import { parseSafeNext, resolvePostAuthDestination } from './safeNext.ts'

describe('safeNext redirect handling', () => {
  it('allows only trusted internal destinations', () => {
    expect(parseSafeNext('lab')).toBe('lab')
    expect(parseSafeNext('checkout')).toBe('checkout')
    expect(parseSafeNext('feedback')).toBe('feedback')
    expect(parseSafeNext('feedback-features')).toBe('feedback-features')
    expect(parseSafeNext('feedback-support')).toBe('feedback-support')
    expect(parseSafeNext('https://evil.example')).toBeNull()
    expect(parseSafeNext('/account')).toBeNull()
    expect(parseSafeNext(null)).toBeNull()
  })

  it('maps lab to the writing lab route and defaults to dashboard', () => {
    expect(resolvePostAuthDestination('lab')).toBe('/dashboard#lab')
    expect(resolvePostAuthDestination('feedback')).toBe('/feedback')
    expect(resolvePostAuthDestination('feedback-features')).toBe('/feedback?tab=features')
    expect(resolvePostAuthDestination('feedback-support')).toBe('/feedback?tab=support')
    expect(resolvePostAuthDestination(null)).toBe('/dashboard')
  })
})
