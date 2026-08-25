import type { CacheCoordinator } from '@flowlary/shared'

const TTL_MS = 60_000

export function createTranslationCache(coordinator: CacheCoordinator) {
  return {
    get(sourceLanguage: string, targetLanguage: string, text: string): string | undefined {
      const key = coordinator.buildKey({
        operation: 'TRANSLATE',
        text,
        sourceLanguage,
        targetLanguage,
      })
      return coordinator.get<string>(key)
    },

    set(sourceLanguage: string, targetLanguage: string, text: string, translation: string): void {
      const key = coordinator.buildKey({
        operation: 'TRANSLATE',
        text,
        sourceLanguage,
        targetLanguage,
      })
      coordinator.set(key, translation, TTL_MS)
    },
  }
}
