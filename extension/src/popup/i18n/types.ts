import {
  ENABLED_UI_LOCALES,
  isUiLocaleCode,
  uiLocaleDirection,
  type UiLocaleCode,
} from '@flowlary/shared'
import type { en } from './en.ts'

type CatalogNode<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? readonly CatalogNode<U>[]
    : T extends object
      ? { readonly [K in keyof T]: CatalogNode<T[K]> }
      : T

/** English `as const` catalog with string values so locales can translate copy. */
export type MessageCatalog = CatalogNode<typeof en>

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends readonly unknown[]
    ? T[K]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K]
}

export type MessageOverrides = DeepPartial<MessageCatalog>
export type UiLocale = UiLocaleCode

export const UI_LOCALE_OPTIONS = ENABLED_UI_LOCALES

export function localeDirection(locale: UiLocale): 'ltr' | 'rtl' {
  return uiLocaleDirection(locale)
}

export { isUiLocaleCode }
