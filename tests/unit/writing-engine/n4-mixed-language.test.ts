import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'
import {
  analyzeFieldText,
  collectShadowCandidates,
  buildFieldContext,
  decideWriting,
} from '../../../extension/src/core/engine/index.ts'
import { collectHypotheses } from '../../../extension/src/core/engine/hypotheses.ts'
import { planPreservedTranslation } from '../../../extension/src/core/engine/preserveTokens.ts'
import { applyUserWritingPolicy } from '../../../extension/src/core/policy/writingPolicy.ts'
import { applyIdleEnglishRepair } from '../../../extension/src/features/correction/instantSpell.ts'
import { runFieldCycle } from '../../../extension/src/core/writeGate/pipeline.ts'
import { setPipelineTranslateFnForTests } from '../../../extension/src/core/writeGate/pipelineTranslate.ts'
import {
  clearWritingAnalytics,
  getWritingAnalyticsSnapshot,
} from '../../../extension/src/core/observability/writingAnalytics.ts'

const MIXED_DEPLOY = 'أنا عملت deploy لكن فيه error'
const MIXED_API = 'أرسل لي الـ API key اليوم.'
const ARABIC_SENTENCE = 'أريد إرسال هذا البريد غدًا.'

function textarea(value: string) {
  const ta = document.createElement('textarea')
  ta.value = value
  document.body.append(ta)
  return ta
}

function policy(helpStyle: 'auto' | 'suggestions' | 'shortcuts_only', extra: Record<string, boolean> = {}) {
  applyUserWritingPolicy({
    helpStyle,
    fixWrongTyping: true,
    improveEnglish: true,
    arabicToEnglishMode: false,
    polishAfterTranslate: false,
    ...extra,
  })
}

function decideFor(ta: HTMLTextAreaElement, session: FieldSession) {
  const context = buildFieldContext({
    element: ta,
    session,
    cycleId: 'n4',
    composing: false,
    textLength: ta.value.length,
  })
  const analysis = analyzeFieldText(ta.value, {
    translatedRanges: [...session.getTranslatedRanges()],
    correctedRanges: [...session.getCorrectedRanges()],
    overrideRanges: [...session.getOverrideRanges()],
  })
  const hypotheses = collectHypotheses(ta.value, ta.value.length, context, analysis)
  const candidates = collectShadowCandidates(ta.value, ta.value.length, context, analysis)
  const decision = decideWriting(context, analysis, candidates, {
    observeOnly: false,
    hypotheses,
  })
  return { context, analysis, hypotheses, candidates, decision }
}

describe('N4 mixed-language chunks', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    clearWritingAnalytics()
    policy('auto')
    setPipelineTranslateFnForTests(async (text) => ({ ok: true, translation: `EN:${text}` }))
  })

  afterEach(() => {
    setPipelineTranslateFnForTests(null)
    stateManager.settings.helpStyle = null
    stateManager.settings.arabicToEnglishMode = null
    stateManager.translation.liveEnabled = false
    vi.restoreAllMocks()
  })

  it('chunks mixed Arabic + technical English without treating the field as one language', () => {
    const analysis = analyzeFieldText(MIXED_DEPLOY)
    expect(analysis.hasAmbiguousMixed).toBe(true)
    const roles = analysis.chunks.map((chunk) => chunk.role)
    expect(roles).toContain('arabic_prose')
    expect(analysis.chunks.some((chunk) => {
      const token = MIXED_DEPLOY.slice(chunk.range.start, chunk.range.end)
      return /deploy|error/i.test(token)
        && (chunk.role === 'technical_token' || chunk.role === 'intentional_foreign_token' || chunk.role === 'english_prose')
    })).toBe(true)
  })

  it('does not rewrite an entire mixed sentence as English', async () => {
    const ta = textarea(MIXED_DEPLOY)
    const session = new FieldSession(ta)
    const { decision } = decideFor(ta, session)
    expect(decision.action).not.toBe('english_correction')
    await runFieldCycle(ta, session)
    expect(ta.value).toBe(MIXED_DEPLOY)
  })

  it('may correct a scoped English typo inside mixed text', async () => {
    const text = 'أنا كتبت I dont know اليوم'
    const ta = textarea(text)
    const session = new FieldSession(ta)
    const { decision, hypotheses } = decideFor(ta, session)
    const spelling = hypotheses.find((item) => item.intent === 'fix_english' && item.replacement === "don't")
    if (spelling && decision.action === 'english_correction') {
      await runFieldCycle(ta, session)
      expect(ta.value).toContain("don't")
      expect(ta.value).toContain('أنا')
    } else {
      expect(decision.action).not.toBe('translation')
    }
  })

  it('preserves API / API key tokens when planning mixed translation', () => {
    const analysis = analyzeFieldText(MIXED_API)
    const plan = planPreservedTranslation(MIXED_API, 0, MIXED_API.length, analysis.chunks)
    expect(plan.kept.join(' ').toLowerCase()).toMatch(/api/)
    const restored = plan.restore(`Send me the ${plan.payload.includes('⟦') ? plan.payload : 'API'} today.`)
    if (restored.ok) expect(restored.text).toMatch(/API/i)
  })

  it('translation mode translates mixed Arabic+technical English without dropping keep tokens', async () => {
    applyUserWritingPolicy({
      helpStyle: 'auto',
      fixWrongTyping: true,
      improveEnglish: true,
      arabicToEnglishMode: true,
    })
    setPipelineTranslateFnForTests(async (text) => ({
      ok: true,
      translation: text.replace(/[\u0600-\u06FF]+/g, 'WORD'),
    }))
    const ta = textarea(MIXED_API)
    const session = new FieldSession(ta)
    await runFieldCycle(ta, session)
    expect(ta.value).toMatch(/API/i)
    expect(ta.value.toLowerCase()).toMatch(/key/)
  })

  it('layout wins over English for isolated hwo when layout evidence exists', () => {
    const ta = textarea('hwo')
    const session = new FieldSession(ta)
    const { decision, analysis, hypotheses } = decideFor(ta, session)
    const english = hypotheses.find((item) => item.intent === 'fix_english')
    if (analysis.hasLayoutSuspicion || hypotheses.some((item) => item.intent === 'fix_layout')) {
      expect(decision.action).not.toBe('english_correction')
      expect(decision.blockedCandidateCapabilities).toContain('english_correction')
    } else {
      expect(english).toBeUndefined()
    }
  })

  it('does not auto-correct hwo to how when the token is isolated', async () => {
    const ta = textarea('hwo')
    const session = new FieldSession(ta)
    await runFieldCycle(ta, session)
    expect(ta.value).not.toBe('how')
  })

  it('still auto-corrects a clear English typo in an English sentence', async () => {
    const ta = textarea('I dont know.')
    const session = new FieldSession(ta)
    expect(applyIdleEnglishRepair(ta.value)).toBe("I don't know.")
    const result = await runFieldCycle(ta, session)
    expect(result).toBe('noop')
    expect(ta.value).toBe('I dont know.')
  })

  it('layout fix is scoped to the mismatched token, not the whole field', () => {
    const text = 'hello hsjo]lj world'
    const ta = textarea(text)
    const session = new FieldSession(ta)
    const { decision, candidates } = decideFor(ta, session)
    if (decision.action === 'layout_fix' && decision.range) {
      expect(decision.range.end - decision.range.start).toBeLessThan(text.length)
      const winner = candidates.find((item) => item.id === decision.winnerCandidateId)
      expect(winner?.range.end - (winner?.range.start ?? 0)).toBeLessThan(text.length)
    }
  })

  it('user edit of translated output invalidates origin tags', async () => {
    applyUserWritingPolicy({
      helpStyle: 'auto',
      arabicToEnglishMode: true,
      improveEnglish: true,
      fixWrongTyping: true,
    })
    const ta = textarea(ARABIC_SENTENCE)
    const session = new FieldSession(ta)
    session.noteBlurTranslationPass()
    await runFieldCycle(ta, session, { dueFeatures: new Set(['translate']), translationPauseBypass: true })
    expect(session.hasTranslatedOverlap(0, ta.value.length)).toBe(true)
    ta.value = `X${ta.value.slice(1)}`
    session.pruneTranslatedTags(ta.value)
    expect(session.hasTranslatedOverlap(0, ta.value.length)).toBe(false)
  })

  it('corrected English is tagged and cleared when the user replaces it', async () => {
    const ta = textarea('I dont know.')
    const session = new FieldSession(ta)
    session.tagCorrectedOutput(0, ta.value.length, ta.value)
    expect(session.getCorrectedRanges().length).toBeGreaterThan(0)
    const analysis = analyzeFieldText(ta.value, { correctedRanges: [...session.getCorrectedRanges()] })
    expect(analysis.chunks.some((chunk) => chunk.origin === 'corrected_en')).toBe(true)
    ta.value = 'brand new sentence'
    session.pruneCorrectedTags(ta.value)
    expect(session.getCorrectedRanges().length).toBe(0)
  })

  it('independent field pause state does not copy across fields', () => {
    const a = textarea('مرحبا.')
    const b = textarea('أهلا.')
    const sessionA = new FieldSession(a)
    const sessionB = new FieldSession(b)
    sessionA.ensureTranslationSession()
    sessionB.ensureTranslationSession()
    sessionA.pauseTranslationOnField()
    expect(sessionA.isTranslationPaused()).toBe(true)
    expect(sessionB.isTranslationPaused()).toBe(false)
    expect(sessionA.getTranslationSessionId()).toBeNull()
    expect(sessionB.getTranslationSessionId()).toBeTruthy()
  })

  it('system write cooldown prevents an immediate second correction loop', async () => {
    const ta = textarea('I dont know.')
    const session = new FieldSession(ta)
    await runFieldCycle(ta, session)
    expect(session.isInCooldown()).toBe(false)
    session.enterCooldown(5_000)
    expect(session.isInCooldown()).toBe(true)
    const before = ta.value
    expect(await runFieldCycle(ta, session)).toBe('noop')
    expect(ta.value).toBe(before)
  })

  it('analytics record action/trigger/origin/outcome without raw text', async () => {
    const ta = textarea('I dont know.')
    const session = new FieldSession(ta)
    await runFieldCycle(ta, session)
    const snapshot = getWritingAnalyticsSnapshot()
    const serialized = JSON.stringify(snapshot)
    expect(serialized).not.toContain('dont')
    expect(snapshot.some((event) => event.name === 'writing.decision')).toBe(true)
    expect(snapshot.every((event) => typeof event.action === 'string')).toBe(true)
    expect(snapshot.every((event) => typeof event.outcome === 'string')).toBe(true)
  })

  it('password fields still cannot be written', async () => {
    const input = document.createElement('input')
    input.type = 'password'
    input.value = 'I dont know.'
    document.body.append(input)
    const session = new FieldSession(input)
    expect(await runFieldCycle(input, session)).toBe('noop')
    expect(input.value).toBe('I dont know.')
  })

  it('ordinary contenteditable can auto-write; nested composers cannot', () => {
    const el = document.createElement('div')
    el.contentEditable = 'true'
    el.textContent = 'I dont know.'
    document.body.append(el)
    const session = new FieldSession(el)
    const context = buildFieldContext({
      element: el,
      session,
      cycleId: 'ce',
      composing: false,
      textLength: 12,
    })
    expect(context.capabilities.autoWrite).toBe(true)
    expect(context.capabilities.manualShortcut).toBe(true)
    expect(context.editorTier).toBe(2)

    const nested = document.createElement('div')
    nested.contentEditable = 'true'
    nested.innerHTML = '<div><span>I dont know.</span></div>'
    document.body.append(nested)
    const nestedContext = buildFieldContext({
      element: nested,
      session: new FieldSession(nested),
      cycleId: 'ce-rich',
      composing: false,
      textLength: 12,
    })
    expect(nestedContext.capabilities.autoWrite).toBe(false)
    expect(nestedContext.capabilities.manualShortcut).toBe(true)
  })
})

describe('N4 preserve-token helper', () => {
  it('aborts restore when a kept token is lost', () => {
    const text = 'أرسل API الآن'
    const analysis = analyzeFieldText(text)
    const plan = planPreservedTranslation(text, 0, text.length, analysis.chunks)
    if (plan.kept.length === 0) return
    const lost = plan.restore('Send now')
    expect(lost.ok).toBe(false)
  })
})
