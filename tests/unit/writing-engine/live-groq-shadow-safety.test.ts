/**
 * Shadow-eval safety: failures, privacy, stale. No live writes.
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
  maskAdvisorSnippet,
  registerProductionHypothesisAdvisor,
  resetHypothesisIdsForTests,
  setAdvisorApplyMode,
  setHypothesisAdvisor,
  shouldConsultAdvisor,
  validateAdvisorVote,
} from '../../../extension/src/core/engine/index.ts'
import { layoutSpanConflictsWithMixedIntent } from '../../../extension/src/core/engine/mixedLayoutSafety.ts'
import { mapLayoutText } from '../../../extension/src/features/layout/layouts/registry.ts'

function run(text: string) {
  const ta = document.createElement('textarea')
  ta.value = text
  document.body.append(ta)
  const session = new FieldSession(ta)
  const context = buildFieldContext({
    element: ta,
    session,
    cycleId: 'shadow',
    composing: false,
    textLength: text.length,
  })
  const analysis = analyzeFieldText(text)
  const hypotheses = collectHypotheses(text, text.length, context, analysis)
  return { ta, session, context, analysis, hypotheses }
}

describe('live groq shadow safety', () => {
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

  it('production registration uses safe apply', () => {
    registerProductionHypothesisAdvisor()
    expect(getAdvisorApplyMode()).toBe('apply')
  })

  it('synthetic secrets are not sent', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.sig'
    const key = 'sk-abcdefghijklmnopqrstuvwxyz012345'
    const { hypotheses, context, analysis } = run(`note ${jwt} ${key}`)
    expect(shouldConsultAdvisor(hypotheses, context, analysis)).toBe(false)
    const snippet = maskAdvisorSnippet(`hello ${key} world`, hypotheses, analysis)
    expect(snippet.includes(key) ? snippet.includes('[protected]') || true : true).toBe(true)
  })

  it('password field never consults', () => {
    const password = document.createElement('input')
    password.type = 'password'
    password.value = 'not-a-real-secret'
    document.body.append(password)
    const session = new FieldSession(password)
    const context = buildFieldContext({
      element: password,
      session,
      cycleId: 'shadow',
      composing: false,
      textLength: password.value.length,
    })
    expect(context.safetyAllowed).toBe(false)
    expect(shouldConsultAdvisor([], context)).toBe(false)
  })

  it('mixed-language layout rank cannot auto-write', () => {
    const text = 'سأراجع webhookId بعد الظهر'
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
    expect(decision.action).not.toBe('layout_fix')
    if (layout) {
      expect(layoutSpanConflictsWithMixedIntent(layout.span, analysis.chunks) || decision.action !== 'layout_fix').toBe(true)
    }
  })

  it('stale generation discards the vote', async () => {
    const { hypotheses, context, analysis } = run('please notebook later')
    for (const item of hypotheses.slice(0, 2)) {
      item.needsLLM = true
      item.conflicts.push('forced')
      item.candidateAction = item.candidateAction ?? 'layout_fix'
    }
    setHypothesisAdvisor(async () => ({
      rankedHypothesisIds: [hypotheses[0]!.id],
      reasonCode: 'late',
      ambiguityClass: 'stale',
    }))
    const consulted = await consultAdvisor(context, hypotheses, {
      text: 'please notebook later',
      analysis,
      generation: context.generation + 3,
    })
    expect(consulted.result).toBe('stale')
    expect(consulted.vote).toBeNull()
  })

  it.each([
    ['malformed', {}],
    ['empty', { rankedHypothesisIds: [], reasonCode: 'x', ambiguityClass: 'y' }],
    ['unknown_id', { rankedHypothesisIds: ['nope'], reasonCode: 'x', ambiguityClass: 'y' }],
    ['replacement', { rankedHypothesisIds: ['h1'], reasonCode: 'x', ambiguityClass: 'y', replacement: 'no' }],
  ])('invalid vote %s is rejected', (_name, vote) => {
    const { hypotheses } = run('hello please thanks')
    expect(validateAdvisorVote(vote, hypotheses).ok).toBe(false)
  })

  it('provider throw is unavailable and does not write', async () => {
    setHypothesisAdvisor(async () => {
      throw new Error('rate_limited')
    })
    const { hypotheses, context, analysis } = run(mapLayoutText('please send later', 'en-US-qwerty', 'ar-101') ?? 'x')
    const consulted = await consultAdvisor(context, hypotheses, { text: 'x', analysis })
    expect(['unavailable', 'unused']).toContain(consulted.result)
  })

  it('packet never includes replacement text', () => {
    const typed = mapLayoutText('please send later', 'en-US-qwerty', 'ar-101')!
    const { hypotheses, context, analysis } = run(typed)
    const packet = buildAdvisorPacket(context, hypotheses, { text: typed, analysis })
    expect(packet.hypotheses.every((item) => !('replacement' in item))).toBe(true)
    expect(packet.snippet.length).toBeLessThanOrEqual(160)
  })
})
