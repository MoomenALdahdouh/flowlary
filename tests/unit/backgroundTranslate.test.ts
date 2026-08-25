import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { handleTranslateText, resetTranslateHandlerForTests } from '../../extension/src/background/translate.ts'
import { createMockChromeStorage } from '../helpers/mockChromeStorage.ts'
import { seedFlowlaryInstallAuth } from '../helpers/mockFlowlaryAuth.ts'
import { resetFlowlaryCacheForTests } from '../../extension/src/storage/cache/index.ts'

describe('background translate', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    const mock = createMockChromeStorage()
    seedFlowlaryInstallAuth(mock)
    mock.install()
    resetFlowlaryCacheForTests()
    resetTranslateHandlerForTests()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ ok: true, translation: 'Hello' }),
      })),
    )
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.unstubAllGlobals()
    resetFlowlaryCacheForTests()
  })

  it('transports translation request to backend', async () => {
    const result = await handleTranslateText({
      type: 'TRANSLATE_TEXT',
      text: 'مرحبا',
      sourceLanguage: 'ar',
      targetLanguage: 'en',
      mode: 'shortcut',
    })
    expect(result.type).toBe('TRANSLATE_TEXT_RESULT')
    if (result.type === 'TRANSLATE_TEXT_RESULT') {
      expect(result.translation).toBe('Hello')
    }
    expect(fetch).toHaveBeenCalled()
  })

  it('rejects empty text locally', async () => {
    const result = await handleTranslateText({
      type: 'TRANSLATE_TEXT',
      text: '   ',
      sourceLanguage: 'ar',
      targetLanguage: 'en',
      mode: 'shortcut',
    })
    expect(result).toEqual({ type: 'TRANSLATE_TEXT_ERROR', ok: false, code: 'empty' })
    expect(fetch).not.toHaveBeenCalled()
  })
})
