import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import {
  isUiLocaleCode,
  uiLocaleDirection,
  uiLocaleHtmlLang,
  UI_LOCALE_CODES,
  type UiLocaleCode,
} from '@flowlary/shared'
import { DEFAULT_LOCALE, ENABLED_LOCALES, type Locale } from '../config.ts'
import { canStorePreferences } from '../cookies/consent.ts'
import { ar } from './ar.ts'
import { de } from './de.ts'
import { el } from './el.ts'
import { en, type Messages } from './en.ts'
import { es } from './es.ts'
import { fa } from './fa.ts'
import { fr } from './fr.ts'
import { it } from './it.ts'
import { pt } from './pt.ts'
import { ru } from './ru.ts'
import { tr } from './tr.ts'
import { uk } from './uk.ts'

export const LOCALE_STORAGE_KEY = 'flowlary-locale'

const catalogs: Record<Locale, Messages> = {
  en,
  ar,
  ru,
  de,
  fr,
  tr,
  el,
  es,
  it,
  pt,
  uk,
  fa,
}

type I18nValue = {
  locale: Locale
  messages: Messages
  direction: 'ltr' | 'rtl'
  enabledLocales: readonly Locale[]
  setLocale: (locale: Locale) => void
}

function isLocale(value: string | null | undefined): value is Locale {
  return isUiLocaleCode(value)
}

export function isLocaleEnabled(locale: Locale): boolean {
  return ENABLED_LOCALES.includes(locale) && catalogs[locale].meta.complete
}

export function applyDocumentLocale(locale: Locale): void {
  if (typeof document === 'undefined') return
  const messages = catalogs[locale]
  const direction = messages.meta.direction === 'rtl' ? 'rtl' : 'ltr'
  document.documentElement.lang = uiLocaleHtmlLang(locale)
  document.documentElement.dir = direction
}

export function readStoredLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE
  try {
    const params = new URLSearchParams(window.location.search)
    const fromQuery = params.get('lang')
    if (isLocale(fromQuery) && isLocaleEnabled(fromQuery)) return fromQuery
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY)
    if (isLocale(stored) && isLocaleEnabled(stored)) return stored
  } catch {
    /* ignore */
  }
  return DEFAULT_LOCALE
}

function persistLocale(locale: Locale): void {
  try {
    if (!canStorePreferences()) return
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    /* ignore */
  }
}

const I18nContext = createContext<I18nValue>({
  locale: DEFAULT_LOCALE,
  messages: en,
  direction: 'ltr',
  enabledLocales: ENABLED_LOCALES,
  setLocale: () => undefined,
})

export function I18nProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
}: {
  children: ReactNode
  initialLocale?: Locale
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)

  useLayoutEffect(() => {
    if (initialLocale !== DEFAULT_LOCALE) {
      setLocaleState(initialLocale)
      applyDocumentLocale(initialLocale)
      return
    }
    const next = readStoredLocale()
    setLocaleState(next)
    applyDocumentLocale(next)
  }, [initialLocale])

  useLayoutEffect(() => {
    applyDocumentLocale(locale)
  }, [locale])

  const setLocale = useCallback((next: Locale) => {
    if (!isLocaleEnabled(next)) return
    setLocaleState(next)
    persistLocale(next)
    applyDocumentLocale(next)
  }, [])

  const value = useMemo<I18nValue>(() => {
    const messages = catalogs[locale]
    return {
      locale,
      messages,
      direction: messages.meta.direction === 'rtl' ? 'rtl' : 'ltr',
      enabledLocales: ENABLED_LOCALES,
      setLocale,
    }
  }, [locale, setLocale])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  return useContext(I18nContext)
}

export function useMessages(): Messages {
  return useI18n().messages
}

export { catalogs, UI_LOCALE_CODES }
