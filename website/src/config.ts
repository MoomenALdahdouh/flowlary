/**
 * Public website configuration.
 *
 * Production website: https://flowlary.com
 * Production API:     https://api.flowlary.com
 *
 * The marketing site calls the Flowlary AI gateway for the Writing Lab (signed-in).
 * Chrome Web Store URL is null until a real listing exists.
 */

export const SITE_URL = 'https://flowlary.com'
export const SITE_NAME = 'Flowlary'
export const API_URL = 'https://api.flowlary.com'

/**
 * Same-origin Vite proxy prefix. Avoids mixed content when the site is served
 * over HTTPS (Herd `flowlary.test`) while the local API is HTTP.
 */
export const DEV_API_PROXY_PATH = '/__flowlary-api'

/**
 * Public website → API origin. Production always uses the canonical host.
 * Local development uses the same-origin proxy (never a raw HTTP API URL in
 * the browser). Production builds ignore VITE_FLOWLARY_API_URL unless it is
 * the canonical https://api.flowlary.com origin.
 */
export function resolvePublicApiUrl(): string {
  if (import.meta.env.DEV) return DEV_API_PROXY_PATH
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('.test')) {
    return DEV_API_PROXY_PATH
  }
  const override = import.meta.env.VITE_FLOWLARY_API_URL?.trim()
  if (override?.startsWith('https://api.flowlary.com')) return override.replace(/\/$/, '')
  return API_URL
}

/** Set only when a real Chrome Web Store listing is published. */
export const CHROME_WEB_STORE_URL: string | null = null

import { UI_LOCALE_CODES, type UiLocaleCode } from '@flowlary/shared'

export const DEFAULT_LOCALE = 'en' as const satisfies UiLocaleCode
export const SUPPORTED_LOCALES = UI_LOCALE_CODES
export type Locale = UiLocaleCode

/** Public website UI — Arabic and English only. */
export const ENABLED_LOCALES: readonly Locale[] = ['en', 'ar']

export const TRANSLATION_LANGUAGES = ['English', 'Arabic'] as const

export const KEYBOARD_LAYOUTS = [
  { id: 'en-US-qwerty', name: 'English (US QWERTY)' },
  { id: 'ar-101', name: 'Arabic 101' },
] as const

export const SHORTCUTS = {
  fixWriting: { mac: '⌘⇧E', other: 'Ctrl+Shift+E' },
  translate: { mac: '⌘⇧,', other: 'Ctrl+Shift+,' },
  fixLayout: { mac: '⌘⇧P', other: 'Ctrl+Shift+P' },
  speedBox: { mac: '⌘⇧L', other: 'Ctrl+Shift+L' },
} as const
