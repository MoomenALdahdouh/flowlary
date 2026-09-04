import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { acceptWebAiConsent, clearWebAiConsent, readWebAiConsent } from './consent.ts'
import { acceptAllCookies } from '../cookies/consent.ts'

describe('website AI consent isolation', () => {
  afterEach(() => {
    localStorage.clear()
  })

  beforeEach(() => {
    acceptAllCookies()
  })

  it('does not share consent between accounts', () => {
    acceptWebAiConsent('account-a')
    expect(readWebAiConsent('account-a')).toBe(true)
    expect(readWebAiConsent('account-b')).toBe(false)
    expect(readWebAiConsent(null)).toBe(false)
  })

  it('claims legacy unscoped consent once for the first account', () => {
    localStorage.setItem('flowlary.web.ai.consent', '1')
    expect(readWebAiConsent('account-a')).toBe(true)
    expect(localStorage.getItem('flowlary.web.ai.consent')).toBeNull()
    expect(readWebAiConsent('account-b')).toBe(false)
  })

  it('clearing one account leaves the other intact', () => {
    acceptWebAiConsent('account-a')
    acceptWebAiConsent('account-b')
    clearWebAiConsent('account-a')
    expect(readWebAiConsent('account-a')).toBe(false)
    expect(readWebAiConsent('account-b')).toBe(true)
  })
})
