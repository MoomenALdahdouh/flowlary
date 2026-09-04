import {
  coerceEnabledUiLocale,
  isUiLocaleCode,
  uiLocaleDirection,
  uiLocaleHtmlLang,
} from '@flowlary/shared'
import { STORAGE_KEYS } from '@flowlary/shared'
import type { UiLocale } from './types.ts'

const DEFAULT_LOCALE: UiLocale = 'en'

export { isUiLocaleCode as isUiLocale }

export async function readUiLocale(): Promise<UiLocale> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return DEFAULT_LOCALE
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.uiLocale)
    const raw = result[STORAGE_KEYS.uiLocale]
    if (typeof raw === 'object' && raw !== null && 'value' in raw) {
      const value = (raw as { value: unknown }).value
      if (isUiLocaleCode(value)) return coerceEnabledUiLocale(value)
    }
    if (isUiLocaleCode(raw)) return coerceEnabledUiLocale(raw)
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE
}

export async function writeUiLocale(locale: UiLocale): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return
  await chrome.storage.local.set({ [STORAGE_KEYS.uiLocale]: { value: locale, _v: 1 } })
}

export function applyDocumentLocale(locale: UiLocale): void {
  if (typeof document === 'undefined') return
  document.documentElement.lang = uiLocaleHtmlLang(locale)
  document.documentElement.dir = uiLocaleDirection(locale)
}

export { DEFAULT_LOCALE }
