import { describe, expect, it } from 'vitest'
import { buildCacheKey, createMemoryCacheCoordinator } from '../src/cache.ts'

describe('CacheCoordinator', () => {
  it('uses operation-specific keys for CORRECT', () => {
    const key = buildCacheKey({ operation: 'CORRECT', text: 'hello' })
    expect(key.startsWith('CORRECT:')).toBe(true)
    expect(key.endsWith(':0')).toBe(true)
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
  it('isolates TRANSLATE/CORRECT keys by accountId', () => {
    const a = buildCacheKey({
      operation: 'TRANSLATE',
      text: 'hello',
      sourceLanguage: 'en',
      targetLanguage: 'ar',
      translationStrategy: 'google',
      accountId: 'acct_a',
    })
    const b = buildCacheKey({
      operation: 'TRANSLATE',
      text: 'hello',
      sourceLanguage: 'en',
      targetLanguage: 'ar',
      translationStrategy: 'google',
      accountId: 'acct_b',
    })
    expect(a).not.toBe(b)
    expect(a).toContain('acct_a')
    expect(b).toContain('acct_b')

    const ca = buildCacheKey({ operation: 'CORRECT', text: 'hello', accountId: 'acct_a' })
    const cb = buildCacheKey({ operation: 'CORRECT', text: 'hello', accountId: 'acct_b' })
    expect(ca).not.toBe(cb)
  })

  it('isolates Free Google strategy from Pro refined strategy', () => {
    const free = buildCacheKey({
      operation: 'TRANSLATE',
      text: 'hello',
      sourceLanguage: 'en',
      targetLanguage: 'ar',
      translationStrategy: 'google',
      accountId: 'acct_a',
    })
    const pro = buildCacheKey({
      operation: 'TRANSLATE',
      text: 'hello',
      sourceLanguage: 'en',
      targetLanguage: 'ar',
      translationStrategy: 'google_then_groq',
      accountId: 'acct_a',
    })
    expect(free).not.toBe(pro)
  })

})
