import {
  coerceEnabledUiLocale,
  isUiLocaleCode,
  uiLocaleDirection,
  uiLocaleHtmlLang,
} from '@flowlary/shared'
import { STORAGE_KEYS } from '@flowlary/shared'
import type { UiLocale } from './types.ts'

const DEFAULT_LOCALE: UiLocale = 'en'
let cachedLocale: UiLocale = DEFAULT_LOCALE

export { isUiLocaleCode as isUiLocale }

export function peekUiLocale(): UiLocale {
  if (typeof document !== 'undefined') {
    const lang = document.documentElement.lang
    if (isUiLocaleCode(lang)) return coerceEnabledUiLocale(lang)
  }
  return cachedLocale
}

export async function readUiLocale(): Promise<UiLocale> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    cachedLocale = DEFAULT_LOCALE
    return DEFAULT_LOCALE
  }
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.uiLocale)
    const raw = result[STORAGE_KEYS.uiLocale]
    if (typeof raw === 'object' && raw !== null && 'value' in raw) {
      const value = (raw as { value: unknown }).value
      if (isUiLocaleCode(value)) {
        cachedLocale = coerceEnabledUiLocale(value)
        return cachedLocale
      }
    }
    if (isUiLocaleCode(raw)) {
      cachedLocale = coerceEnabledUiLocale(raw)
      return cachedLocale
    }
  } catch {
    /* ignore */
  }
  cachedLocale = DEFAULT_LOCALE
  return DEFAULT_LOCALE
}

export async function writeUiLocale(locale: UiLocale): Promise<void> {
  cachedLocale = locale
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return
  await chrome.storage.local.set({ [STORAGE_KEYS.uiLocale]: { value: locale, _v: 1 } })
}

export function applyDocumentLocale(locale: UiLocale): void {
  cachedLocale = locale
  if (typeof document === 'undefined') return
  document.documentElement.lang = uiLocaleHtmlLang(locale)
  document.documentElement.dir = uiLocaleDirection(locale)
}

export { DEFAULT_LOCALE }
