import { describe, expect, it } from 'vitest'
import { evaluateFieldSafety, probeElement } from '../../extension/src/core/safety/index.ts'

describe('Safety', () => {
  it('blocks password fields', () => {
    const input = document.createElement('input')
    input.type = 'password'
    document.body.append(input)
    const decision = evaluateFieldSafety(input)
    expect(decision.allowed).toBe(false)
    expect(decision.reason).toBe('password-field')
  })

  it('blocks OTP-like fields', () => {
    const input = document.createElement('input')
    input.type = 'text'
    input.autocomplete = 'one-time-code'
    input.inputMode = 'numeric'
    input.maxLength = 6
    document.body.append(input)
    const probe = probeElement(input)
    const decision = evaluateFieldSafety(input)
    expect(decision.allowed).toBe(false)
    expect(probe.autocomplete).toContain('one-time-code')
    expect(decision.reason).toBe('otp-field')
  })

  it('allows normal text fields', () => {
    const input = document.createElement('input')
    input.type = 'text'
    document.body.append(input)
    const decision = evaluateFieldSafety(input)
    expect(decision.allowed).toBe(true)
  })
})
