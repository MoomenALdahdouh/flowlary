/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'
import {
  resetWritingReviewForTests,
  setWritingReview,
  extractReviewIsland,
  analyzeFieldText,
} from '../../../extension/src/core/engine/index.ts'
import { applyUserWritingPolicy } from '../../../extension/src/core/policy/writingPolicy.ts'
import { runFieldCycle } from '../../../extension/src/core/writeGate/pipeline.ts'

function policy() {
  applyUserWritingPolicy({
    helpStyle: 'auto',
    fixWrongTyping: true,
    improveEnglish: false,
    arabicToEnglishMode: false,
    aiWritingReviewEnabled: true,
  })
}

const REVIEW_DUE = { dueFeatures: new Set(['review'] as const) }

describe('writing review scenario classes', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    resetWritingReviewForTests()
    policy()
    stateManager.correction.enabled = true
    stateManager.correction.mode = 'direct'
    stateManager.correction.consentAccepted = true
  })
  afterEach(() => {
    resetWritingReviewForTests()
  })

  it('fixes English spelling/grammar/punctuation islands without full-field rewrite', async () => {
    const text = 'She have recieved it, comming tomorrow. '
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.append(ta)
    const analysis = analyzeFieldText(text)
    const island = extractReviewIsland(text, text.length, analysis)
    expect(island).not.toBeNull()
    expect(island?.snippet).toMatch(/comming/)
    expect(island?.snippet.startsWith('She have recieved')).toBe(true)
    expect(text).toContain('comming')
  })

  it('preserves Arabic prose and does not review an Arabic-only field', async () => {
    const review = vi.fn(async () => ({
      verdict: 'edits' as const,
      ambiguityClass: 'x',
      reasonCode: 'y',
      edits: [{
        start: 0, end: 3, original: 'abc', proposed: 'zzz', kind: 'spelling' as const, confidence: 'high' as const,
      }],
    }))
    setWritingReview(review)
    const ta = document.createElement('textarea')
    ta.value = 'أريد إرسال التقرير إلى الفريق اليوم. '
    document.body.append(ta)
    const analysis = analyzeFieldText(ta.value)
    expect(extractReviewIsland(ta.value, ta.value.length, analysis)).toBeNull()
    await runFieldCycle(ta, new FieldSession(ta), REVIEW_DUE)
    expect(review).not.toHaveBeenCalled()
    expect(ta.value).toContain('أريد')
  })

  it('reviews only the English island inside mixed Arabic/English', async () => {
    const text = 'مرحبا hello are you comming or not نعم انا فادم الان. '
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.append(ta)
    const analysis = analyzeFieldText(text)
    const island = extractReviewIsland(text, text.indexOf('comming') + 7, analysis)
    expect(island).not.toBeNull()
    expect(island?.snippet).toMatch(/comming/)
    expect(island?.snippet).not.toMatch(/مرحبا|نعم|فادم/)
    expect(text).toContain('مرحبا')
    expect(text).toContain('فادم')
  })

  it('does not review URLs, emails, JWTs, API keys, or incomplete prefixes', async () => {
    const review = vi.fn(async () => ({
      verdict: 'no_change' as const,
      ambiguityClass: 'ok',
      reasonCode: 'ok',
      edits: [],
    }))
    setWritingReview(review)
    for (const text of [
      'see https://status.example.org/health please. ',
      'mail ops+oncall@example.net later. ',
      'token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U please. ',
      'sk-abcdefghijklmnopqrstuv in env. ',
      'Bearer eyJ. ',
    ]) {
      review.mockClear()
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.append(ta)
      await runFieldCycle(ta, new FieldSession(ta), REVIEW_DUE)
      await new Promise((r) => setTimeout(r, 20))
      expect(review).not.toHaveBeenCalled()
      expect(ta.value).toBe(text)
      document.body.innerHTML = ''
    }
  })

  it('does not review paste or open tokens', async () => {
    const review = vi.fn(async () => ({
      verdict: 'edits' as const,
      ambiguityClass: 'x',
      reasonCode: 'y',
      edits: [],
    }))
    setWritingReview(review)
    const pasted = document.createElement('textarea')
    pasted.value = 'hello comming tomorrow. '
    document.body.append(pasted)
    const session = new FieldSession(pasted)
    session.noteInputSource('paste')
    await runFieldCycle(pasted, session, REVIEW_DUE)
    expect(review).not.toHaveBeenCalled()

    const open = document.createElement('textarea')
    open.value = 'hello comming'
    document.body.append(open)
    await runFieldCycle(open, new FieldSession(open), REVIEW_DUE)
    expect(review).not.toHaveBeenCalled()
  })
})
