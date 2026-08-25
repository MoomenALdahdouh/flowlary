import type { CacheCoordinator } from '@flowlary/shared'
import type { UserLayoutProfile } from '../layouts/types.ts'
import { classificationCacheKey } from './key.ts'
import { decideHotPath, toCacheRecord, type CacheRecord, WORD_CACHE_TTL_MS } from './records.ts'

export type LayoutCache = {
  keyFor(word: string, profile: UserLayoutProfile, sourceLayout: string, context?: string): string
  get(key: string): CacheRecord | undefined
  set(key: string, record: CacheRecord): void
  decide(key: string): ReturnType<typeof decideHotPath>
  buildFlowlaryKey(word: string, profile: UserLayoutProfile, sourceLayout: string): string
}

export function createLayoutCache(coordinator: CacheCoordinator): LayoutCache {
  const memory = new Map<string, CacheRecord>()

  return {
    keyFor(word, profile, sourceLayout, context) {
      return classificationCacheKey(word, sourceLayout, profile.enabledLayouts, context)
    },

    buildFlowlaryKey(word, profile, sourceLayout) {
      return coordinator.buildKey({
        operation: 'FIX_LAYOUT',
        text: word,
        layoutSource: sourceLayout,
        layoutCandidates: [...profile.enabledLayouts],
      })
    },

    get(key) {
      const local = memory.get(key)
      if (local) return local
      return coordinator.get<CacheRecord>(key)
    },

    set(key, record) {
      memory.set(key, record)
      coordinator.set(key, record, WORD_CACHE_TTL_MS)
    },

    decide(key) {
      return decideHotPath((k) => this.get(k), key)
    },
  }
}

export { toCacheRecord, decideHotPath, classificationCacheKey }
export type { CacheRecord }
