import {
  isEnabledUiLocaleCode,
  isUiLocaleCode,
  UI_LOCALES,
  uiLocaleDirection,
  uiLocaleHtmlLang,
  type UiLocaleCode,
} from '@flowlary/shared'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ar } from './ar.ts'
import { de } from './de.ts'
import { el } from './el.ts'
import { en } from './en.ts'
import { es } from './es.ts'
import { fa } from './fa.ts'
import { fr } from './fr.ts'
import { it } from './it.ts'
import { pt } from './pt.ts'
import { ru } from './ru.ts'
import { tr } from './tr.ts'
import { uk } from './uk.ts'
import { applyDocumentLocale, readUiLocale, writeUiLocale } from './localeStorage.ts'
import { messageCatalogs, resolveMessage } from './resolveMessage.ts'
import type { MessageCatalog, UiLocale } from './types.ts'

type Params = Record<string, string | number>

type I18nContextValue = {
  locale: UiLocale
  direction: 'ltr' | 'rtl'
  messages: MessageCatalog
  setLocale: (locale: UiLocale) => void
  t: (path: string, params?: Params) => string
}

let moduleLocale: UiLocale = 'en'
let moduleCatalog: MessageCatalog = messageCatalogs.en

const catalogs = messageCatalogs

export function t(path: string, params?: Params): string {
  return resolveMessage(path, moduleLocale, params)
}

export { resolveMessage } from './resolveMessage.ts'

function setModuleLocale(locale: UiLocale): void {
  moduleLocale = locale
  moduleCatalog = catalogs[locale]
}

const I18nContext = createContext<I18nContextValue>({
  locale: 'en',
  direction: 'ltr',
  messages: en,
  setLocale: () => undefined,
  t,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<UiLocale>('en')

  useEffect(() => {
    let active = true
    void readUiLocale().then((stored) => {
      if (!active) return
      setModuleLocale(stored)
      setLocaleState(stored)
      applyDocumentLocale(stored)
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    applyDocumentLocale(locale)
    setModuleLocale(locale)
  }, [locale])

  const setLocale = useCallback((next: UiLocale) => {
    if (!isEnabledUiLocaleCode(next)) return
    setLocaleState(next)
    void writeUiLocale(next)
  }, [])

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      direction: uiLocaleDirection(locale),
      messages: catalogs[locale],
      setLocale,
      t: (path, params) => resolveMessage(path, locale, params),
    }),
    [locale, setLocale],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext)
}

/** Test-only hook to switch module locale without React tree. */
export function setLocaleForTests(locale: UiLocale): void {
  setModuleLocale(locale)
}

export { en, ar, ru, de, fr, tr, el, es, it, pt, uk, fa, moduleCatalog as messages, UI_LOCALES, isUiLocaleCode }
export type { UiLocaleCode }
