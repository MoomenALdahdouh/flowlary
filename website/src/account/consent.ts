import { canStoreProduct } from '../cookies/consent.ts'

const WEB_CONSENT_KEY = 'flowlary.web.ai.consent'

function scopedKey(accountId: string): string {
  return `flowlary.web.account.${accountId}.ai.consent`
}

function readLegacyConsent(): boolean {
  if (typeof localStorage === 'undefined') return false
  try {
    return localStorage.getItem(WEB_CONSENT_KEY) === '1'
  } catch {
    return false
  }
}

function claimLegacyConsent(accountId: string): boolean {
  if (!readLegacyConsent()) return false
  try {
    localStorage.setItem(scopedKey(accountId), '1')
    localStorage.removeItem(WEB_CONSENT_KEY)
  } catch {
    /* ignore */
  }
  return true
}

export function readWebAiConsent(accountId?: string | null): boolean {
  if (typeof localStorage === 'undefined') return false
  if (!accountId) return false
  try {
    const scoped = localStorage.getItem(scopedKey(accountId))
    if (scoped === '1') return true
    if (scoped === '0') return false
    return claimLegacyConsent(accountId)
  } catch {
    return false
  }
}

export function acceptWebAiConsent(accountId: string): void {
  if (!canStoreProduct()) return
  localStorage.setItem(scopedKey(accountId), '1')
  try {
    localStorage.removeItem(WEB_CONSENT_KEY)
  } catch {
    /* ignore */
  }
}

export function clearWebAiConsent(accountId?: string): void {
  try {
    if (accountId) localStorage.removeItem(scopedKey(accountId))
    else localStorage.removeItem(WEB_CONSENT_KEY)
  } catch {
    /* ignore */
  }
}
