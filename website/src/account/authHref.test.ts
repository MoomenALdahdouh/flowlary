import { describe, expect, it } from 'vitest'
import { accountAuthHref } from './authHref.ts'

describe('accountAuthHref', () => {
  it('keeps register in the URL and preserves next', () => {
    const search = new URLSearchParams('mode=register&next=feedback')
    expect(accountAuthHref('register', search)).toBe('/account?next=feedback&mode=register')
    expect(accountAuthHref('login', search)).toBe('/account?next=feedback')
  })

  it('drops unrelated query keys', () => {
    const search = new URLSearchParams('mode=register&utm=x')
    expect(accountAuthHref('register', search)).toBe('/account?mode=register')
    expect(accountAuthHref('login', search)).toBe('/account')
  })
})
