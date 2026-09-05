import { deepMerge } from './merge.ts'
import { en } from './en.ts'
import type { MessageCatalog, MessageOverrides } from './types.ts'

export function buildExtensionLocale(overrides: MessageOverrides): MessageCatalog {
  return deepMerge(en as unknown as MessageCatalog, overrides)
}
