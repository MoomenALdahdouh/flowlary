import { normalizeCacheText, predictClientTranslationStrategy } from '@flowlary/shared'
import type { CacheCoordinator, TranslationRouteStrategy } from '@flowlary/shared'

export function createTranslationCache(coordinator: CacheCoordinator) {
  return {
    get(
      sourceLanguage: string,
      targetLanguage: string,
      text: string,
      translationStrategy: TranslationRouteStrategy = 'google',
    ): string | undefined {
      const key = coordinator.buildKey({
        operation: 'TRANSLATE',
        text: normalizeCacheText('TRANSLATE', text),
        sourceLanguage,
        targetLanguage,
        translationStrategy,
      })
      return coordinator.get<string>(key)
    },

    set(
      sourceLanguage: string,
      targetLanguage: string,
      text: string,
      translation: string,
      translationStrategy: TranslationRouteStrategy = 'google',
    ): void {
      const key = coordinator.buildKey({
        operation: 'TRANSLATE',
        text: normalizeCacheText('TRANSLATE', text),
        sourceLanguage,
        targetLanguage,
        translationStrategy,
      })
      if ('setWithL2' in coordinator) {
        ;(coordinator as {
          setWithL2: (key: string, value: string, operation: 'TRANSLATE') => void
        }).setWithL2(key, translation, 'TRANSLATE')
      } else {
        coordinator.set(key, translation)
      }
    },
  }
}

export { predictClientTranslationStrategy }
