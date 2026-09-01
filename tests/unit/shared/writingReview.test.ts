import { describe, expect, it } from 'vitest'
import { parseWritingReviewContent } from '../../../packages/shared/src/ai/writingReview.ts'

const snippet = 'hello comming tomorrow'

function okPayload(edits: unknown[] = []) {
  return {
    verdict: edits.length ? 'edits' : 'no_change',
    ambiguityClass: 'english_island',
    reasonCode: 'spelling',
    edits,
  }
}

describe('parseWritingReviewContent', () => {
  it('accepts no_change with empty edits', () => {
    const result = parseWritingReviewContent(JSON.stringify(okPayload()), snippet)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.edits).toEqual([])
  })

  it('accepts a matching spelling span', () => {
    const start = snippet.indexOf('comming')
    const result = parseWritingReviewContent(JSON.stringify(okPayload([{
      start,
      end: start + 7,
      original: 'comming',
      proposed: 'coming',
      kind: 'spelling',
      confidence: 'high',
    }])), snippet)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.edits[0]?.proposed).toBe('coming')
  })

  it('rejects original that does not match the snippet slice', () => {
    const result = parseWritingReviewContent(JSON.stringify(okPayload([{
      start: 0,
      end: 5,
      original: 'HELLO',
      proposed: 'hello',
      kind: 'spelling',
      confidence: 'high',
    }])), snippet)
    expect(result).toEqual({ ok: false, reason: 'span_mismatch' })
  })

  it('rejects overlapping edits', () => {
    const result = parseWritingReviewContent(JSON.stringify(okPayload([
      {
        start: 0, end: 8, original: snippet.slice(0, 8), proposed: 'hi', kind: 'grammar', confidence: 'high',
      },
      {
        start: 6, end: 13, original: snippet.slice(6, 13), proposed: 'x', kind: 'spelling', confidence: 'high',
      },
    ])), snippet)
    expect(result).toEqual({ ok: false, reason: 'overlap' })
  })

  it('rejects write/html keys on the root object', () => {
    const result = parseWritingReviewContent(JSON.stringify({
      ...okPayload(),
      write: true,
    }), snippet)
    expect(result).toEqual({ ok: false, reason: 'forbidden_field' })
  })

  it('rejects JWT-looking extra mutation fields on edits', () => {
    const start = 0
    const result = parseWritingReviewContent(JSON.stringify(okPayload([{
      start,
      end: 5,
      original: 'hello',
      proposed: 'hello',
      kind: 'spelling',
      confidence: 'high',
      html: '<b>x</b>',
    }])), snippet)
    expect(result).toEqual({ ok: false, reason: 'forbidden_field' })
  })

  it('rejects wording/style polish as a forbidden kind', () => {
    const result = parseWritingReviewContent(JSON.stringify(okPayload([{
      start: 0,
      end: 5,
      original: 'hello',
      proposed: 'hi',
      kind: 'wording',
      confidence: 'high',
    }])), snippet)
    expect(result).toEqual({ ok: false, reason: 'malformed' })
  })

  it('accepts a mixed-language snippet with empty edits', () => {
    const mixed = 'مرحبا hello'
    const start = mixed.indexOf('hello')
    const result = parseWritingReviewContent(JSON.stringify({
      verdict: 'no_change',
      ambiguityClass: 'mixed_ok',
      reasonCode: 'preserve',
      edits: [],
    }), mixed.slice(start))
    expect(result.ok).toBe(true)
  })

  it('rejects verdict edits with an empty list', () => {
    const result = parseWritingReviewContent(JSON.stringify({
      verdict: 'edits',
      ambiguityClass: 'x',
      reasonCode: 'y',
      edits: [],
    }), snippet)
    expect(result).toEqual({ ok: false, reason: 'malformed' })
  })
})
