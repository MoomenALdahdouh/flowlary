import { FLOWLARY_SITE_URL } from './endpoints.ts'

/** Canonical pricing destination for all Upgrade to Pro CTAs. */
export function getUpgradeUrl(): string {
  return `${FLOWLARY_SITE_URL}/pricing`
}

/** Canonical account / billing destination. */
export function getAccountUrl(): string {
  return `${FLOWLARY_SITE_URL}/account`
}

export function openUpgradePage(): void {
  const url = getUpgradeUrl()
  if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
    void chrome.tabs.create({ url })
    return
  }
  window.open(url, '_blank', 'noopener')
}

export function openAccountPage(): void {
  const url = getAccountUrl()
  if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
    void chrome.tabs.create({ url })
    return
  }
  window.open(url, '_blank', 'noopener')
}
