import {
  ENABLED_UI_LOCALES,
  isUiLocaleCode,
  uiLocaleDirection,
  type UiLocaleCode,
} from '@flowlary/shared'
import type { en } from './en.ts'

export type MessageCatalog = typeof en
export type UiLocale = UiLocaleCode

export const UI_LOCALE_OPTIONS = ENABLED_UI_LOCALES

export function localeDirection(locale: UiLocale): 'ltr' | 'rtl' {
  return uiLocaleDirection(locale)
}

export { isUiLocaleCode }
