import { createHash } from 'node:crypto'
import type { TranslationRouteStrategy } from '@flowlary/shared'

export type TranslationCacheEntry = {
  translation: string
  model: string
  strategy: TranslationRouteStrategy
  provider: 'google' | 'groq' | 'google_then_groq'
  createdAt: number
}

const store = new Map<string, TranslationCacheEntry>()
const MAX_ENTRIES = 500
const TTL_MS = 60 * 60_000

export function buildTranslationCacheKey(input: {
  accountId: string | null
  text: string
  sourceLanguage: string
  targetLanguage: string
  strategy: TranslationRouteStrategy
}): string {
  const hash = createHash('sha256').update(input.text.normalize('NFC')).digest('hex').slice(0, 24)
  const account = input.accountId ?? 'anon'
  return `${account}|${input.strategy}|${input.sourceLanguage}|${input.targetLanguage}|${hash}`
}

export function getTranslationCache(key: string): TranslationCacheEntry | undefined {
  const entry = store.get(key)
  if (!entry) return undefined
  if (Date.now() - entry.createdAt > TTL_MS) {
    store.delete(key)
    return undefined
  }
  return entry
}

export function setTranslationCache(
  key: string,
  entry: Omit<TranslationCacheEntry, 'createdAt'>,
): void {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value
    if (oldest) store.delete(oldest)
  }
  store.set(key, { ...entry, createdAt: Date.now() })
}

export function clearTranslationCacheForTests(): void {
  store.clear()
}
