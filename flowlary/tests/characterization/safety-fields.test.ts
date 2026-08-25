/** Adapted from Lingo/Layfix src/safety/fields.test.ts */
import { describe, expect, it, beforeEach } from 'vitest'
import { isValueEditable } from '../../extension/src/core/dom/read.ts'
import { probeElement, skipReasonForField } from '../../extension/src/core/safety/fields.ts'

function input(attrs: Record<string, string>): HTMLInputElement {
  const el = document.createElement('input')
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'type') el.type = value
    else el.setAttribute(key, value)
  }
  document.body.append(el)
  return el
}

describe('characterization: protected fields', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('protects password, OTP, payment, email, URL, username', () => {
    expect(skipReasonForField(probeElement(input({ type: 'password' })))).toBe('password-field')
    expect(
      skipReasonForField(probeElement(input({ type: 'text', autocomplete: 'one-time-code' }))),
    ).toBe('otp-field')
    expect(skipReasonForField(probeElement(input({ id: 'cvv', name: 'cvc' })))).toBe('payment-field')
    expect(skipReasonForField(probeElement(input({ type: 'email' })))).toBe('email-field')
    expect(skipReasonForField(probeElement(input({ type: 'url' })))).toBe('url-field')
    expect(
      skipReasonForField(probeElement(input({ type: 'text', autocomplete: 'username' }))),
    ).toBe('username-field')
    expect(skipReasonForField(probeElement(input({ type: 'text', name: 'cc-number' })))).toBe(
      'payment-field',
    )
    expect(skipReasonForField(probeElement(input({ type: 'text', name: 'comment' })))).toBeNull()
  })

  it('does not treat sensitive inputs as value-editable', () => {
    expect(isValueEditable(input({ type: 'text' }))).toBe(true)
    expect(isValueEditable(input({ type: 'password' }))).toBe(false)
    expect(isValueEditable(input({ type: 'email' }))).toBe(false)
    expect(isValueEditable(input({ type: 'url' }))).toBe(false)
    expect(isValueEditable(input({ type: 'file' }))).toBe(false)
    expect(isValueEditable(input({ type: 'hidden' }))).toBe(false)
  })
})
