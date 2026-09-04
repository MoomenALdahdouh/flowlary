/** @vitest-environment happy-dom */
import { describe, expect, it } from 'vitest'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import {
  analyzeFieldText,
  buildFieldContext,
  extractReviewIsland,
  shouldScheduleWritingReview,
} from '../../../extension/src/core/engine/index.ts'
import { applyUserWritingPolicy } from '../../../extension/src/core/policy/writingPolicy.ts'
import { hashWritingSample } from '@flowlary/shared'
import { registerCorrectionFieldStates } from '../../../extension/src/features/correction/correctionLiveState.ts'
import { IntelligentDebouncer } from '../../../extension/src/features/correction/debounce.ts'

function setup(text: string, overrides: Record<string, unknown> = {}, policyPatch: Record<string, unknown> = {}) {
  applyUserWritingPolicy({
    helpStyle: 'auto',
    fixWrongTyping: true,
    improveEnglish: true,
    arabicToEnglishMode: false,
    aiWritingReviewEnabled: true,
    ...policyPatch,
  })
  const ta = document.createElement('textarea')
  ta.value = text
  document.body.append(ta)
  const session = new FieldSession(ta)
  const context = {
    ...buildFieldContext({
      element: ta,
      session,
      cycleId: 'trig',
      composing: false,
      textLength: text.length,
    }),
    liveWholeFieldCorrection: false,
    ...overrides,
  }
  const analysis = analyzeFieldText(text, { caret: text.length, commitOpenToken: true })
  const island = extractReviewIsland(text, text.length, analysis)
  return { session, context, analysis, island }
}

describe('writing review trigger', () => {
  it('schedules a completed English sentence', () => {
    const { context, analysis, island } = setup('hello there friend. ')
    expect(shouldScheduleWritingReview({
      context,
      analysis,
      island,
      localAppliedLayout: false,
      cached: false,
      lastReviewAt: 0,
    })).toBe(true)
  })

  it('suppresses composing, paste, shortcuts_only, and disabled review', () => {
    const text = 'hello there friend. '
    expect(shouldScheduleWritingReview({
      ...setup(text, { composing: true }),
      localAppliedLayout: false,
      cached: false,
      lastReviewAt: 0,
    })).toBe(false)
    expect(shouldScheduleWritingReview({
      ...setup(text, { inputSource: 'paste' }),
      localAppliedLayout: false,
      cached: false,
      lastReviewAt: 0,
    })).toBe(false)
    expect(shouldScheduleWritingReview({
      ...setup(text, {}, { helpStyle: 'shortcuts_only' }),
      localAppliedLayout: false,
      cached: false,
      lastReviewAt: 0,
    })).toBe(false)
    expect(shouldScheduleWritingReview({
      ...setup(text, {}, { aiWritingReviewEnabled: false }),
      localAppliedLayout: false,
      cached: false,
      lastReviewAt: 0,
    })).toBe(false)
    expect(shouldScheduleWritingReview({
      ...setup(text, { selection: { start: 0, end: 4 } }),
      localAppliedLayout: false,
      cached: false,
      lastReviewAt: 0,
    })).toBe(false)
  })

  it('does not schedule a JWT-bearing field', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'
    const { context, analysis, island } = setup(`token ${jwt} please. `)
    expect(island).toBeNull()
    expect(shouldScheduleWritingReview({
      context,
      analysis,
      island,
      localAppliedLayout: false,
      cached: false,
      lastReviewAt: 0,
    })).toBe(false)
  })

  it('does not consult when a unique local layout already auto-wrote', () => {
    const { context, analysis, island } = setup('hello there friend. ')
    expect(shouldScheduleWritingReview({
      context,
      analysis,
      island,
      localAppliedLayout: true,
      cached: false,
      lastReviewAt: 0,
    })).toBe(false)
  })

  it('skips a cached island hash', () => {
    const text = 'hello there friend. '
    const { session, context, analysis, island } = setup(text)
    const hash = hashWritingSample(island!.snippet)
    session.cacheReview(hash)
    expect(session.hasCachedReview(hash)).toBe(true)
    expect(shouldScheduleWritingReview({
      context,
      analysis,
      island,
      localAppliedLayout: false,
      cached: session.hasCachedReview(hash),
      lastReviewAt: 0,
    })).toBe(false)
  })

  it('skips when live whole-field correction is active', () => {
    const { context, analysis, island } = setup('hello there friend. ', {
      liveWholeFieldCorrection: true,
    })
    expect(shouldScheduleWritingReview({
      context,
      analysis,
      island,
      localAppliedLayout: false,
      cached: false,
      lastReviewAt: 0,
    })).toBe(false)
  })

  it('skips when a whole-field correction request is pending', () => {
    const states = new Map([
      [
        'field-1',
        {
          debouncer: new IntelligentDebouncer(() => undefined),
          lastSentText: 'hello there friend.',
          lastCorrectedFor: '',
          pendingRequestId: 'req-1',
          lastCorrectionRequestAt: 0,
          card: null,
          cardMounted: false,
        },
      ],
    ])
    registerCorrectionFieldStates(states)
    const { context, analysis, island } = setup('hello there friend. ', { fieldId: 'field-1' })
    expect(shouldScheduleWritingReview({
      context,
      analysis,
      island,
      localAppliedLayout: false,
      cached: false,
      lastReviewAt: 0,
    })).toBe(false)
  })
})
