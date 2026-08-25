import type { CacheCoordinator, TieredCacheCoordinator } from '@flowlary/shared'
import type { UserLayoutProfile } from '../layouts/types.ts'
import { relevantContext } from './key.ts'
import { decideHotPath, toCacheRecord, type CacheRecord, WORD_CACHE_TTL_MS } from './records.ts'

export type LayoutCache = {
  flowKeyFor(
    word: string,
    profile: UserLayoutProfile,
    sourceLayout: string,
    context?: string,
  ): string
  getFlowKey(
    word: string,
    profile: UserLayoutProfile,
    sourceLayout: string,
    context?: string,
  ): string
  get(key: string): CacheRecord | undefined
  getWithL2(
    word: string,
    profile: UserLayoutProfile,
    sourceLayout: string,
    context?: string,
  ): Promise<CacheRecord | undefined>
  set(
    word: string,
    profile: UserLayoutProfile,
    sourceLayout: string,
    record: CacheRecord,
    context?: string,
  ): void
  decide(key: string): ReturnType<typeof decideHotPath>
  buildFlowlaryKey(word: string, profile: UserLayoutProfile, sourceLayout: string, context?: string): string
}

export function createLayoutCache(coordinator: CacheCoordinator | TieredCacheCoordinator): LayoutCache {
  const memory = new Map<string, CacheRecord>()

  function buildFlowlaryKey(
    word: string,
    profile: UserLayoutProfile,
    sourceLayout: string,
    context?: string,
  ): string {
    return coordinator.buildKey({
      operation: 'FIX_LAYOUT',
      text: word,
      layoutSource: sourceLayout,
      layoutCandidates: [...profile.enabledLayouts],
      layoutContext: relevantContext(word, context),
    })
  }

  function flowKeyFor(
    word: string,
    profile: UserLayoutProfile,
    sourceLayout: string,
    context?: string,
  ): string {
    return buildFlowlaryKey(word, profile, sourceLayout, context)
  }

  return {
    flowKeyFor,
    getFlowKey: flowKeyFor,
    buildFlowlaryKey,

    get(key) {
      const local = memory.get(key)
      if (local) return local
      return coordinator.get<CacheRecord>(key)
    },

    async getWithL2(word, profile, sourceLayout, context) {
      const key = flowKeyFor(word, profile, sourceLayout, context)
      const local = memory.get(key)
      if (local) return local
      const sync = coordinator.get<CacheRecord>(key)
      if (sync) {
        memory.set(key, sync)
        return sync
      }
      if ('getWithL2' in coordinator) {
        const persisted = await coordinator.getWithL2<CacheRecord>(key)
        if (persisted) memory.set(key, persisted)
        return persisted
      }
      return undefined
    },

    set(word, profile, sourceLayout, record, context) {
      const key = flowKeyFor(word, profile, sourceLayout, context)
      memory.set(key, record)
      if ('setWithL2' in coordinator) {
        coordinator.setWithL2(key, record, 'FIX_LAYOUT', WORD_CACHE_TTL_MS)
      } else {
        coordinator.set(key, record, WORD_CACHE_TTL_MS)
      }
    },

    decide(key) {
      return decideHotPath((k) => this.get(k), key)
    },
  }
}

export { toCacheRecord, decideHotPath }
export type { CacheRecord }
