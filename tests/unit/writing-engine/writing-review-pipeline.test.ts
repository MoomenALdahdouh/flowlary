/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'
import {
  resetWritingReviewForTests,
  setWritingReview,
} from '../../../extension/src/core/engine/index.ts'
import { applyUserWritingPolicy } from '../../../extension/src/core/policy/writingPolicy.ts'
import { runFieldCycle } from '../../../extension/src/core/writeGate/pipeline.ts'
import {
  clearWritingAnalytics,
  getWritingAnalyticsSnapshot,
} from '../../../extension/src/core/observability/writingAnalytics.ts'
import { getActivePipelineSuggestion } from '../../../extension/src/core/writeGate/pipelineSuggest.ts'

function policy(helpStyle: 'auto' | 'suggestions' = 'auto') {
  applyUserWritingPolicy({
    helpStyle,
    fixWrongTyping: true,
    improveEnglish: true,
    arabicToEnglishMode: false,
    aiWritingReviewEnabled: true,
  })
}

describe('writing review pipeline ingest', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    clearWritingAnalytics()
    resetWritingReviewForTests()
    policy('auto')
    stateManager.correction.enabled = true
    stateManager.correction.mode = 'direct'
    stateManager.correction.consentAccepted = true
  })

  afterEach(() => {
    resetWritingReviewForTests()
  })

  it('auto-writes one high-confidence English spelling edit on a monolingual island', async () => {
    setWritingReview(async (packet) => {
      const start = packet.snippet.indexOf('comming')
      return {
        verdict: 'edits',
        ambiguityClass: 'english_island',
        reasonCode: 'spelling',
        edits: [{
          start,
          end: start + 7,
          original: 'comming',
          proposed: 'coming',
          kind: 'spelling',
          confidence: 'high',
        }],
      }
    })
    const ta = document.createElement('textarea')
    ta.value = 'hello comming tomorrow. '
    document.body.append(ta)
    ta.focus()
    const session = new FieldSession(ta)
    await runFieldCycle(ta, session)
    await vi.waitFor(() => expect(ta.value).toContain('coming'))
    expect(ta.value).not.toContain('comming')
    const snapshot = JSON.stringify(getWritingAnalyticsSnapshot())
    expect(snapshot).toContain('writing.review_consult')
    expect(snapshot).not.toContain('comming')
  })

  it('suggests instead of auto-writing when helpStyle is suggestions', async () => {
    policy('suggestions')
    setWritingReview(async (packet) => {
      const start = packet.snippet.indexOf('comming')
      return {
        verdict: 'edits',
        ambiguityClass: 'english_island',
        reasonCode: 'spelling',
        edits: [{
          start,
          end: start + 7,
          original: 'comming',
          proposed: 'coming',
          kind: 'spelling',
          confidence: 'high',
        }],
      }
    })
    const ta = document.createElement('textarea')
    ta.value = 'hello comming tomorrow. '
    document.body.append(ta)
    const session = new FieldSession(ta)
    await runFieldCycle(ta, session)
    await vi.waitFor(() => expect(getActivePipelineSuggestion(session.field.id)?.suggestion).toBe('coming'))
    expect(ta.value).toContain('comming')
  })

  it('drops a stale review after the user keeps typing', async () => {
    let started = false
    let release!: (value: unknown) => void
    const gate = new Promise((resolve) => {
      release = resolve
    })
    setWritingReview(async () => {
      started = true
      await gate
      return {
        verdict: 'edits',
        ambiguityClass: 'english_island',
        reasonCode: 'spelling',
        edits: [{
          start: 6,
          end: 13,
          original: 'comming',
          proposed: 'SHOULD_NOT_APPLY',
          kind: 'spelling',
          confidence: 'high',
        }],
      }
    })
    const ta = document.createElement('textarea')
    ta.value = 'hello comming tomorrow. '
    document.body.append(ta)
    const session = new FieldSession(ta)
    await runFieldCycle(ta, session)
    await vi.waitFor(() => expect(started).toBe(true))
    ta.value = 'Newer text that must remain.'
    release(undefined)
    await vi.waitFor(() => {
      expect(getWritingAnalyticsSnapshot().some((event) => event.reasonCodes.includes('review_stale'))).toBe(true)
    })
    expect(ta.value).toBe('Newer text that must remain.')
  })

  it('does not rewrite Arabic around an English island', async () => {
    setWritingReview(async (packet) => {
      expect(packet.snippet).not.toMatch(/مرحبا/)
      const start = packet.snippet.indexOf('comming')
      return {
        verdict: 'edits',
        ambiguityClass: 'english_island',
        reasonCode: 'spelling',
        edits: [{
          start,
          end: start + 7,
          original: 'comming',
          proposed: 'coming',
          kind: 'spelling',
          confidence: 'high',
        }],
      }
    })
    const ta = document.createElement('textarea')
    ta.value = 'مرحبا hello comming or not نعم. '
    document.body.append(ta)
    const session = new FieldSession(ta)
    await runFieldCycle(ta, session)
    await vi.waitFor(() => expect(ta.value).toContain('coming'))
    expect(ta.value).toContain('مرحبا')
    expect(ta.value).toContain('نعم')
    expect(ta.value).not.toContain('comming')
    expect(ta.value).not.toMatch(/^hello are you coming/i)
  })

  it('calls the provider once for an identical cached island', async () => {
    const review = vi.fn(async () => ({
      verdict: 'no_change' as const,
      ambiguityClass: 'ok',
      reasonCode: 'no_change',
      edits: [],
    }))
    setWritingReview(review)
    const ta = document.createElement('textarea')
    ta.value = 'hello there friend. '
    document.body.append(ta)
    const session = new FieldSession(ta)
    await runFieldCycle(ta, session)
    await vi.waitFor(() => expect(review).toHaveBeenCalledOnce())
    session.enterCooldown(0)
    await runFieldCycle(ta, session)
    await new Promise((r) => setTimeout(r, 20))
    expect(review).toHaveBeenCalledOnce()
  })
})
