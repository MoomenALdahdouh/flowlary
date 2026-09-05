import type { CorrectionResponse } from '@flowlary/shared'
import {
  hashCorrectionContext,
  normalizeCacheText,
  type CacheCoordinator,
  type CorrectRequestContext,
  type TieredCacheCoordinator,
} from '@flowlary/shared'

export function createCorrectionCache(coordinator: CacheCoordinator | TieredCacheCoordinator) {
  return {
    get(text: string, context?: CorrectRequestContext): CorrectionResponse | undefined {
      const key = coordinator.buildKey({
        operation: 'CORRECT',
        text: normalizeCacheText('CORRECT', text),
        contextHash: hashCorrectionContext(context),
      })
      const entry = coordinator.get<CorrectionResponse>(key)
      return entry
    },
    set(text: string, value: CorrectionResponse, context?: CorrectRequestContext): void {
      const key = coordinator.buildKey({
        operation: 'CORRECT',
        text: normalizeCacheText('CORRECT', text),
        contextHash: hashCorrectionContext(context),
      })
      if ('setWithL2' in coordinator) {
        coordinator.setWithL2(key, value, 'CORRECT')
      } else {
        coordinator.set(key, value)
      }
    },
  }
}
