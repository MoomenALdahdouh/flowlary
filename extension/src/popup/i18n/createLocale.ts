import { deepMerge } from './merge.ts'
import { en } from './en.ts'
import type { MessageCatalog } from './types.ts'

export function buildExtensionLocale(overrides: Partial<MessageCatalog>): MessageCatalog {
  return deepMerge(en, overrides as MessageCatalog)
}
