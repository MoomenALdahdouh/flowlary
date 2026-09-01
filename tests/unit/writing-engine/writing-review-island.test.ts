import { describe, expect, it } from 'vitest'
import { analyzeFieldText } from '../../../extension/src/core/engine/chunks.ts'
import { extractReviewIsland } from '../../../extension/src/core/engine/reviewIsland.ts'

describe('writing review island extractor', () => {
  it('takes the English run out of a mixed Arabic/English sentence', () => {
    const text = 'مرحبا hello are you comming or not نعم انا قادم الان'
    const analysis = analyzeFieldText(text, { caret: text.length })
    const island = extractReviewIsland(text, text.indexOf('comming') + 7, analysis)
    expect(island).not.toBeNull()
    expect(island?.snippet).toMatch(/comming/)
    expect(island?.snippet).not.toMatch(/مرحبا/)
    expect(island?.monolingualEnglish).toBe(true)
  })

  it('does not send URL or email fields', () => {
    const urlText = 'see https://status.example.org/health please. '
    expect(extractReviewIsland(urlText, urlText.length, analyzeFieldText(urlText))).toBeNull()
    const emailText = 'mail ops+oncall@example.net later. '
    expect(extractReviewIsland(emailText, emailText.length, analyzeFieldText(emailText))).toBeNull()
  })

  it('does not send JWT or API key fields', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0In0.abc'
    const text = `token ${jwt} here`
    const analysis = analyzeFieldText(text, { caret: text.length })
    expect(extractReviewIsland(text, text.length, analysis)).toBeNull()
  })

  it('skips unfinished latin tokens with too few letters', () => {
    const text = 'he'
    const analysis = analyzeFieldText(text, { caret: 2 })
    expect(extractReviewIsland(text, 2, analysis)).toBeNull()
  })
})
