import { uiLocaleDirection, uiLocaleMeta, type UiLocaleCode } from '@flowlary/shared'
import { deepMerge } from './merge.ts'
import { en, type Messages } from './en.ts'

export function buildLocaleCatalog(code: UiLocaleCode, overrides: Partial<Messages>): Messages {
  const meta = uiLocaleMeta(code)
  return deepMerge(deepMerge(en, {
    meta: {
      locale: code,
      direction: uiLocaleDirection(code),
      complete: true,
      label: meta.nativeLabel,
    },
  } as Partial<Messages>), overrides as Messages)
}

export const localeNames: Messages['locale'] = {
  en: 'English',
  ar: 'العربية',
  ru: 'Русский',
  de: 'Deutsch',
  fr: 'Français',
  tr: 'Türkçe',
  el: 'Ελληνικά',
  es: 'Español',
  it: 'Italiano',
  pt: 'Português',
  uk: 'Українська',
  fa: 'فارسی',
  allSupported: 'Flowlary supports the same languages as its keyboard layouts.',
}
