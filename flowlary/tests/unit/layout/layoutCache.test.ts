import { describe, expect, it } from 'vitest'
import { createMemoryCacheCoordinator } from '@flowlary/shared'
import { createLayoutCache, toCacheRecord } from '../../../extension/src/features/layout/cache/LayoutCache.ts'

describe('layout cache', () => {
  it('reuses classification for the same candidate', () => {
    const coordinator = createMemoryCacheCoordinator()
    const cache = createLayoutCache(coordinator)
    const profile = { sourceLayout: 'en-US-qwerty' as const, enabledLayouts: ['en-US-qwerty', 'ar-101'] as const }
    cache.set(
      'hsjo]lj',
      profile,
      'en-US-qwerty',
      toCacheRecord({ kind: 'LAYOUT_MISMATCH', targetLayout: 'ar-101' }, { corrected: 'مرحبا' }),
    )
    const key = cache.flowKeyFor('hsjo]lj', profile, 'en-US-qwerty')
    expect(cache.decide(key).kind).toBe('correct')
  })

  it('does not collide across layout pairs', () => {
    const coordinator = createMemoryCacheCoordinator()
    const cache = createLayoutCache(coordinator)
    const profileA = { sourceLayout: 'en-US-qwerty' as const, enabledLayouts: ['en-US-qwerty', 'ar-101'] as const }
    const profileB = { sourceLayout: 'ar-101' as const, enabledLayouts: ['en-US-qwerty', 'ar-101'] as const }
    const a = cache.flowKeyFor('test', profileA, 'en-US-qwerty')
    const b = cache.flowKeyFor('test', profileB, 'ar-101')
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
