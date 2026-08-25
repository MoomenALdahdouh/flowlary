import { normalizeCacheText } from '@flowlary/shared'
import type { CacheCoordinator } from '@flowlary/shared'

export function createTranslationCache(coordinator: CacheCoordinator) {
  return {
    get(sourceLanguage: string, targetLanguage: string, text: string): string | undefined {
      const key = coordinator.buildKey({
        operation: 'TRANSLATE',
        text: normalizeCacheText('TRANSLATE', text),
        sourceLanguage,
        targetLanguage,
      })
      return coordinator.get<string>(key)
    },

    set(sourceLanguage: string, targetLanguage: string, text: string, translation: string): void {
      const key = coordinator.buildKey({
        operation: 'TRANSLATE',
        text: normalizeCacheText('TRANSLATE', text),
        sourceLanguage,
        targetLanguage,
      })
      if ('setWithL2' in coordinator) {
        coordinator.setWithL2(key, translation, 'TRANSLATE')
      } else {
        coordinator.set(key, translation)
      }
    },
  }
}
