export const COOKIE_CONSENT_KEY = 'flowlary-cookie-consent'
export const COOKIE_CONSENT_VERSION = 1
export const OPEN_COOKIE_SETTINGS_EVENT = 'flowlary-open-cookie-settings'
export const COOKIE_CONSENT_CHANGE_EVENT = 'flowlary-cookie-consent-change'

export type OptionalCookieCategory = 'preferences' | 'product'

export type CookieConsentRecord = {
  version: number
  decidedAt: number
  preferences: boolean
  product: boolean
  analytics: false
  marketing: false
}

export type CookieCategoryChoice = {
  preferences: boolean
  product: boolean
}

const PRODUCT_KEY_PREFIX = 'flowlary.web.account.'

function emitConsentChange(record: CookieConsentRecord): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_CHANGE_EVENT, { detail: record }))
}

function parseRecord(raw: string | null): CookieConsentRecord | null {
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<CookieConsentRecord>
    if (value.version !== COOKIE_CONSENT_VERSION) return null
    if (typeof value.decidedAt !== 'number') return null
    if (typeof value.preferences !== 'boolean' || typeof value.product !== 'boolean') return null
    return {
      version: COOKIE_CONSENT_VERSION,
      decidedAt: value.decidedAt,
      preferences: value.preferences,
      product: value.product,
      analytics: false,
      marketing: false,
    }
  } catch {
    return null
  }
}

export function readCookieConsent(): CookieConsentRecord | null {
  if (typeof localStorage === 'undefined') return null
  try {
    return parseRecord(localStorage.getItem(COOKIE_CONSENT_KEY))
  } catch {
    return null
  }
}

export function hasCookieDecision(): boolean {
  return readCookieConsent() !== null
}

export function canStorePreferences(): boolean {
  return readCookieConsent()?.preferences === true
}

export function canStoreProduct(): boolean {
  return readCookieConsent()?.product === true
}

function removeKeys(predicate: (key: string) => boolean): void {
  if (typeof localStorage === 'undefined') return
  const keys: string[] = []
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)
    if (key && predicate(key)) keys.push(key)
  }
  for (const key of keys) localStorage.removeItem(key)
}

export function clearPreferenceStorage(): void {
  try {
    localStorage.removeItem('flowlary-theme')
    localStorage.removeItem('flowlary-locale')
  } catch {
    /* ignore */
  }
}

export function clearProductStorage(): void {
  try {
    removeKeys((key) => key.startsWith(PRODUCT_KEY_PREFIX))
  } catch {
    /* ignore */
  }
}

export function applyCookieCategoryStorage(choice: CookieCategoryChoice): void {
  if (!choice.preferences) clearPreferenceStorage()
  if (!choice.product) clearProductStorage()
}

function writeConsent(choice: CookieCategoryChoice): CookieConsentRecord {
  const record: CookieConsentRecord = {
    version: COOKIE_CONSENT_VERSION,
    decidedAt: Date.now(),
    preferences: choice.preferences,
    product: choice.product,
    analytics: false,
    marketing: false,
  }
  localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(record))
  applyCookieCategoryStorage(choice)
  emitConsentChange(record)
  return record
}

export function acceptAllCookies(): CookieConsentRecord {
  return writeConsent({ preferences: true, product: true })
}

export function rejectOptionalCookies(): CookieConsentRecord {
  return writeConsent({ preferences: false, product: false })
}

export function saveCookieSettings(choice: CookieCategoryChoice): CookieConsentRecord {
  return writeConsent({
    preferences: choice.preferences,
    product: choice.product,
  })
}

export function openCookieSettings(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT))
}
