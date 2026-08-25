import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildCacheKey,
  CACHE_SCHEMA_VERSION,
  CACHE_TTL_MS,
  createCacheMetrics,
  createMemoryCacheCoordinator,
  hashCorrectionContext,
  MAX_CACHE_ENTRIES,
  normalizeCacheText,
} from '@flowlary/shared'
import { FlowlaryStorage } from '../../extension/src/storage/index.ts'
import {
  drainFlowlaryCache,
  getFlowlaryCache,
  getCacheMetrics,
  initializeFlowlaryCache,
  resetFlowlaryCacheForTests,
} from '../../extension/src/storage/cache/index.ts'
import { canCacheText } from '../../extension/src/storage/cache/privacy.ts'
import { normalizePersistentCacheStore } from '../../extension/src/storage/cache/persistentStore.ts'
import { createMockChromeStorage } from '../helpers/mockChromeStorage.ts'
import { handleTranslateText, resetTranslateHandlerForTests } from '../../extension/src/background/translate.ts'
import { handleCorrectText, resetCorrectHandlerForTests } from '../../extension/src/background/correct.ts'

describe('Phase 12 — cache core', () => {
  beforeEach(() => {
    resetFlowlaryCacheForTests()
  })

  it('L1 cache hit and miss', () => {
    const cache = createMemoryCacheCoordinator()
    const key = cache.buildKey({ operation: 'TRANSLATE', text: 'hello', sourceLanguage: 'ar', targetLanguage: 'en' })
    expect(cache.get(key)).toBeUndefined()
    cache.set(key, 'مرحبا')
    expect(cache.get(key)).toBe('مرحبا')
  })

  it('L2 cache hit promotes into L1', async () => {
    const mockStore = createMockChromeStorage()
    mockStore.install()
    const storage = new FlowlaryStorage()
    const cache = getFlowlaryCache(storage)
    const key = cache.buildKey({ operation: 'TRANSLATE', text: 'hello', sourceLanguage: 'ar', targetLanguage: 'en' })
    cache.setWithL2(key, 'Hello', 'TRANSLATE')
    await drainFlowlaryCache(storage)
    resetFlowlaryCacheForTests()
    const fresh = getFlowlaryCache(storage)
    const value = await fresh.getWithL2<string>(key)
    expect(value).toBe('Hello')
    expect(fresh.get(key)).toBe('Hello')
  })

  it('expires stale entries', async () => {
    const mockStore = createMockChromeStorage()
    mockStore.install()
    const storage = new FlowlaryStorage()
    const cache = getFlowlaryCache(storage)
    const key = cache.buildKey({ operation: 'CORRECT', text: 'hello world test phrase' })
    cache.setWithL2(key, { originalText: 'x', correctedText: 'y', changes: [] }, 'CORRECT', 1)
    await drainFlowlaryCache(storage)
    await new Promise((resolve) => setTimeout(resolve, 5))
    expect(await cache.getWithL2(key)).toBeUndefined()
  })

  it('ignores invalid schema versions', () => {
    const store = normalizePersistentCacheStore({ version: 99, entries: [{ key: 'bad' }] })
    expect(store.entries).toHaveLength(0)
    expect(store.version).toBe(CACHE_SCHEMA_VERSION)
  })

  it('evicts oldest entries beyond MAX_CACHE_ENTRIES', async () => {
    const mockStore = createMockChromeStorage()
    mockStore.install()
    const storage = new FlowlaryStorage()
    const cache = getFlowlaryCache(storage)
    for (let index = 0; index < MAX_CACHE_ENTRIES + 3; index += 1) {
      const marker = String.fromCodePoint(0x5000 + index)
      const key = cache.buildKey({ operation: 'TRANSLATE', text: `phrase ${marker}`, sourceLanguage: 'ar', targetLanguage: 'en' })
      cache.setWithL2(key, `value-${index}`, 'TRANSLATE')
    }
    await drainFlowlaryCache(storage)
    const raw = await storage.get(storage.keys.cache, 'local')
    const normalized = normalizePersistentCacheStore(raw)
    expect(normalized.entries.length).toBeLessThanOrEqual(MAX_CACHE_ENTRIES)
  })

  it('keeps operations isolated', () => {
    const cache = createMemoryCacheCoordinator()
    const text = 'shared'
    const correct = cache.buildKey({ operation: 'CORRECT', text })
    const translate = cache.buildKey({ operation: 'TRANSLATE', text, sourceLanguage: 'ar', targetLanguage: 'en' })
    cache.set(correct, { originalText: text, correctedText: 'Shared', changes: [] })
    expect(cache.get(translate)).toBeUndefined()
  })

  it('keeps translation languages isolated', () => {
    const keyA = buildCacheKey({ operation: 'TRANSLATE', text: 'hello', sourceLanguage: 'ar', targetLanguage: 'en' })
    const keyB = buildCacheKey({ operation: 'TRANSLATE', text: 'hello', sourceLanguage: 'ar', targetLanguage: 'tr' })
    expect(keyA).not.toBe(keyB)
  })

  it('uses deterministic correction context hashing', () => {
    const a = buildCacheKey({
      operation: 'CORRECT',
      text: 'hello',
      contextHash: hashCorrectionContext({ previousText: 'prev', fieldType: 'textarea' }),
    })
    const b = buildCacheKey({
      operation: 'CORRECT',
      text: 'hello',
      contextHash: hashCorrectionContext({ previousText: 'other', fieldType: 'textarea' }),
    })
    expect(a).not.toBe(b)
  })

  it('normalizes correction whitespace only', () => {
    expect(normalizeCacheText('CORRECT', 'hello   world')).toBe('hello world')
    expect(normalizeCacheText('TRANSLATE', 'hello   world')).toBe('hello   world')
  })

  it('handles concurrent cache writes', async () => {
    const mockStore = createMockChromeStorage()
    mockStore.install()
    const storage = new FlowlaryStorage()
    const cache = getFlowlaryCache(storage)
    await Promise.all([
      cache.setWithL2(
        cache.buildKey({ operation: 'TRANSLATE', text: 'one', sourceLanguage: 'ar', targetLanguage: 'en' }),
        'one',
        'TRANSLATE',
      ),
      cache.setWithL2(
        cache.buildKey({ operation: 'TRANSLATE', text: 'two', sourceLanguage: 'ar', targetLanguage: 'en' }),
        'two',
        'TRANSLATE',
      ),
      cache.setWithL2(
        cache.buildKey({ operation: 'TRANSLATE', text: 'three', sourceLanguage: 'ar', targetLanguage: 'en' }),
        'three',
        'TRANSLATE',
      ),
    ])
    await drainFlowlaryCache(storage)
    const one = await cache.getWithL2<string>(
      cache.buildKey({ operation: 'TRANSLATE', text: 'one', sourceLanguage: 'ar', targetLanguage: 'en' }),
    )
    const two = await cache.getWithL2<string>(
      cache.buildKey({ operation: 'TRANSLATE', text: 'two', sourceLanguage: 'ar', targetLanguage: 'en' }),
    )
    expect(one).toBe('one')
    expect(two).toBe('two')
  })
})

describe('Phase 12 — cache privacy', () => {
  it('blocks sensitive values from cache', () => {
    expect(canCacheText('gsk_123456789012345678901234567890')).toBe(false)
    expect(canCacheText('4111111111111111')).toBe(false)
    expect(canCacheText('hello world')).toBe(true)
  })
})

describe('Phase 12 — request coalescing', () => {
  beforeEach(() => {
    resetFlowlaryCacheForTests()
    resetTranslateHandlerForTests()
    resetCorrectHandlerForTests()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('coalesces identical translation requests', async () => {
    const mockStore = createMockChromeStorage()
    mockStore.install()
    let resolveFetch!: (value: Response) => void
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve
    })
    vi.stubGlobal('fetch', vi.fn(() => fetchPromise))

    const request = {
      type: 'TRANSLATE_TEXT' as const,
      text: 'مرحبا',
      sourceLanguage: 'ar' as const,
      targetLanguage: 'en' as const,
      mode: 'manual' as const,
    }

    const pending = Promise.all([handleTranslateText(request), handleTranslateText(request)])
    resolveFetch({
      ok: true,
      json: async () => ({ translation: 'Hello' }),
    } as Response)
    const [a, b] = await pending
    expect(a.ok).toBe(true)
    expect(b.ok).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})

describe('Phase 12 — TTL constants', () => {
  it('uses operation-specific TTL defaults', () => {
    expect(CACHE_TTL_MS.CORRECT).toBeLessThan(CACHE_TTL_MS.TRANSLATE)
    expect(CACHE_TTL_MS.FIX_LAYOUT).toBeGreaterThan(CACHE_TTL_MS.TRANSLATE)
  })
})

describe('Phase 12 — initialize', () => {
  it('initializes persistent cache without throwing', async () => {
    const mockStore = createMockChromeStorage()
    mockStore.install()
    await expect(initializeFlowlaryCache(new FlowlaryStorage())).resolves.toBeUndefined()
  })
})

describe('Phase 12 — correction handler cache', () => {
  beforeEach(() => {
    resetFlowlaryCacheForTests()
    resetCorrectHandlerForTests()
    const mockStore = createMockChromeStorage()
    mockStore.install()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns cached correction without second Groq call', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  originalText: 'hello world test phrase',
                  correctedText: 'Hello world test phrase',
                  changes: [],
                }),
              },
            },
          ],
        }),
      } as Response),
    )

    const message = {
      type: 'CORRECT_TEXT' as const,
      requestId: '1',
      text: 'hello world test phrase',
      groqApiKey: 'gsk_test_key_1234567890',
    }
    const first = await handleCorrectText(message)
    const second = await handleCorrectText({ ...message, requestId: '2' })
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(getCacheMetrics().ai_requests_avoided).toBeGreaterThan(0)
  })
})
