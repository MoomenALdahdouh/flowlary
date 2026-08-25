import { describe, expect, it } from 'vitest'
import { createMemoryCacheCoordinator } from '@flowlary/shared'
import { createLayoutCache, toCacheRecord } from '../../../extension/src/features/layout/cache/LayoutCache.ts'
import { classificationCacheKey } from '../../../extension/src/features/layout/cache/key.ts'

describe('layout cache', () => {
  it('reuses classification for the same candidate', () => {
    const coordinator = createMemoryCacheCoordinator()
    const cache = createLayoutCache(coordinator)
    const profile = { sourceLayout: 'en-US-qwerty' as const, enabledLayouts: ['en-US-qwerty', 'ar-101'] as const }
    const key = cache.keyFor('hsjo]lj', profile, 'en-US-qwerty')
    cache.set(key, toCacheRecord({ kind: 'LAYOUT_MISMATCH', targetLayout: 'ar-101' }, { corrected: 'مرحبا' }))
    expect(cache.decide(key).kind).toBe('correct')
  })

  it('does not collide across layout pairs', () => {
    const a = classificationCacheKey('test', 'en-US-qwerty', ['ar-101'])
    const b = classificationCacheKey('test', 'ar-101', ['en-US-qwerty'])
    expect(a).not.toBe(b)
  })

  it('uses Flowlary FIX_LAYOUT cache namespace', () => {
    const coordinator = createMemoryCacheCoordinator()
    const cache = createLayoutCache(coordinator)
    const profile = { sourceLayout: 'en-US-qwerty' as const, enabledLayouts: ['en-US-qwerty', 'ar-101'] as const }
    const flowKey = cache.buildFlowlaryKey('hsjo]lj', profile, 'en-US-qwerty')
    expect(flowKey.startsWith('FIX_LAYOUT:')).toBe(true)
  })
})
