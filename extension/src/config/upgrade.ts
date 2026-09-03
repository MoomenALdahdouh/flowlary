import { FLOWLARY_SITE_URL } from './endpoints.ts'

/** Canonical pricing destination for all Upgrade to Pro CTAs. */
export function getUpgradeUrl(): string {
  return `${FLOWLARY_SITE_URL}/pricing`
}

/** Canonical account / billing destination. */
export function getAccountUrl(): string {
  return `${FLOWLARY_SITE_URL}/account`
}

/** Website-primary auth — session syncs into the extension via the content bridge. */
export function openWebsiteAccount(mode: 'login' | 'register' = 'login'): void {
  const url =
    mode === 'register' ? `${getAccountUrl()}?mode=register` : getAccountUrl()
  if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
    void chrome.tabs.create({ url })
    return
  }
  window.open(url, '_blank', 'noopener')
}

/** Signed-in → extension account panel; signed-out → website auth (canonical). */
export function openAccountSurface(options: {
  signedIn: boolean
  openExtensionAccount?: () => void
  mode?: 'login' | 'register'
}): void {
  if (options.signedIn && options.openExtensionAccount) {
    options.openExtensionAccount()
    return
  }
  openWebsiteAccount(options.mode ?? 'login')
}

export function openUpgradePage(): void {
  const url = getUpgradeUrl()
  if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
    void chrome.tabs.create({ url })
    return
  }
  window.open(url, '_blank', 'noopener')
}

/** @deprecated Prefer openWebsiteAccount — same behavior. */
export function openAccountPage(): void {
  openWebsiteAccount('login')
}
