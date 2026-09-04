import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { executeTranslation, normalizeTranslationWriteSpacing } from '../../../extension/src/features/translation/executor.ts'
import type { TranslationOutcome } from '../../../extension/src/features/translation/types.ts'

function textarea(value: string) {
  const ta = document.createElement('textarea')
  ta.value = value
  document.body.append(ta)
  return ta
}

describe('translation executor', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('blocks protected shortcut text', async () => {
    const ta = textarea('sk-abcdefghijklmnopqrstuvwxyz123456')
    const session = new FieldSession(ta)
    const result = await executeTranslation({
      element: ta,
      session,
      range: { start: 0, end: ta.value.length },
      sourceText: ta.value,
      sourceLanguage: 'ar',
      targetLanguage: 'en',
      mode: 'shortcut',
      trigger: 'shortcut',
      tokenStrategy: 'block',
      translate: async () => ({ ok: true, translation: 'no' }),
    })
    expect(result.status).toBe('protected')
  })

  it('inserts spacing when translation abuts existing English', () => {
    const field = "Honestly, maybe I'll come."
    expect(normalizeTranslationWriteSpacing(field, 26, 26, "I don't know why.")).toBe(
      " I don't know why.",
    )
    expect(normalizeTranslationWriteSpacing('Hello world', 5, 5, 'there')).toBe(' there')
    expect(normalizeTranslationWriteSpacing("maybe I'll come", 15, 15, 'I swear')).toBe(' I swear')
  })

  it('commits a fresh translation through the write gate', async () => {
    const ta = textarea('مرحبا كيف حالك؟')
    const session = new FieldSession(ta)
    const acquired = session.tryAcquireWrite('TRANSLATE')
    expect(acquired.ok).toBe(true)
    if (!acquired.ok) return

    const result = await executeTranslation({
      element: ta,
      session,
      range: { start: 0, end: ta.value.length },
      sourceText: ta.value,
      sourceLanguage: 'ar',
      targetLanguage: 'en',
      mode: 'shortcut',
      trigger: 'shortcut',
      tokenStrategy: 'block',
      requestId: acquired.requestId,
      expectedGeneration: acquired.generation,
      recordHistoryEntry: false,
      translate: async () => ({ ok: true, translation: 'Hello there?' }),
    })
    session.releaseWrite('TRANSLATE', acquired.requestId)
    expect(result.status).toBe('committed')
    expect(ta.value).toBe('Hello there?')
  })

  it('discards stale results after generation changes', async () => {
    const ta = textarea('مرحبا كيف حالك؟')
    const session = new FieldSession(ta)
    const hold = vi.fn(
      () =>
        new Promise<TranslationOutcome>((resolve) => {
          setTimeout(() => resolve({ ok: true, translation: 'Late English' }), 10)
        }),
    )

    const pending = executeTranslation({
      element: ta,
      session,
      range: { start: 0, end: ta.value.length },
      sourceText: ta.value,
      sourceLanguage: 'ar',
      targetLanguage: 'en',
      mode: 'live',
      trigger: 'auto',
      tokenStrategy: 'block',
      acquireMutex: true,
      auto: true,
      recordHistoryEntry: false,
      translate: hold,
    })
    session.bumpGeneration()
    const result = await pending
    expect(result.status).toBe('stale')
    expect(ta.value).toBe('مرحبا كيف حالك؟')
  })
})
