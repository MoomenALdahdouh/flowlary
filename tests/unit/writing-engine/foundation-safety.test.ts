/**
 * Foundation safety: production analyzer load + mixed-layout auto-write guard.
 * Class coverage, not production word lists.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'
import {
  analyzeFieldText,
  buildFieldContext,
  candidatesFromHypotheses,
  collectHypotheses,
  decideWriting,
  inferLayoutSpans,
  layoutSpanConflictsWithMixedIntent,
  resetHypothesisIdsForTests,
} from '../../../extension/src/core/engine/index.ts'
import { mapLayout, mapLayoutText } from '../../../extension/src/features/layout/layouts/registry.ts'
import { applyUserWritingPolicy } from '../../../extension/src/core/policy/writingPolicy.ts'

function textarea(value: string) {
  const ta = document.createElement('textarea')
  ta.value = value
  document.body.append(ta)
  return ta
}

function withTypingBoundary(text: string): string {
  return text.length === 0 || /\s$/u.test(text) ? text : `${text} `
}

function decide(text: string, overrides: Record<string, unknown> = {}) {
  const stable = withTypingBoundary(text)
  const ta = textarea(stable)
  const session = new FieldSession(ta)
  const context = {
    ...buildFieldContext({
      element: ta,
      session,
      cycleId: 'fs',
      composing: false,
      textLength: stable.length,
    }),
    ...overrides,
  }
  const analysis = analyzeFieldText(stable, {
    overrideRanges: [...session.getOverrideRanges()],
  })
  const hypotheses = collectHypotheses(stable, stable.length, context, analysis)
  const candidates = candidatesFromHypotheses(hypotheses, context)
  const decision = decideWriting(context, analysis, candidates, { observeOnly: false, hypotheses })
  return { ta, session, context, analysis, hypotheses, candidates, decision }
}

const EN_WHOLE = [
  'please send this file today',
  'the meeting starts tomorrow morning',
  'this project needs another update',
  'can you check the error again',
  'hello how are you today',
  'save the work before you leave',
  'thanks for the help today',
  'the team wants a small change',
]

describe('foundation safety', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    resetHypothesisIdsForTests()
    stateManager.settings = {
      enabled: true,
      pausedUntil: null,
      excludedDomains: [],
      version: 1,
      helpStyle: 'auto',
    }
    stateManager.layout.autoEnabled = true
    stateManager.layout.mode = 'direct'
    stateManager.correction.enabled = true
    stateManager.correction.mode = 'direct'
    stateManager.translation.liveEnabled = false
    applyUserWritingPolicy({
      helpStyle: 'auto',
      fixWrongTyping: true,
      improveEnglish: true,
      arabicToEnglishMode: false,
    })
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('loads analyzeFieldText from the production engine entry', () => {
    const analysis = analyzeFieldText('hello')
    expect(analysis.chunks.length).toBeGreaterThan(0)
    expect(analysis.layoutSpans).toBeDefined()
  })

  it('A. whole-span English on Arabic keyboard still auto-fixes', () => {
    let applied = 0
    for (const sentence of EN_WHOLE) {
      const typed = mapLayoutText(sentence, 'en-US-qwerty', 'ar-101')
      expect(typed && typed !== sentence).toBe(true)
      const { decision } = decide(typed!)
      if (decision.action === 'layout_fix') applied += 1
    }
    expect(applied / EN_WHOLE.length).toBeGreaterThanOrEqual(0.75)
  })

  it('B. Arabic typed on English keyboard can still produce a layout hypothesis', () => {
    const intended = 'مرحبا كيف حالك اليوم'
    const typed = mapLayoutText(intended, 'ar-101', 'en-US-qwerty')!
    const spans = inferLayoutSpans(typed)
    expect(spans.length).toBeGreaterThan(0)
  })

  it('C. pure Arabic as-is is not auto layout', () => {
    const { decision } = decide('مرحبا كيف حالك اليوم')
    expect(decision.action).not.toBe('layout_fix')
  })

  it('D. pure English as-is is not auto layout', () => {
    const { decision } = decide('please send this file today')
    expect(decision.action).not.toBe('layout_fix')
  })

  it('E. Arabic + intentional English does not auto-write layout', () => {
    const { decision, analysis } = decide('أحتاج مراجعة الـ pull request قبل الدمج')
    expect(analysis.chunks.some((chunk) => chunk.role === 'arabic_prose')).toBe(true)
    expect(decision.action).not.toBe('layout_fix')
  })

  it('F. Arabic + technical English does not auto-write layout', () => {
    const { decision } = decide('رفعنا الـ FastAPI service على localhost:8080')
    expect(decision.action).not.toBe('layout_fix')
  })

  it('G. English + intentional Arabic does not auto-write layout', () => {
    const { decision } = decide('The كلمة العربية is intentional')
    expect(decision.action).not.toBe('layout_fix')
  })

  it('H. one remapped token inside English does not consume the English sentence', () => {
    const token = mapLayout('report', 'en-US-qwerty', 'ar-101')!
    const text = `please ${token} this`
    const { decision } = decide(text)
    if (decision.action === 'layout_fix' && decision.range) {
      expect(decision.range.end - decision.range.start).toBeLessThan(text.length)
    } else {
      expect(decision.action).not.toBe('english_correction')
    }
  })

  it('I. one remapped token inside Arabic does not consume Arabic prose', () => {
    const token = mapLayout('hello', 'en-US-qwerty', 'ar-101')!
    const text = `مرحبا ${token} شكرا`
    const { decision, analysis } = decide(text)
    expect(analysis.chunks.some((chunk) => chunk.role === 'arabic_prose')).toBe(true)
    if (decision.action === 'layout_fix' && decision.range) {
      const slice = text.slice(decision.range.start, decision.range.end)
      expect(slice.includes('مرحبا') && slice.includes('شكرا')).toBe(false)
    }
  })

  it('J. multiple wrong-layout tokens in an otherwise remapped English sentence still fix', () => {
    const typed = mapLayoutText('please send the report today', 'en-US-qwerty', 'ar-101')!
    const { decision } = decide(typed)
    expect(decision.action).toBe('layout_fix')
  })

  it('K. unknown technical-shaped token is not auto layout', () => {
    const { decision, analysis } = decide('we use FlowlaryX nightly')
    expect(decision.action).not.toBe('layout_fix')
    expect(analysis.chunks.some((chunk) => chunk.role === 'identifier' || chunk.role === 'intentional_foreign_token' || chunk.role === 'unknown')).toBe(true)
  })

  it('L. URL + prose stays protected', () => {
    const { decision, analysis } = decide('see https://example.com/api/v1 please')
    expect(analysis.chunks.some((chunk) => chunk.role === 'url' || chunk.protectedKind === 'url')).toBe(true)
    expect(decision.action).not.toBe('layout_fix')
  })

  it('M. email + prose stays protected', () => {
    const { decision, analysis } = decide('write user@example.com later')
    expect(analysis.chunks.some((chunk) => chunk.role === 'email')).toBe(true)
    expect(decision.action).not.toBe('layout_fix')
  })

  it('N. code identifier + prose stays protected', () => {
    const { decision, analysis } = decide('rename userName please')
    expect(analysis.chunks.some((chunk) => chunk.role === 'identifier')).toBe(true)
    expect(decision.action).not.toBe('layout_fix')
  })

  it('O. punctuation-only text is not a layout write', () => {
    const { decision } = decide('??? !!!')
    expect(decision.action).toBe('noop')
  })

  it('P. capitalization of short Latin pairs is not auto layout', () => {
    const { decision } = decide('UI ux')
    expect(decision.action).not.toBe('layout_fix')
    expect(decision.action).not.toBe('english_correction')
  })

  it('Q. paste remains conservative', () => {
    const typed = mapLayoutText('please send this file today', 'en-US-qwerty', 'ar-101')!
    const { decision } = decide(typed, { inputSource: 'paste' })
    expect(decision.action).toBe('noop')
    expect(decision.reasonCodes).toContain('paste_conservative')
  })

  it('R. composition remains safe', () => {
    const typed = mapLayoutText('please send this file today', 'en-US-qwerty', 'ar-101')!
    const { decision } = decide(typed, { composing: true })
    expect(decision.action).toBe('noop')
    expect(decision.reasonCodes).toContain('composing')
  })

  it('S. user override blocks colliding layout', () => {
    const ta = textarea('hello')
    const session = new FieldSession(ta)
    session.noteEngineSpan(0, 5, 'hello')
    session.bumpGeneration()
    ta.value = 'hallo'
    session.detectUserOverride(ta.value)
    const context = buildFieldContext({
      element: ta,
      session,
      cycleId: 'ov',
      composing: false,
      textLength: ta.value.length,
    })
    const analysis = analyzeFieldText(ta.value, { overrideRanges: [...session.getOverrideRanges()] })
    expect(analysis.chunks.some((chunk) => chunk.role === 'user_override')).toBe(true)
    const hypotheses = collectHypotheses(ta.value, ta.value.length, context, analysis)
    const decision = decideWriting(context, analysis, candidatesFromHypotheses(hypotheses), {
      observeOnly: false,
      hypotheses,
    })
    expect(decision.action).not.toBe('layout_fix')
  })

  it('T. translation mode is not implied by Arabic script alone', () => {
    const { decision } = decide('أريد إرسال هذا البريد غدا.')
    expect(decision.action).not.toBe('translation')
  })

  it('generated holdout-style EN-on-AR sentences keep majority auto layout', () => {
    const extras = [
      'the committee postponed the calendar',
      'a bicycle crossed the railway',
      'the passenger forgot a suitcase',
    ]
    let applied = 0
    for (const sentence of extras) {
      const typed = mapLayoutText(sentence, 'en-US-qwerty', 'ar-101')!
      if (decide(typed).decision.action === 'layout_fix') applied += 1
    }
    expect(applied).toBeGreaterThanOrEqual(2)
  })

  it('suggestions mode can surface a blocked mix layout without writing', () => {
    const { decision } = decide('أحتاج مراجعة الـ pull request قبل الدمج', {
      helpStyle: 'suggestions',
    })
    expect(decision.action).not.toBe('layout_fix')
    expect(['noop', 'suggestion']).toContain(decision.action)
  })
})

describe('mixedLayoutSafety helper', () => {
  it('flags a span that covers as-is Arabic and as-is Latin', () => {
    const text = 'مرحبا hello شكرا'
    const analysis = analyzeFieldText(text)
    const wide = { start: 0, end: text.length }
    expect(layoutSpanConflictsWithMixedIntent(wide, analysis.chunks)).toBe(true)
  })

  it('does not flag a whole-span layout-only field', () => {
    const typed = mapLayoutText('please send this file today', 'en-US-qwerty', 'ar-101')!
    const analysis = analyzeFieldText(typed)
    if (analysis.layoutSpans[0]) {
      expect(layoutSpanConflictsWithMixedIntent(analysis.layoutSpans[0]!.range, analysis.chunks)).toBe(false)
    }
  })
})
