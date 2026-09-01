import { beforeEach, describe, expect, it } from 'vitest'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'
import {
  analyzeFieldText,
  applyLayoutSpansToText,
  buildFieldContext,
  candidatesFromHypotheses,
  collectHypotheses,
  decideWriting,
  inferLayoutSpans,
  repairKeyboardLayoutText,
  resetHypothesisIdsForTests,
} from '../../../extension/src/core/engine/index.ts'
import { mapLayoutText } from '../../../extension/src/features/layout/layouts/registry.ts'
import { runFieldCycle } from '../../../extension/src/core/writeGate/pipeline.ts'
import { applyUserWritingPolicy } from '../../../extension/src/core/policy/writingPolicy.ts'
import { setAdvisorApplyMode } from '../../../extension/src/core/engine/advisor.ts'

const USER_TYPED =
  'مرحبا hello how are you are you ؤخةةهىل خق ىخف نعم hkh rh]l hghk'
const USER_LAYOUT_FIXED =
  'مرحبا hello how are you are you comming or not نعم انا قادم الان'

function decide(text: string) {
  const ta = document.createElement('textarea')
  ta.value = text
  document.body.append(ta)
  const session = new FieldSession(ta)
  const context = buildFieldContext({
    element: ta,
    session,
    cycleId: 'mix',
    composing: false,
    textLength: text.length,
  })
  const analysis = analyzeFieldText(text)
  const hypotheses = collectHypotheses(text, text.length, context, analysis)
  const candidates = candidatesFromHypotheses(hypotheses, context)
  const decision = decideWriting(context, analysis, candidates, {
    observeOnly: false,
    hypotheses,
  })
  return { ta, session, analysis, hypotheses, candidates, decision }
}

describe('bilingual keyboard-layout mix', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    resetHypothesisIdsForTests()
    applyUserWritingPolicy({
      helpStyle: 'auto',
      fixWrongTyping: true,
      improveEnglish: true,
      arabicToEnglishMode: false,
      polishAfterTranslate: false,
    })
    stateManager.layout.autoEnabled = true
    stateManager.layout.mode = 'direct'
    stateManager.correction.enabled = true
    setAdvisorApplyMode('shadow')
  })

  it('maps the reported bilingual sentence both directions without a lexicon hit', () => {
    expect(mapLayoutText('ؤخةةهىل خق ىخف', 'ar-101', 'en-US-qwerty')).toBe('comming or not')
    expect(mapLayoutText('hkh rh]l hghk', 'en-US-qwerty', 'ar-101')).toBe('انا قادم الان')
  })

  it('infers both wrong-keyboard spans in the reported sentence', () => {
    const spans = inferLayoutSpans(USER_TYPED)
    expect(spans.some((span) => span.replacement === 'comming or not' && span.risk === 'low')).toBe(true)
    expect(spans.some((span) => span.replacement === 'انا قادم الان' && span.risk === 'low')).toBe(true)
  })

  it('repairs the reported sentence in one local pass', () => {
    expect(repairKeyboardLayoutText(USER_TYPED).text).toBe(USER_LAYOUT_FIXED)
  })

  it('does not remap the token still being typed', () => {
    const mid = 'مرحبا hello ؤخةةهىل خ'
    const { decision, candidates } = decide(mid)
    const winner = candidates.find((item) => item.id === decision.winnerCandidateId)
    expect(winner?.replacement ?? mid).not.toMatch(/comming o$/)
    expect(mid.endsWith(' خ')).toBe(true)
    if (decision.action === 'layout_fix') {
      expect(mid.slice(winner?.range.start ?? 0, winner?.range.end ?? 0)).not.toBe('خ')
    }
  })

  it('auto-writes both spans in one decision', () => {
    const { decision, candidates } = decide(`${USER_TYPED} `)
    expect(decision.action).toBe('layout_fix')
    const winner = candidates.find((item) => item.id === decision.winnerCandidateId)
    expect(winner?.replacement).toContain('comming or not')
    expect(winner?.replacement).toContain('انا قادم الان')
  })

  it('keeps spaces when words are remapped one-by-one while typing', async () => {
    const ta = document.createElement('textarea')
    document.body.append(ta)
    const session = new FieldSession(ta)
    const typed = 'مرحبا اثممخ حمثشسث نعم '
    for (const char of typed) {
      ta.value += char
      ta.selectionStart = ta.selectionEnd = ta.value.length
      await runFieldCycle(ta, session)
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
    await runFieldCycle(ta, session)
    expect(ta.value).toMatch(/hello\s+please/)
    expect(ta.value).toContain('مرحبا')
    expect(ta.value).toContain('نعم')
  })

  it('repairs the reported sentence when typed a character at a time', async () => {
    const ta = document.createElement('textarea')
    document.body.append(ta)
    const session = new FieldSession(ta)
    for (const char of `${USER_TYPED} `) {
      ta.value += char
      ta.selectionStart = ta.selectionEnd = ta.value.length
      await runFieldCycle(ta, session)
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
    await runFieldCycle(ta, session)
    expect(ta.value).toContain('comming or not')
    expect(ta.value).toContain('انا قادم الان')
  })

  it('applies the reported sentence through the field cycle', async () => {
    const { ta, session, decision } = decide(`${USER_TYPED} `)
    expect(decision.action).toBe('layout_fix')
    const result = await runFieldCycle(ta, session)
    expect(result).toBe('applied')
    expect(ta.value.trim()).toBe(USER_LAYOUT_FIXED)
  })

  it('repairs English typed on an Arabic keyboard inside Arabic', () => {
    const english = 'see you tomorrow'
    const garbled = mapLayoutText(english, 'en-US-qwerty', 'ar-101')!
    const text = `مرحبا ${garbled} نعم`
    expect(repairKeyboardLayoutText(text).text).toBe(`مرحبا ${english} نعم`)
  })

  it('repairs leftover punctuation-keyed Arabic after neighbors already remapped', () => {
    const leftover = 'hello انا rh]l الان thanks '
    expect(repairKeyboardLayoutText(leftover).text).toContain('قادم')
    const { decision, candidates } = decide(leftover)
    expect(decision.action).toBe('layout_fix')
    const winner = candidates.find((item) => item.id === decision.winnerCandidateId)
    expect(winner?.replacement).toContain('قادم')
  })

  it('repairs Arabic typed on an English keyboard inside English', () => {
    const text = 'hello hkh rh]l hghk thanks'
    expect(repairKeyboardLayoutText(text).text).toBe('hello انا قادم الان thanks')
  })

  it('repairs two split wrong-keyboard runs in one pass', () => {
    const first = mapLayoutText('please wait', 'en-US-qwerty', 'ar-101')!
    const second = mapLayoutText('بعد قليل', 'ar-101', 'en-US-qwerty')!
    const text = `مرحبا ${first} نعم ${second}`
    expect(repairKeyboardLayoutText(text).text).toBe('مرحبا please wait نعم بعد قليل')
  })

  it('does not layout-rewrite the intended mixed sentence', () => {
    const intended = 'مرحبا hello are you comming or not نعم انا فادم الان'
    expect(repairKeyboardLayoutText(intended).text).toBe(intended)
    const { decision } = decide(intended)
    expect(decision.action).not.toBe('layout_fix')
  })

  it('keeps intentional mixed Arabic + English product words', () => {
    const text = 'أنا عملت deploy لكن فيه error'
    expect(repairKeyboardLayoutText(text).text).toBe(text)
    const { decision } = decide(text)
    expect(decision.action).not.toBe('layout_fix')
  })

  it('does not remap isolated short Arabic next to English', () => {
    const text = 'hello في world'
    expect(repairKeyboardLayoutText(text).text).toBe(text)
  })

  it('repairs English typed on an Arabic keyboard inside English', () => {
    const typed =
      'hello are you ok hi what are you doing ÷ am okay شىي you waht are you doing'
    const expected =
      'hello are you ok hi what are you doing I am okay and you waht are you doing'
    expect(mapLayoutText(typed, 'ar-101', 'en-US-qwerty')).toBe(expected)
    expect(repairKeyboardLayoutText(typed).text).toBe(expected)
    const { decision, candidates, hypotheses } = decide(`${typed} `)
    expect(decision.action).toBe('layout_fix')
    const winner = candidates.find((item) => item.id === decision.winnerCandidateId)
    expect(hypotheses.some((item) => item.replacement === 'I')).toBe(true)
    expect(hypotheses.some((item) => item.replacement === 'and')).toBe(true)
    expect(winner?.replacement === 'I' || winner?.replacement?.includes('and')).toBe(true)
  })

  it('repairs a standalone Arabic-shift I inside English and keeps real Arabic', async () => {
    const typed =
      'hello what are you doing ÷ am fine and you what are you doing no thing hust playing with my deck ohhhh hahahaha وانت ماذا تفعل هل انت بخير ام لا'
    expect(repairKeyboardLayoutText(typed).text).toContain('I am fine')
    expect(repairKeyboardLayoutText(typed).text).toContain('وانت ماذا تفعل هل انت بخير ام لا')
    expect(repairKeyboardLayoutText(typed).text).not.toContain('÷')
    const { decision, candidates, hypotheses } = decide(`${typed} `)
    expect(hypotheses.some((item) => item.replacement === 'I' && item.risk === 'low')).toBe(true)
    expect(decision.action).toBe('layout_fix')
    const winner = candidates.find((item) => item.id === decision.winnerCandidateId)
    expect(winner?.replacement).toBe('I')
    const { ta, session } = decide(`${typed} `)
    await runFieldCycle(ta, session)
    expect(ta.value).toContain('I am fine')
    expect(ta.value).toContain('وانت ماذا تفعل هل انت بخير ام لا')
    expect(ta.value).not.toContain('÷')
  })

  it('does not consume a URL inside mixed Arabic', () => {
    const text = 'راجع https://flowlary.com الان'
    const { applied } = applyLayoutSpansToText(text, inferLayoutSpans(text))
    expect(applied.every((span) => !span.replacement.includes('flowlary.com') || span.replacement.includes('https://'))).toBe(true)
    expect(repairKeyboardLayoutText(text).text).toContain('https://flowlary.com')
  })

  it('recovers punctuation-bearing Arabic typed on QWERTY', () => {
    const intended = 'استخدمت'
    const typed = mapLayoutText(intended, 'ar-101', 'en-US-qwerty')!
    expect(typed).toContain(']')
    expect(repairKeyboardLayoutText(`اليوم ${typed} هذا`).text).toContain(intended)
  })
})
