import { afterEach, describe, expect, it } from 'vitest'
import {
  COOKIE_CONSENT_KEY,
  acceptAllCookies,
  canStorePreferences,
  canStoreProduct,
  hasCookieDecision,
  readCookieConsent,
  rejectOptionalCookies,
  saveCookieSettings,
} from './consent.ts'

afterEach(() => {
  localStorage.clear()
})

describe('website cookie consent', () => {
  it('has no decision until the user chooses', () => {
    expect(hasCookieDecision()).toBe(false)
    expect(canStorePreferences()).toBe(false)
    expect(canStoreProduct()).toBe(false)
  })

  it('accepts language, colors, and learning storage', () => {
    const record = acceptAllCookies()
    expect(record.preferences).toBe(true)
    expect(record.product).toBe(true)
    expect(record.analytics).toBe(false)
    expect(record.marketing).toBe(false)
    expect(canStorePreferences()).toBe(true)
    expect(canStoreProduct()).toBe(true)
    expect(localStorage.getItem(COOKIE_CONSENT_KEY)).toContain('"version":1')
  })

  it('reject keeps only needed storage and clears optional keys', () => {
    localStorage.setItem('flowlary-theme', 'dark')
    localStorage.setItem('flowlary-locale', 'ar')
    localStorage.setItem('flowlary.web.session', '{"sessionId":"s1"}')
    localStorage.setItem('flowlary.web.account.acc-1.learning.events', '{}')
    localStorage.setItem('flowlary.web.account.acc-1.ai.consent', '1')

    rejectOptionalCookies()

    expect(canStorePreferences()).toBe(false)
    expect(canStoreProduct()).toBe(false)
    expect(localStorage.getItem('flowlary-theme')).toBeNull()
    expect(localStorage.getItem('flowlary-locale')).toBeNull()
    expect(localStorage.getItem('flowlary.web.account.acc-1.learning.events')).toBeNull()
    expect(localStorage.getItem('flowlary.web.account.acc-1.ai.consent')).toBeNull()
    expect(localStorage.getItem('flowlary.web.session')).toContain('s1')
    expect(readCookieConsent()?.preferences).toBe(false)
  })

  it('settings can keep colors and drop learning storage', () => {
    localStorage.setItem('flowlary-theme', 'light')
    localStorage.setItem('flowlary.web.account.acc-1.learning.profile', '{}')
    saveCookieSettings({ preferences: true, product: false })
    expect(canStorePreferences()).toBe(true)
    expect(canStoreProduct()).toBe(false)
    expect(localStorage.getItem('flowlary-theme')).toBe('light')
    expect(localStorage.getItem('flowlary.web.account.acc-1.learning.profile')).toBeNull()
  })
})
