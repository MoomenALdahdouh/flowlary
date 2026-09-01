import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'
import {
  analyzeFieldText,
  buildFieldContext,
  collectHypotheses,
  decideWriting,
  candidatesFromHypotheses,
  resetHypothesisIdsForTests,
  setHypothesisAdvisor,
  validateAdvisorVote,
  consultAdvisor,
  shouldConsultAdvisor,
} from '../../../extension/src/core/engine/index.ts'
import { looksLikeArabizi } from '../../../extension/src/core/engine/arabizi.ts'
import { GOLDEN_INTENT_CASES } from './golden-intent-cases.ts'

function textarea(value: string) {
  const ta = document.createElement('textarea')
  ta.value = value
  document.body.append(ta)
  return ta
}

function withTypingBoundary(text: string): string {
  return text.length === 0 || /\s$/u.test(text) ? text : `${text} `
}

function run(text: string, overrides: Record<string, unknown> = {}) {
  const stable = withTypingBoundary(text)
  const ta = textarea(stable)
  const session = new FieldSession(ta)
  const context = {
    ...buildFieldContext({
      element: ta,
      session,
      cycleId: 'h',
      composing: false,
      textLength: stable.length,
    }),
    ...overrides,
  }
  const analysis = analyzeFieldText(stable, {
    overrideRanges: session.getOverrideRanges().slice(),
  })
  const hypotheses = collectHypotheses(stable, stable.length, context, analysis)
  const candidates = candidatesFromHypotheses(hypotheses)
  const decision = decideWriting(context, analysis, candidates, { observeOnly: false, hypotheses })
  return { ta, session, context, analysis, hypotheses, candidates, decision }
}

describe('hypothesis layer', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    resetHypothesisIdsForTests()
    setHypothesisAdvisor(null)
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
    stateManager.translation.mode = 'direct'
    stateManager.translation.shortcutEnabled = true
  })

  afterEach(() => {
    setHypothesisAdvisor(null)
  })

  it('1. isolated short remaps abstain from automatic write', () => {
    const { hypotheses, decision } = run('نثغ')
    expect(decision.action).not.toBe('layout_fix')
    expect(hypotheses.some((item) => item.intent === 'write_as_is' || item.intent === 'preserve' || item.intent === 'unknown')).toBe(true)
  })

  it('2. unknown neighbor spelling does not invent a memorized replacement', () => {
    const { hypotheses, decision } = run('design engain')
    const spell = hypotheses.find((item) => item.intent === 'fix_english')
    expect(spell?.replacement?.toLowerCase() === 'engine').toBe(false)
    expect(decision.action).not.toBe('layout_fix')
  })

  it('3. ui ux is preserved as intentional English', () => {
    const { hypotheses, decision } = run('ui ux')
    expect(hypotheses.some((item) => item.intent === 'preserve' || item.intent === 'write_as_is')).toBe(true)
    expect(decision.action).not.toBe('layout_fix')
    expect(decision.action).not.toBe('english_correction')
  })

  it('4. how i can make this api is English intent', () => {
    const { analysis, decision } = run('how i can make this api')
    expect(analysis.chunks.some((chunk) => chunk.role === 'english_prose')).toBe(true)
    expect(decision.action).not.toBe('translation')
  })

  it('5. mixed deploy/error keeps multiple language intents', () => {
    const { analysis } = run('أنا عملت deploy لكن فيه error')
    expect(analysis.hasAmbiguousMixed).toBe(true)
    expect(analysis.chunks.some((chunk) => chunk.role === 'arabic_prose')).toBe(true)
    expect(analysis.chunks.some((chunk) => chunk.scripts.latin > 0)).toBe(true)
  })

  it('6. API key GitHub has protected/technical spans', () => {
    const { analysis } = run('أريد API key من GitHub')
    expect(analysis.chunks.some((chunk) => chunk.role === 'identifier' || chunk.protectedKind)).toBe(true)
  })

  it('7. Python + Laravel preserves technical tokens', () => {
    const { hypotheses, decision } = run('Python + Laravel')
    expect(hypotheses.some((item) => item.intent === 'preserve' || item.intent === 'write_as_is')).toBe(true)
    expect(decision.action).not.toBe('layout_fix')
  })

  it('8. mar7aba is Arabizi locally', () => {
    const { analysis, decision } = run('mar7aba and please send this file today')
    expect(analysis.chunks.some((chunk) => chunk.role === 'arabizi')).toBe(true)
    expect(analysis.chunks.some((chunk) => chunk.role === 'english_prose')).toBe(true)
    expect(decision.action).not.toBe('translation')
  })

  it('9. agent007 is not Arabizi', () => {
    expect(looksLikeArabizi('agent007')).toBe(false)
    const { analysis } = run('agent007')
    expect(analysis.chunks.every((chunk) => chunk.role !== 'arabizi')).toBe(true)
  })

  it('10. URL is protected', () => {
    const { analysis, hypotheses } = run('https://example.com/api/v1')
    expect(analysis.chunks.some((chunk) => chunk.role === 'url' || chunk.protectedKind === 'url')).toBe(true)
    expect(hypotheses.every((item) => item.intent !== 'fix_layout')).toBe(true)
  })

  it('11. file.txt is identifier/protected', () => {
    const { analysis } = run('file.txt')
    expect(analysis.chunks.some((chunk) => chunk.role === 'identifier' || chunk.protectedKind)).toBe(true)
  })

  it('12. API is preserved', () => {
    const { hypotheses, decision } = run('API')
    expect(hypotheses.some((item) => item.intent === 'preserve')).toBe(true)
    expect(decision.action).toBe('noop')
  })

  it('13. Api is uncertain and not auto-cased', () => {
    const { decision, hypotheses } = run('Api')
    expect(decision.action).not.toBe('english_correction')
    expect(hypotheses.some((item) => item.replacement === 'API')).toBe(false)
  })

  it('14. userName is an identifier', () => {
    const { analysis } = run('userName')
    expect(analysis.chunks.some((chunk) => chunk.role === 'identifier')).toBe(true)
  })

  it('15. email is protected', () => {
    const { analysis } = run('user@example.com')
    expect(analysis.chunks.some((chunk) => chunk.role === 'email')).toBe(true)
  })

  it('16. Arabic + English + punctuation keeps span roles', () => {
    const { analysis } = run('مرحبا، this is API.')
    expect(analysis.hasAmbiguousMixed).toBe(true)
    expect(analysis.chunks.length).toBeGreaterThan(1)
  })

  it('17. Arabic + English + numbers', () => {
    const { analysis } = run('النسخة 123 جاهزة')
    expect(analysis.chunks.some((chunk) => chunk.role === 'number' || chunk.protectedKind === 'digits')).toBe(true)
  })

  it('18. wrong-layout token + intentional English', () => {
    const { hypotheses, decision } = run('hello نثغ')
    expect(hypotheses.some((item) => item.intent === 'write_as_is' || item.intent === 'preserve')).toBe(true)
    expect(decision.action).not.toBe('english_correction')
  })

  it('19. user edits AI output become user_override', () => {
    const ta = textarea('hello')
    const session = new FieldSession(ta)
    session.noteEngineSpan(0, 5, 'hello')
    session.bumpGeneration()
    ta.value = 'hallo'
    session.detectUserOverride(ta.value)
    expect(session.getOverrideRanges().length).toBeGreaterThan(0)
    const analysis = analyzeFieldText(ta.value, { overrideRanges: [...session.getOverrideRanges()] })
    expect(analysis.chunks.some((chunk) => chunk.role === 'user_override')).toBe(true)
  })

  it('20. LLM unavailable falls back safely', async () => {
    setHypothesisAdvisor(async () => {
      throw new Error('network')
    })
    const { hypotheses, context } = run('design engain')
    const consulted = await consultAdvisor(context, hypotheses)
    expect(consulted.result).toBe('unavailable')
    const decision = decideWriting(context, analyzeFieldText('design engain'), candidatesFromHypotheses(hypotheses), {
      observeOnly: false,
      hypotheses,
      advisorResult: 'unavailable',
    })
    expect(decision.action).not.toBe('layout_fix')
    expect(['noop', 'suggestion']).toContain(decision.action)
  })

  it('21. LLM malformed output abstains', () => {
    const hyps = run('design engain').hypotheses
    expect(validateAdvisorVote({ rankedHypothesisIds: [] }, hyps).ok).toBe(false)
  })

  it('22. LLM unknown hypothesis id is invalid', () => {
    const hyps = run('design engain').hypotheses
    expect(
      validateAdvisorVote(
        { rankedHypothesisIds: ['does-not-exist'], reasonCode: 'x', ambiguityClass: 'y' },
        hyps,
      ).ok,
    ).toBe(false)
  })

  it('23. two conflicting hypotheses are represented', () => {
    const { hypotheses } = run('hsjo]lj')
    expect(hypotheses.filter((item) => item.intent === 'fix_layout' || item.intent === 'write_as_is' || item.intent === 'preserve').length).toBeGreaterThan(1)
  })

  it('24. empty field has no plausible action hypotheses', () => {
    const { hypotheses, decision } = run('   ')
    expect(hypotheses.every((item) => !item.candidateAction)).toBe(true)
    expect(decision.action).toBe('noop')
  })

  it('25. composition active is noop', () => {
    const { decision } = run('hsjo]lj', { composing: true })
    expect(decision.action).toBe('noop')
    expect(decision.reasonCodes).toContain('composing')
  })

  it('26. paste is conservative', () => {
    const { decision } = run('hsjo]lj pasted paragraph here', { inputSource: 'paste' })
    expect(decision.action).toBe('noop')
    expect(decision.reasonCodes).toContain('paste_conservative')
  })

  it('27. selection is recorded as a span', () => {
    const { hypotheses } = run('hello world', { selection: { start: 0, end: 5 } })
    expect(hypotheses.some((item) => item.evidence.some((entry) => entry.kind === 'selection'))).toBe(true)
  })

  it('does not consult an advisor on a single obvious mechanical layout', () => {
    const { hypotheses } = run('hsjo]lj')
    const onlyLayout = hypotheses.filter((item) => item.intent === 'fix_layout' && !item.needsLLM)
    expect(shouldConsultAdvisor(onlyLayout)).toBe(false)
  })

  it('advisor cannot invent replacements', () => {
    const hyps = run('نثغ').hypotheses
    expect(
      validateAdvisorVote(
        {
          rankedHypothesisIds: [hyps[0]!.id],
          reasonCode: 'ok',
          ambiguityClass: 'layout',
          replacement: 'injected',
        },
        hyps,
      ).ok,
    ).toBe(false)
  })
})

describe('golden intent set', () => {
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
  })

  it(`covers ${GOLDEN_INTENT_CASES.length} real-world cases`, () => {
    expect(GOLDEN_INTENT_CASES.length).toBeGreaterThanOrEqual(100)
    for (const item of GOLDEN_INTENT_CASES) {
      const { analysis, hypotheses, decision } = run(item.input)
      if (item.expect.hasRole) {
        expect(analysis.chunks.some((chunk) => chunk.role === item.expect.hasRole), item.id).toBe(true)
      }
      if (item.expect.hasHypIntent) {
        expect(hypotheses.some((hyp) => hyp.intent === item.expect.hasHypIntent), item.id).toBe(true)
      }
      if (item.expect.forbiddenAction) {
        expect(decision.action, item.id).not.toBe(item.expect.forbiddenAction)
      }
      if (item.expect.action) {
        expect(decision.action, item.id).toBe(item.expect.action)
      }
      if (item.expect.arabizi) {
        expect(analysis.chunks.some((chunk) => chunk.role === 'arabizi'), item.id).toBe(true)
      }
      if (item.expect.notArabizi) {
        expect(analysis.chunks.every((chunk) => chunk.role !== 'arabizi'), item.id).toBe(true)
      }
      if (item.expect.protected) {
        expect(analysis.hasProtected || analysis.chunks.some((chunk) => chunk.role === 'protected' || chunk.role === 'url' || chunk.role === 'email'), item.id).toBe(true)
      }
    }
  })
})
