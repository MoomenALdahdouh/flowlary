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
import type { MessageCatalog, UiLocale } from './types.ts'

type Params = Record<string, string | number>

export const messageCatalogs: Record<UiLocale, MessageCatalog> = {
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

function lookup(path: string, catalog: MessageCatalog): string | undefined {
  const parts = path.split('.')
  let node: unknown = catalog
  for (const part of parts) {
    if (typeof node !== 'object' || node === null || !(part in node)) return undefined
    node = (node as Record<string, unknown>)[part]
  }
  return typeof node === 'string' ? node : undefined
}

function formatMessage(template: string, params?: Params): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    key in params ? String(params[key]) : `{${key}}`,
  )
}

export function resolveMessage(path: string, locale: UiLocale = 'en', params?: Params): string {
  const primary = lookup(path, messageCatalogs[locale])
  if (primary) return formatMessage(primary, params)
  const fallback = lookup(path, en)
  if (fallback) return formatMessage(fallback, params)
  if (import.meta.env?.DEV) {
    console.warn(`[i18n] missing key: ${path}`)
  }
  return path
}
