/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'
import {
  analyzeFieldText,
  buildFieldContext,
  collectHypotheses,
  ingestReviewEdits,
  resetWritingReviewForTests,
  setWritingReview,
} from '../../../extension/src/core/engine/index.ts'
import { extractReviewIsland } from '../../../extension/src/core/engine/reviewIsland.ts'
import { applyUserWritingPolicy } from '../../../extension/src/core/policy/writingPolicy.ts'
import { runFieldCycle } from '../../../extension/src/core/writeGate/pipeline.ts'
import { clearWritingAnalytics } from '../../../extension/src/core/observability/writingAnalytics.ts'

const REVIEW_DUE = { dueFeatures: new Set(['review'] as const) }

describe('writing review pipeline ingest', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    clearWritingAnalytics()
    resetWritingReviewForTests()
    applyUserWritingPolicy({
      helpStyle: 'auto',
      fixWrongTyping: true,
      improveEnglish: true,
      arabicToEnglishMode: false,
      aiWritingReviewEnabled: true,
    })
    stateManager.correction.enabled = true
    stateManager.correction.mode = 'direct'
    stateManager.correction.consentAccepted = true
  })

  afterEach(() => {
    resetWritingReviewForTests()
  })

  it('does not consult review when whole-field English owns the field', async () => {
    const review = vi.fn(async () => ({
      verdict: 'edits' as const,
      ambiguityClass: 'english_island',
      reasonCode: 'spelling',
      edits: [],
    }))
    setWritingReview(review)
    const ta = document.createElement('textarea')
    ta.value = 'hello comming tomorrow. '
    document.body.append(ta)
    ta.focus()
    await runFieldCycle(ta, new FieldSession(ta), REVIEW_DUE)
    expect(review).not.toHaveBeenCalled()
    expect(ta.value).toBe('hello comming tomorrow. ')
  })

  it('turns a high-confidence island spelling edit into a review hypothesis', () => {
    const text = 'hello comming tomorrow. '
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.append(ta)
    const session = new FieldSession(ta)
    const context = buildFieldContext({
      element: ta,
      session,
      cycleId: 'review',
      composing: false,
      textLength: text.length,
    })
    const analysis = analyzeFieldText(text, { caret: text.length, commitOpenToken: true })
    const hypotheses = collectHypotheses(text, text.length, context, analysis)
    const island = extractReviewIsland(text, text.length, analysis)!
    const start = island.snippet.indexOf('comming')
    const extra = ingestReviewEdits([{
      start,
      end: start + 7,
      original: 'comming',
      proposed: 'coming',
      kind: 'spelling',
      confidence: 'high',
    }], island, analysis, context, hypotheses)
    expect(extra[0]?.replacement).toBe('coming')
    expect(text.slice(island.range.start, island.range.end)).toContain('comming')
  })
})
