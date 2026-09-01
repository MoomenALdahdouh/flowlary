/**
 * Gated live writing-review check. Excluded from default vitest include.
 * Run with the dedicated eval config and GROQ_API_KEY.
 */
import { describe, expect, it } from 'vitest'
import { loadConfig } from '../../../backend/src/config/env.ts'
import { runWritingReviewProvider } from '../../../backend/src/providers/writingReviewProvider.ts'

const live = Boolean(process.env.GROQ_API_KEY) && process.env.FLOWLARY_LIVE_WRITING_REVIEW === '1'

describe.skipIf(!live)('live writing review failure-only fallback', () => {
  it('returns a validated island verdict from Groq without ranked IDs', async () => {
    const config = {
      ...loadConfig(),
      writingReviewEnabled: true,
      writingReviewFallbackEnabled: true,
      groqAdvisorEnabled: true,
    }
    const result = await runWritingReviewProvider(config, {
      cycleId: 'live-review',
      snippet: 'hello comming tomorrow',
    })
    expect(result.verdict).toMatch(/no_change|edits|uncertain|preserve_all/)
    expect(result).not.toHaveProperty('rankedHypothesisIds')
    if (result.verdict === 'edits') {
      expect(result.edits.every((edit) => edit.kind !== 'wording')).toBe(true)
      expect(result.edits.every((edit) => (
        'hello comming tomorrow'.slice(edit.start, edit.end) === edit.original
      ))).toBe(true)
    }
  })
})
