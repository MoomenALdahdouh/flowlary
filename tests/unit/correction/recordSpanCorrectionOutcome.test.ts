import { describe, expect, it, vi } from 'vitest'
import {
  buildSpanCorrectionResponse,
  recordInstantSpellOutcome,
} from '../../../extension/src/features/correction/recordSpanCorrectionOutcome.ts'

vi.mock('../../../extension/src/storage/history/record.ts', () => ({
  recordHistory: vi.fn(async () => true),
}))

vi.mock('../../../extension/src/features/learning/recordCorrectionLearning.ts', () => ({
  recordCorrectionAccepted: vi.fn(),
}))

describe('recordSpanCorrectionOutcome', () => {
  it('builds a segment-level correction response for span edits', () => {
    const built = buildSpanCorrectionResponse({
      fullTextBefore: 'I dont know what to write',
      range: { start: 2, end: 6 },
      replacement: "don't",
      changeType: 'spelling',
    })
    expect(built).not.toBeNull()
    expect(built!.correctedSegment).toContain("don't")
    expect(built!.response.changes[0]?.type).toBe('spelling')
  })

  it('records instant spell outcomes for segment rewrites', async () => {
    const { recordCorrectionAccepted } = await import(
      '../../../extension/src/features/learning/recordCorrectionLearning.ts'
    )
    const ta = document.createElement('textarea')
    recordInstantSpellOutcome({
      element: ta,
      fullTextBefore: 'I teh know',
      fullTextAfter: 'I the know',
    })
    expect(recordCorrectionAccepted).toHaveBeenCalled()
  })
})
