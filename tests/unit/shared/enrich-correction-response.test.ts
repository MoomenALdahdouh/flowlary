import { describe, expect, it } from 'vitest'
import {
  enrichCorrectionResponseWithExplanations,
  resolveExplanationSafe,
  type CorrectionChange,
  type CorrectionResponse,
} from '@flowlary/shared'

function response(changes: CorrectionChange[], originalText = 'sample'): CorrectionResponse {
  return {
    originalText,
    correctedText: originalText,
    changes,
  }
}

describe('WL-4C-D enrichCorrectionResponse', () => {
  it('attaches aligned explanations for each change', () => {
    const enriched = enrichCorrectionResponseWithExplanations(
      response([
        { type: 'spelling', original: 'recieve', corrected: 'receive', start: 0, end: 7 },
        { type: 'grammar', original: 'go', corrected: 'goes', start: 8, end: 10 },
      ]),
    )

    expect(enriched.explanations).toHaveLength(2)
    expect(enriched.explanations?.[0]?.source).toBe('trusted_rule')
    expect(enriched.explanations?.[1]?.source).not.toBe('trusted_rule')
    expect(enriched.changes).toEqual([
      { type: 'spelling', original: 'recieve', corrected: 'receive', start: 0, end: 7 },
      { type: 'grammar', original: 'go', corrected: 'goes', start: 8, end: 10 },
    ])
  })

  it('preserves practiceTargetId when supplied', () => {
    const enriched = enrichCorrectionResponseWithExplanations(
      response([{ type: 'spelling', original: 'definately', corrected: 'definitely', start: 0, end: 10 }]),
      {
        practiceTargetIdForChange: () => 'spelling:definately',
      },
    )

    expect(enriched.explanations?.[0]?.practiceTargetId).toBe('spelling:definately')
  })

  it('returns original response when changes array is empty', () => {
    const input = response([])
    expect(enrichCorrectionResponseWithExplanations(input)).toBe(input)
  })

  it('resolveExplanationSafe never throws', () => {
    expect(() =>
      resolveExplanationSafe({
        type: 'spelling',
        original: '',
        corrected: 'x',
        start: 0,
        end: 0,
      }),
    ).not.toThrow()
    expect(
      resolveExplanationSafe({
        type: 'spelling',
        original: '',
        corrected: 'x',
        start: 0,
        end: 0,
      }),
    ).toBeUndefined()
  })
})
