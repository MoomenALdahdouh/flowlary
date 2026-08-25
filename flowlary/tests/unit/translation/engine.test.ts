import { describe, expect, it, vi } from 'vitest'
import { canTranslateRequest, TranslationEngine } from '../../../extension/src/features/translation/engine.ts'
import { resolveTranslateTarget, targetLooksProtected } from '../../../extension/src/features/translation/selection.ts'
import { isStaleTicket } from '../../../extension/src/features/translation/stale.ts'
import type { TranslationRequest } from '../../../extension/src/features/translation/types.ts'

describe('translation engine', () => {
  it('rejects empty, same-language, and oversized requests locally', () => {
    expect(
      canTranslateRequest({
        sourceLanguage: 'ar',
        targetLanguage: 'en',
        text: '   ',
        mode: 'shortcut',
      }),
    ).toEqual({ ok: false, code: 'empty' })
    expect(
      canTranslateRequest({
        sourceLanguage: 'en',
        targetLanguage: 'en',
        text: 'hello',
        mode: 'shortcut',
      }),
    ).toEqual({ ok: false, code: 'same-language' })
    expect(
      canTranslateRequest({
        sourceLanguage: 'ar',
        targetLanguage: 'en',
        text: 'x'.repeat(4001),
        mode: 'shortcut',
      }),
    ).toEqual({ ok: false, code: 'too-long' })
  })

  it('does not call provider for invalid requests', async () => {
    let called = 0
    const engine = new TranslationEngine({
      async translate() {
        called += 1
        return { ok: false, code: 'network' }
      },
    })
    await engine.translate({
      sourceLanguage: 'en',
      targetLanguage: 'en',
      text: 'hello',
      mode: 'shortcut',
    })
    expect(called).toBe(0)
  })

  it('translates through provider', async () => {
    const engine = new TranslationEngine({
      async translate(request) {
        return { ok: true, translation: `T(${request.text})` }
      },
    })
    const outcome = await engine.translate({
      sourceLanguage: 'ar',
      targetLanguage: 'en',
      text: 'مرحبا',
      mode: 'shortcut',
    })
    expect(outcome).toEqual({ ok: true, translation: 'T(مرحبا)' })
  })
})

describe('translation selection', () => {
  it('selection wins over paragraph context', () => {
    const sentence = 'I want شراء هذا المنتج today.'
    const selected = 'شراء هذا المنتج'
    const start = sentence.indexOf(selected)
    const resolved = resolveTranslateTarget(sentence, start, start + selected.length)
    expect(resolved?.mode).toBe('selection')
    expect(resolved?.text).toBe(selected)
  })

  it('uses paragraph when caret is collapsed', () => {
    const paragraph = 'First paragraph.\n\nSecond paragraph.'
    const resolved = resolveTranslateTarget(paragraph, paragraph.length, paragraph.length)
    expect(resolved?.mode).toBe('context')
    expect(resolved?.text).toBe('Second paragraph.')
  })

  it('blocks secret-looking single tokens', () => {
    expect(targetLooksProtected('sk-abcdefghijklmnopqrstuvwxyz123456')).toBe(true)
    expect(targetLooksProtected('تواصل معي على test@example.com')).toBe(false)
  })
})

describe('translation stale ticket', () => {
  it('detects generation and slice changes', () => {
    const ticket = {
      elementGeneration: 1,
      originalText: 'مرحبا',
      start: 0,
      end: 5,
      sourceLanguage: 'ar' as const,
      targetLanguage: 'en' as const,
      mode: 'shortcut' as const,
    }
    expect(
      isStaleTicket(ticket, {
        generation: 2,
        text: 'مرحبا',
        start: 0,
        end: 5,
        sourceLanguage: 'ar',
        targetLanguage: 'en',
      }),
    ).toBe(true)
    expect(
      isStaleTicket(ticket, {
        generation: 1,
        text: 'نص جديد',
        start: 0,
        end: 5,
        sourceLanguage: 'ar',
        targetLanguage: 'en',
      }),
    ).toBe(true)
  })
})
