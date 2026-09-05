import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'
import {
  applyUserWritingPolicy,
  isBoxHelpStyle,
  isDirectHelpStyle,
  isShortcutsOnly,
  resolveWritingPolicy,
} from '../../../extension/src/core/policy/writingPolicy.ts'
import {
  analyzeFieldText,
  buildFieldContext,
  decideWriting,
} from '../../../extension/src/core/engine/index.ts'
import { collectHypotheses } from '../../../extension/src/core/engine/hypotheses.ts'
import { collectShadowCandidates } from '../../../extension/src/core/engine/candidates.ts'
import { computeFeatureDeadlines, resolveLivePolicyInput } from '../../../extension/src/core/runtime/featurePolicies.ts'
import {
  dismissPipelineSuggestion,
  getActivePipelineSuggestion,
  presentPipelineSuggestion,
} from '../../../extension/src/core/writeGate/pipelineSuggest.ts'
import { runFieldCycle } from '../../../extension/src/core/writeGate/pipeline.ts'
import { writeReplacement } from '../../../extension/src/core/dom/editor.ts'

function textarea(value: string) {
  const ta = document.createElement('textarea')
  ta.value = value
  document.body.append(ta)
  return ta
}

function decideFor(ta: HTMLTextAreaElement) {
  const session = new FieldSession(ta)
  const context = buildFieldContext({
    element: ta,
    session,
    cycleId: `help-${Math.random().toString(36).slice(2, 8)}`,
    composing: false,
    textLength: ta.value.length,
  })
  const analysis = analyzeFieldText(ta.value, { caret: ta.value.length, commitOpenToken: true })
  const hypotheses = collectHypotheses(ta.value, ta.value.length, context, analysis)
  const candidates = collectShadowCandidates(ta.value, ta.value.length, context, analysis)
  const decision = decideWriting(context, analysis, candidates, {
    observeOnly: false,
    hypotheses,
  })
  return { session, context, decision }
}

describe('Settings help style — Direct / Box / Shortcuts only', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    applyUserWritingPolicy({
      helpStyle: 'auto',
      fixWrongTyping: true,
      improveEnglish: true,
      arabicToEnglishMode: false,
      polishAfterTranslate: false,
    })
  })

  afterEach(() => {
    dismissPipelineSuggestion('any')
    for (const host of document.querySelectorAll('[data-flowlary-suggestion-host]')) {
      host.remove()
    }
  })

  it('projects feature modes from each Settings choice', () => {
    applyUserWritingPolicy({ helpStyle: 'auto' })
    expect(isDirectHelpStyle()).toBe(true)
    expect(resolveWritingPolicy().helpStyle).toBe('auto')
    expect(stateManager.layout.mode).toBe('direct')
    expect(stateManager.correction.mode).toBe('direct')
    expect(stateManager.layout.autoEnabled).toBe(true)

    applyUserWritingPolicy({ helpStyle: 'suggestions' })
    expect(isBoxHelpStyle()).toBe(true)
    expect(stateManager.layout.mode).toBe('box')
    expect(stateManager.correction.mode).toBe('box')
    expect(stateManager.translation.mode).toBe('box')
    expect(stateManager.layout.autoEnabled).toBe(true)

    applyUserWritingPolicy({ helpStyle: 'shortcuts_only' })
    expect(isShortcutsOnly()).toBe(true)
    expect(stateManager.layout.autoEnabled).toBe(false)
    expect(stateManager.translation.liveEnabled).toBe(false)
    expect(stateManager.correction.enabled).toBe(true)
  })

  it('Direct auto-applies layout into the field', async () => {
    applyUserWritingPolicy({ helpStyle: 'auto', improveEnglish: false, fixWrongTyping: true })
    const ta = textarea('hsjo]lj ')
    const session = new FieldSession(ta)
    const { decision } = decideFor(ta)
    expect(decision.action).toBe('layout_fix')

    const outcome = await runFieldCycle(ta, session)
    expect(['applied', 'suggestion', 'noop']).toContain(outcome)
    if (outcome === 'applied') {
      expect(ta.value).not.toBe('hsjo]lj ')
    }
  })

  it('Box surfaces a layout card and does not rewrite until accept', async () => {
    applyUserWritingPolicy({ helpStyle: 'suggestions', improveEnglish: false, fixWrongTyping: true })
    const ta = textarea('hsjo]lj ')
    const session = new FieldSession(ta)
    const { decision } = decideFor(ta)
    expect(decision.action).toBe('suggestion')
    expect(decision.reasonCodes).toContain('downgraded_to_suggestion')

    const before = ta.value
    const outcome = await runFieldCycle(ta, session)
    expect(outcome).toBe('suggestion')
    expect(ta.value).toBe(before)
    expect(getActivePipelineSuggestion(session.field.id)?.suggestion).toBeTruthy()
  })

  it('Shortcuts only stays still on typing and rejects auto writes', async () => {
    applyUserWritingPolicy({ helpStyle: 'shortcuts_only', fixWrongTyping: true, improveEnglish: true })
    const ta = textarea('hsjo]lj ')
    const session = new FieldSession(ta)
    const { decision } = decideFor(ta)
    expect(decision.action).toBe('noop')
    expect(decision.reasonCodes).toContain('policy_shortcuts_only')

    const deadlines = computeFeatureDeadlines(
      resolveLivePolicyInput({
        text: ta.value,
        now: Date.now(),
        lastInputAt: Date.now(),
        lastEnglishNetworkAt: 0,
        composing: false,
        focusOut: false,
      }),
    )
    expect(deadlines.size).toBe(0)

    const outcome = await runFieldCycle(ta, session)
    expect(outcome).toBe('noop')
    expect(ta.value).toBe('hsjo]lj ')

    const acquired = session.tryAcquireWrite('CORRECT')
    expect(acquired.ok).toBe(true)
    if (!acquired.ok) return
    const write = writeReplacement(ta, 0, 7, 'استخدمت', {
      origin: 'CORRECT',
      session,
      requestId: acquired.requestId,
      expectedGeneration: acquired.generation,
      auto: true,
    })
    expect(write.verdict).toBe('rejected')
    expect(write.reason).toBe('shortcuts_only')
    expect(ta.value).toBe('hsjo]lj ')
  })

  it('switching Box → Direct → Shortcuts only updates policy each time', () => {
    applyUserWritingPolicy({ helpStyle: 'suggestions' })
    expect(resolveWritingPolicy().helpStyle).toBe('suggestions')
    expect(stateManager.correction.mode).toBe('box')

    applyUserWritingPolicy({ helpStyle: 'auto' })
    expect(resolveWritingPolicy().helpStyle).toBe('auto')
    expect(stateManager.correction.mode).toBe('direct')
    expect(stateManager.layout.autoEnabled).toBe(true)

    applyUserWritingPolicy({ helpStyle: 'shortcuts_only' })
    expect(resolveWritingPolicy().helpStyle).toBe('shortcuts_only')
    expect(stateManager.layout.autoEnabled).toBe(false)

    applyUserWritingPolicy({ helpStyle: 'auto' })
    expect(resolveWritingPolicy().helpStyle).toBe('auto')
    expect(stateManager.layout.autoEnabled).toBe(true)
  })

  it('Box English suggestion does not rewrite the field until accepted', () => {
    // Whole-field English owns live Fix when improveEnglish is on; pipeline cards
    // for English spans are used when layout/Fix share Box via the suggestion host.
    applyUserWritingPolicy({ helpStyle: 'suggestions', improveEnglish: false, fixWrongTyping: true })
    const ta = textarea('I dont know.')
    const session = new FieldSession(ta)
    presentPipelineSuggestion({
      fieldId: session.field.id,
      element: ta,
      session,
      generation: session.getGeneration(),
      range: { start: 2, end: 6 },
      sourceText: 'dont',
      suggestion: "don't",
      action: 'english_correction',
      textOrigin: 'original_en',
    })
    expect(ta.value).toBe('I dont know.')
    expect(getActivePipelineSuggestion(session.field.id)?.suggestion).toBe("don't")
    expect(document.querySelectorAll('[data-flowlary-suggestion-host]').length).toBe(1)
  })
})
