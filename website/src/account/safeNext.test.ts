import { describe, expect, it } from 'vitest'
import { parseSafeNext, resolvePostAuthDestination } from './safeNext.ts'

describe('safeNext redirect handling', () => {
  it('allows only trusted internal destinations', () => {
    expect(parseSafeNext('lab')).toBe('lab')
    expect(parseSafeNext('checkout')).toBe('checkout')
    expect(parseSafeNext('https://evil.example')).toBeNull()
    expect(parseSafeNext('/account')).toBeNull()
    expect(parseSafeNext(null)).toBeNull()
  })

  it('maps lab to the writing lab route and defaults to dashboard', () => {
    expect(resolvePostAuthDestination('lab')).toBe('/lab')
    expect(resolvePostAuthDestination(null)).toBe('/dashboard')
  })
})
