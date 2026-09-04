import { beforeEach, describe, expect, it } from 'vitest'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'
import {
  analyzeFieldText,
  buildFieldContext,
  decideWriting,
} from '../../../extension/src/core/engine/index.ts'
import { collectHypotheses } from '../../../extension/src/core/engine/hypotheses.ts'
import { collectShadowCandidates } from '../../../extension/src/core/engine/candidates.ts'
import { inferLayoutSpans } from '../../../extension/src/core/engine/layoutSequence.ts'
import { applyUserWritingPolicy } from '../../../extension/src/core/policy/writingPolicy.ts'
import { applyLocalEnglishRepair } from '@flowlary/shared'
import { layoutReplacementIsCredible } from '../../../extension/src/core/engine/mixedLayoutSafety.ts'
import type { FieldContext } from '../../../extension/src/core/engine/types.ts'

const DIALECT_AR =
  'اذا كنت راح تيجي خبرني قبل ما تيجي لاني راح استناك قبل ما اطلع'
const LAYOUT_HELLO = 'اثممخ حمثشسث '
const ENGLISH_NATIVE = 'hell hwo are yuo are yuo comming or not let me now'
const MANUAL_GUIDE = 'manul testng setp guid'
const OFFICE_AR = 'أحتاج التقرير النهائي قبل الظهر.'
const MIXED_LAYOUT = 'hello hkh rh]l hghk thanks '

function textarea(value: string) {
  const ta = document.createElement('textarea')
  ta.value = value
  document.body.append(ta)
  return ta
}

function decideText(
  text: string,
  extra: Partial<FieldContext> = {},
): ReturnType<typeof decideWriting> & { spans: ReturnType<typeof inferLayoutSpans> } {
  const ta = textarea(text)
  const session = new FieldSession(ta)
  session.ensureTranslationSession()
  const base = buildFieldContext({
    element: ta,
    session,
    cycleId: 'native-intent',
    composing: false,
    textLength: text.length,
  })
  const context = {
    ...base,
    ...extra,
    translationSessionId: extra.translationSessionId ?? session.getTranslationSessionId(),
  }
  const analysis = analyzeFieldText(text, { caret: text.length, commitOpenToken: true })
  const hypotheses = collectHypotheses(text, text.length, context, analysis)
  const candidates = collectShadowCandidates(text, text.length, context, analysis)
  const decision = decideWriting(context, analysis, candidates, { observeOnly: false, hypotheses })
  return Object.assign(decision, { spans: inferLayoutSpans(text, undefined, { commitOpenToken: true }) })
}

describe('native intent: layout vs translation vs English', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    applyUserWritingPolicy({
      helpStyle: 'suggestions',
      fixWrongTyping: true,
      improveEnglish: true,
      arabicToEnglishMode: true,
    })
  })

  it('does not remap spoken Arabic into Latin junk', () => {
    const spans = inferLayoutSpans(DIALECT_AR, undefined, { commitOpenToken: true })
    const latinJunk = spans.filter((span) => /^[A-Za-z]+$/.test(span.replacement) && !layoutReplacementIsCredible(span.replacement))
    expect(latinJunk).toEqual([])
    expect(spans.some((span) => /ofvkd/i.test(span.replacement))).toBe(false)
  })

  it('Box + live Arabic chooses translation, not TYPING layout', () => {
    const decision = decideText(DIALECT_AR, {
      arabicToEnglishMode: true,
      liveTranslation: true,
      translationPauseReady: true,
      layoutAuto: true,
      helpStyle: 'suggestions',
    })
    expect(decision.action).not.toBe('layout_fix')
    expect(decision.selectedIntent).toBe('translate')
  })

  it('wrong-keyboard Arabic still becomes English words', () => {
    applyUserWritingPolicy({
      helpStyle: 'auto',
      fixWrongTyping: true,
      improveEnglish: false,
      arabicToEnglishMode: false,
    })
    const spans = inferLayoutSpans(LAYOUT_HELLO, undefined, { commitOpenToken: true })
    const joined = spans.map((span) => span.replacement).join(' ')
    expect(joined.toLowerCase()).toMatch(/hello/)
    expect(layoutReplacementIsCredible('hello please')).toBe(true)
    expect(layoutReplacementIsCredible('ofvkd')).toBe(false)
  })

  it('repairs native English locally', () => {
    expect(applyLocalEnglishRepair(ENGLISH_NATIVE)).toBe(
      'Hello, how are you? Are you coming or not? Let me know.',
    )
    expect(applyLocalEnglishRepair(MANUAL_GUIDE)).toBe('Manual testing setup guide.')
    expect(applyLocalEnglishRepair('Please recieve the files')).toBe('Please receive the files.')
    expect(applyLocalEnglishRepair('your welcome')).toMatch(/you're welcome/i)
  })

  it('formal Arabic is original_ar, not layout mismatch', () => {
    const analysis = analyzeFieldText(OFFICE_AR, { caret: OFFICE_AR.length })
    expect(analysis.dominantOrigin).toBe('original_ar')
    expect(analysis.hasLayoutSuspicion).toBe(false)
  })

  it('mixed English + Arabic-on-English keys stays a layout island', () => {
    applyUserWritingPolicy({
      helpStyle: 'auto',
      fixWrongTyping: true,
      improveEnglish: false,
      arabicToEnglishMode: false,
    })
    const decision = decideText(MIXED_LAYOUT, { arabicToEnglishMode: false, liveTranslation: false, layoutAuto: true })
    expect(decision.action).toBe('layout_fix')
  })
})

describe('more learner English samples', () => {
  it.each([
    ['i dont no how', "I don't know how."],
    ['gonna go tommorow', 'Going to go tomorrow.'],
    ['teh recieve mesage', 'The receive message.'],
  ])('%s', (input, expected) => {
    expect(applyLocalEnglishRepair(input)).toBe(expected)
  })
})
