import { describe, expect, it } from 'vitest'
import { buildCacheKey, createMemoryCacheCoordinator } from '../src/cache.ts'

describe('CacheCoordinator', () => {
  it('uses operation-specific keys for CORRECT', () => {
    const key = buildCacheKey({ operation: 'CORRECT', text: 'hello' })
    expect(key.startsWith('CORRECT:')).toBe(true)
  })

  it('uses operation-specific keys for TRANSLATE', () => {
    const key = buildCacheKey({
      operation: 'TRANSLATE',
      text: 'hello',
      sourceLanguage: 'ar',
      targetLanguage: 'en',
    })
    expect(key.startsWith('TRANSLATE:')).toBe(true)
    expect(key).toContain(':ar:en')
  })

  it('uses operation-specific keys for FIX_LAYOUT', () => {
    const key = buildCacheKey({
      operation: 'FIX_LAYOUT',
      text: 'token',
      layoutSource: 'en-US-qwerty',
      layoutCandidates: ['ar-101'],
    })
    expect(key.startsWith('FIX_LAYOUT:')).toBe(true)
  })

  it('does not cross-satisfy operations', () => {
    const cache = createMemoryCacheCoordinator()
    const text = 'same text'
    const correctKey = cache.buildKey({ operation: 'CORRECT', text })
    const translateKey = cache.buildKey({
      operation: 'TRANSLATE',
      text,
      sourceLanguage: 'ar',
      targetLanguage: 'en',
    })
    cache.set(correctKey, { corrected: 'fixed' })
    expect(cache.get(translateKey)).toBeUndefined()
    expect(cache.get(correctKey)).toEqual({ corrected: 'fixed' })
  })

  it('clears by operation prefix', () => {
    const cache = createMemoryCacheCoordinator()
    cache.set(cache.buildKey({ operation: 'CORRECT', text: 'a' }), 'a')
    cache.set(cache.buildKey({ operation: 'TRANSLATE', text: 'b', sourceLanguage: 'ar', targetLanguage: 'en' }), 'b')
    cache.clear('CORRECT')
    expect(cache.has(cache.buildKey({ operation: 'CORRECT', text: 'a' }))).toBe(false)
    expect(cache.has(cache.buildKey({ operation: 'TRANSLATE', text: 'b', sourceLanguage: 'ar', targetLanguage: 'en' }))).toBe(true)
  })
})
