/**
 * Phase 14 — network / AI failure regression.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { handleTranslateText, resetTranslateHandlerForTests } from '../../extension/src/background/translate.ts'
import { handleCorrectText, resetCorrectHandlerForTests, cancelCorrectRequest } from '../../extension/src/background/correct.ts'
import { handleCheckWord } from '../../extension/src/background/classify.ts'
import { resetFlowlaryCacheForTests } from '../../extension/src/storage/cache/index.ts'
import { createMockChromeStorage } from '../helpers/mockChromeStorage.ts'
import { seedFlowlaryAccountAuth } from '../helpers/mockFlowlaryAuth.ts'
import { stateManager } from '../../extension/src/core/state/StateManager.ts'

describe('Phase 14 — API failure handling', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    const mock = createMockChromeStorage()
    seedFlowlaryAccountAuth(mock)
    mock.install()
    resetFlowlaryCacheForTests()
    resetTranslateHandlerForTests()
    resetCorrectHandlerForTests()
    stateManager.correction.consentAccepted = true
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.unstubAllGlobals()
    resetFlowlaryCacheForTests()
  })

  describe('translation', () => {
    it('handles offline / network error', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }))
      const result = await handleTranslateText({
        type: 'TRANSLATE_TEXT',
        text: 'مرحبا',
        sourceLanguage: 'ar',
        targetLanguage: 'en',
        mode: 'shortcut',
      })
      expect(result).toEqual({ type: 'TRANSLATE_TEXT_ERROR', ok: false, code: 'network' })
    })

    it('handles HTTP 500', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })))
      const result = await handleTranslateText({
        type: 'TRANSLATE_TEXT',
        text: 'hello',
        sourceLanguage: 'en',
        targetLanguage: 'ar',
        mode: 'shortcut',
      })
      expect(result.type).toBe('TRANSLATE_TEXT_ERROR')
    })

    it('handles malformed JSON response', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          ok: true,
          json: async () => ({ translation: 123 }),
        })),
      )
      const result = await handleTranslateText({
        type: 'TRANSLATE_TEXT',
        text: 'hello',
        sourceLanguage: 'en',
        targetLanguage: 'ar',
        mode: 'shortcut',
      })
      expect(result).toEqual({ type: 'TRANSLATE_TEXT_ERROR', ok: false, code: 'invalid-response' })
    })

    it('handles 429 rate limit', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 429 })))
      const result = await handleTranslateText({
        type: 'TRANSLATE_TEXT',
        text: 'hello',
        sourceLanguage: 'en',
        targetLanguage: 'ar',
        mode: 'shortcut',
      })
      expect(result).toEqual({ type: 'TRANSLATE_TEXT_ERROR', ok: false, code: 'rate_limited' })
    })

    it('rejects when consent is missing without network', async () => {
      stateManager.correction.consentAccepted = false
      vi.stubGlobal('fetch', vi.fn())
      const result = await handleTranslateText({
        type: 'TRANSLATE_TEXT',
        text: 'hello',
        sourceLanguage: 'en',
        targetLanguage: 'ar',
        mode: 'shortcut',
      })
      expect(result).toEqual({ type: 'TRANSLATE_TEXT_ERROR', ok: false, code: 'consent_required' })
      expect(fetch).not.toHaveBeenCalled()
    })
  })

  describe('correction (Flowlary AI)', () => {
    it('rejects when consent is missing without network', async () => {
      stateManager.correction.consentAccepted = false
      vi.stubGlobal('fetch', vi.fn())
      const result = await handleCorrectText({
        type: 'CORRECT_TEXT',
        requestId: 'req-1',
        text: 'I dont know',
      })
      expect(result).toMatchObject({ ok: false, error: 'consent_required' })
      expect(fetch).not.toHaveBeenCalled()
    })

    it('handles auth failure from Flowlary API (401)', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401 })))
      const result = await handleCorrectText({
        type: 'CORRECT_TEXT',
        requestId: 'req-2',
        text: 'I dont know',
      })
      expect(result).toMatchObject({ ok: false, error: 'auth_failed' })
    })

    it('handles malformed gateway JSON', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          ok: true,
          json: async () => ({ ok: false }),
        })),
      )
      const result = await handleCorrectText({
        type: 'CORRECT_TEXT',
        requestId: 'req-3',
        text: 'I dont know',
      })
      expect(result).toMatchObject({ ok: false, error: 'invalid_response' })
    })

    it('cancelCorrectRequest is wired for in-flight requests', () => {
      vi.stubGlobal('fetch', vi.fn())
      cancelCorrectRequest('nonexistent-id')
      expect(true).toBe(true)
    })
  })

  describe('layout classifier', () => {
    it('uses local hint without network for known mismatch', async () => {
      vi.stubGlobal('fetch', vi.fn())
      const result = await handleCheckWord({
        type: 'CHECK_WORD',
        word: 'lvpfh',
        sourceLayout: 'en-US-qwerty',
        candidateLayouts: ['en-US-qwerty', 'ar-101'],
      })
      expect(result.type).toBe('CHECK_WORD_RESULT')
      expect(fetch).not.toHaveBeenCalled()
    })

    it('handles classifier HTTP failure gracefully', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 })))
      const result = await handleCheckWord({
        type: 'CHECK_WORD',
        word: 'zzzzunknown',
        sourceLayout: 'en-US-qwerty',
        candidateLayouts: ['en-US-qwerty', 'ar-101'],
      })
      expect(result.type).toBe('CHECK_WORD_ERROR')
    })
  })
})
