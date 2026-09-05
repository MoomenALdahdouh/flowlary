import { describe, expect, it } from 'vitest'
import {
  applyLocalEnglishRepair,
  isCredibleLocalEnglish,
} from '../../../packages/shared/src/correction/localEnglishRepair.ts'
import {
  buildLocalCorrectionResponse,
  isActionableCorrectionError,
} from '../../../extension/src/features/correction/localSuggestion.ts'

describe('English AI failure recovery', () => {
  it('repairs the screenshot typos locally including helpng', () => {
    const source =
      'Hello, how are you? are yuo fine I need yuo helpng me can yuo do that'
    const fixed = applyLocalEnglishRepair(source)
    expect(fixed.toLowerCase()).toContain('you')
    expect(fixed.toLowerCase()).not.toContain('yuo')
    expect(fixed.toLowerCase()).toContain('helping')
    expect(fixed.toLowerCase()).not.toContain('helpng')
    expect(isCredibleLocalEnglish(fixed)).toBe(true)
  })

  it('builds a local box suggestion for that text', () => {
    const source =
      'Hello, how are you? are yuo fine I need yuo helpng me can yuo do that'
    const response = buildLocalCorrectionResponse(source)
    expect(response).not.toBeNull()
    expect(response!.correctedText.toLowerCase()).toContain('helping')
    expect(response!.correctedText.toLowerCase()).not.toContain('yuo')
  })

  it('allows partial local suggestions for AI-failure fallback', () => {
    const source = 'yuo helpng xyzqwv notaword'
    const strict = buildLocalCorrectionResponse(source)
    expect(strict).toBeNull()
    const partial = buildLocalCorrectionResponse(source, { allowPartial: true })
    expect(partial).not.toBeNull()
    expect(partial!.correctedText.toLowerCase()).toContain('you')
    expect(partial!.correctedText.toLowerCase()).toContain('helping')
  })

  it('treats provider failures as non-actionable (hide, do not toast)', () => {
    expect(isActionableCorrectionError('AI_UNAVAILABLE')).toBe(false)
    expect(isActionableCorrectionError('AI_PROVIDER_ERROR')).toBe(false)
    expect(isActionableCorrectionError('AI_TIMEOUT')).toBe(false)
    expect(isActionableCorrectionError('AI_INVALID_RESPONSE')).toBe(false)
    expect(isActionableCorrectionError('gateway_http_502')).toBe(false)
    expect(isActionableCorrectionError('usage_exhausted')).toBe(true)
    expect(isActionableCorrectionError('network')).toBe(true)
    expect(isActionableCorrectionError('consent_required')).toBe(true)
  })
})
