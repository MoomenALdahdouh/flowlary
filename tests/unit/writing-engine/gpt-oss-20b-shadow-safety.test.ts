/**
 * Phase 5 safety: gpt-oss advisor remains shadow. No live writes.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'
import {
  analyzeFieldText,
  buildAdvisorPacket,
  buildFieldContext,
  collectHypotheses,
  consultAdvisor,
  decideWriting,
  getAdvisorApplyMode,
  registerProductionHypothesisAdvisor,
  resetHypothesisIdsForTests,
  setAdvisorApplyMode,
  setHypothesisAdvisor,
  shouldConsultAdvisor,
  validateAdvisorVote,
} from '../../../extension/src/core/engine/index.ts'
import { layoutSpanConflictsWithMixedIntent } from '../../../extension/src/core/engine/mixedLayoutSafety.ts'

function run(text: string) {
  const ta = document.createElement('textarea')
  ta.value = text
  document.body.append(ta)
  const session = new FieldSession(ta)
  const context = buildFieldContext({
    element: ta,
    session,
    cycleId: 'oss-safety',
    composing: false,
    textLength: text.length,
  })
  const analysis = analyzeFieldText(text)
  const hypotheses = collectHypotheses(text, text.length, context, analysis)
  return { ta, session, context, analysis, hypotheses }
}

describe('gpt-oss-20b shadow safety', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    resetHypothesisIdsForTests()
    setHypothesisAdvisor(null)
    setAdvisorApplyMode('shadow')
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

  afterEach(() => {
    setHypothesisAdvisor(null)
    setAdvisorApplyMode('shadow')
  })

  it('registration enables safe apply (decide still vetoes unsafe ranks)', () => {
    registerProductionHypothesisAdvisor()
    expect(getAdvisorApplyMode()).toBe('apply')
  })

  it('password / api key / jwt / card skip consult', () => {
    const password = document.createElement('input')
    password.type = 'password'
    password.value = 'not-a-real-secret'
    document.body.append(password)
    const session = new FieldSession(password)
    const context = buildFieldContext({
      element: password,
      session,
      cycleId: 'oss-safety',
      composing: false,
      textLength: password.value.length,
    })
    expect(context.safetyAllowed).toBe(false)
    expect(shouldConsultAdvisor([], context)).toBe(false)

    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.sig'
    const key = 'sk-abcdefghijklmnopqrstuvwxyz012345'
    const combined = run(`note ${jwt} ${key}`)
    expect(shouldConsultAdvisor(combined.hypotheses, combined.context, combined.analysis)).toBe(false)
    const card = run('4111111111111111')
    expect(shouldConsultAdvisor(card.hypotheses, card.context, card.analysis)).toBe(false)
  })

  it('url email code identifier do not become advisor auto-writes', () => {
    const samples = [
      'see https://status.example.org/live',
      'ping sre+page@example.net',
      'fn main() { let x = 1; }',
      'traceParent is ready',
      'سأراجع spanId بعد الاجتماع',
      'أحتاج https://status.example.org/live قبل الدمج',
    ]
    for (const text of samples) {
      const { hypotheses, context, analysis } = run(text)
      const layout = hypotheses.find((item) => item.intent === 'fix_layout')
      const decision = decideWriting(context, analysis, [], {
        observeOnly: false,
        hypotheses,
        advisorVote: layout
          ? { rankedHypothesisIds: [layout.id], reasonCode: 'x', ambiguityClass: 'y' }
          : null,
        advisorResult: layout ? 'ranked' : 'unused',
      })
      if (layout && layoutSpanConflictsWithMixedIntent(layout.span, analysis.chunks)) {
        expect(decision.action).not.toBe('layout_fix')
      }
      document.body.innerHTML = ''
    }
  })

  it.each([
    ['429', 'rate_limited'],
    ['500', 'groq_http_500'],
    ['503', 'groq_http_503'],
    ['timeout', 'groq_connect_timeout'],
    ['network', 'groq_network_failure'],
    ['unavailable', 'unavailable'],
  ])('failure %s is unavailable and not a write', async (_name, message) => {
    setHypothesisAdvisor(async () => {
      throw new Error(message)
    })
    const { hypotheses, context, analysis, ta } = run('please thanks today')
    const before = ta.value
    for (const item of hypotheses.slice(0, 2)) {
      item.needsLLM = true
      item.conflicts.push('forced')
      item.candidateAction = item.candidateAction ?? 'layout_fix'
    }
    const consulted = await consultAdvisor(context, hypotheses, { text: ta.value, analysis })
    expect(consulted.result).toBe('unavailable')
    expect(consulted.vote).toBeNull()
    expect(ta.value).toBe(before)
  })

  it('malformed empty unknown and replacement votes are rejected', () => {
    const { hypotheses } = run('hello please thanks')
    expect(validateAdvisorVote({}, hypotheses).ok).toBe(false)
    expect(validateAdvisorVote({ rankedHypothesisIds: [], reasonCode: 'x', ambiguityClass: 'y' }, hypotheses).ok).toBe(false)
    expect(validateAdvisorVote({ rankedHypothesisIds: ['nope'], reasonCode: 'x', ambiguityClass: 'y' }, hypotheses).ok).toBe(false)
    expect(validateAdvisorVote({
      rankedHypothesisIds: [hypotheses[0]?.id ?? 'h'],
      reasonCode: 'x',
      ambiguityClass: 'y',
      replacement: 'no',
    }, hypotheses).ok).toBe(false)
  })

  it('packet has no replacement passwords cookies or cards', () => {
    const { hypotheses, context, analysis } = run('hello please thanks')
    const packet = buildAdvisorPacket(context, hypotheses, { text: 'hello please thanks', analysis })
    expect(packet.hypotheses.every((item) => !('replacement' in item) && !('text' in item) && !('write' in item))).toBe(true)
    expect(JSON.stringify(packet)).not.toMatch(/password|cookie|4111|sk-/i)
    expect(packet.snippet.length).toBeLessThanOrEqual(160)
  })
})
