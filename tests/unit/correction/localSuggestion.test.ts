import { describe, expect, it } from 'vitest'
import { buildLocalCorrectionResponse } from '../../../extension/src/features/correction/localSuggestion.ts'

describe('local box suggestion', () => {
  it('turns a ChatGPT-style typo draft into a highlighted correction', () => {
    const response = buildLocalCorrectionResponse('hell hwo are yuo')
    expect(response?.correctedText).toBe('Hello, how are you?')
    expect(response?.changes.some((change) => change.type === 'spelling')).toBe(true)
    expect(response?.changes.some((change) => change.type === 'grammar')).toBe(true)
    expect(response?.changes.map((change) => `${change.original}->${change.corrected}`)).toEqual(
      expect.arrayContaining(['hwo->how', 'yuo->you']),
    )
  })

  it('corrects let me now and splits the follow-up question', () => {
    const response = buildLocalCorrectionResponse(
      'hell hwo are yuo are yuo comming or not let me now',
    )
    expect(response?.correctedText).toBe('Hello, how are you? Are you coming or not? Let me know.')
    expect(response?.changes.some((change) => change.original === 'now' && change.corrected === 'know')).toBe(
      true,
    )
  })

  it('does not offer a teacher card while leftover misspellings remain', () => {
    expect(buildLocalCorrectionResponse('xyzzy qqq zzzz')).toBeNull()
  })

  it('offers a local card only when every word is real English', () => {
    const response = buildLocalCorrectionResponse('complet wher yuo are stope')
    expect(response?.correctedText).toBe('Complete where you are stopped.')
  })
})
