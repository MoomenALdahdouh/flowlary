import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'
import {
  analyzeFieldText,
  collectShadowCandidates,
  buildFieldContext,
  decideWriting,
  resetWritingReviewForTests,
  setWritingReview,
} from '../../../extension/src/core/engine/index.ts'
import { applyUserWritingPolicy } from '../../../extension/src/core/policy/writingPolicy.ts'
import { runFieldCycle } from '../../../extension/src/core/writeGate/pipeline.ts'
import { setPipelineTranslateFnForTests } from '../../../extension/src/core/writeGate/pipelineTranslate.ts'
import {
  applyPipelineSuggestion,
  dismissPipelineSuggestion,
  getActivePipelineSuggestion,
  presentPipelineSuggestion,
  resetPipelineSuggestionsForTests,
} from '../../../extension/src/core/writeGate/pipelineSuggest.ts'
import {
  resetPipelineEnglishForTests,
  runExplicitEnglishAssist,
  setPipelineEnglishDebounceMsForTests,
} from '../../../extension/src/core/writeGate/pipelineEnglish.ts'
import * as writeGate from '../../../extension/src/core/writeGate/writeGate.ts'
import {
  clearWritingAnalytics,
  getWritingAnalyticsSnapshot,
} from '../../../extension/src/core/observability/writingAnalytics.ts'

const ARABIC_SENTENCE = 'أريد إرسال هذا البريد غدًا.'
const MIXED = 'أنا عملت deploy لكن فيه error'
const REMOTE_SOURCE = 'The team are going home today.'

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

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

async function flushRemote(): Promise<void> {
  await new Promise((r) => setTimeout(r, 15))
}

describe('N3 unified English assist', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    clearWritingAnalytics()
    resetPipelineSuggestionsForTests()
    resetPipelineEnglishForTests()
    setPipelineEnglishDebounceMsForTests(0)
    stateManager.correction.consentAccepted = true
    stateManager.settings.excludedDomains = []
    policy('auto')
    setPipelineTranslateFnForTests(async (text) => ({ ok: true, translation: `EN:${text}` }))
  })

  afterEach(() => {
    resetPipelineSuggestionsForTests()
    resetPipelineEnglishForTests()
    resetWritingReviewForTests()
    setPipelineTranslateFnForTests(null)
    stateManager.settings.helpStyle = null
    stateManager.settings.fixWrongTyping = null
    stateManager.settings.improveEnglish = null
    stateManager.settings.arabicToEnglishMode = null
    stateManager.settings.polishAfterTranslate = null
    stateManager.settings.improveEnglishAfterTranslate = null
    stateManager.settings.excludedDomains = []
    stateManager.translation.liveEnabled = false
    stateManager.layout.autoEnabled = true
    stateManager.layout.mode = 'direct'
    stateManager.correction.mode = 'direct'
    stateManager.correction.consentAccepted = false
    vi.restoreAllMocks()
  })

  it('1. original English simple typo auto-corrects when allowed', async () => {
    const ta = textarea('I dont know.')
    const session = new FieldSession(ta)
    const result = await runFieldCycle(ta, session)
    expect(result).toBe('applied')
    expect(ta.value).toBe("I don't know.")
  })

  it('2. suggestions mode shows a card and does not write', async () => {
    policy('suggestions')
    const ta = textarea('I dont know.')
    const session = new FieldSession(ta)
    const result = await runFieldCycle(ta, session)
    expect(result).toBe('suggestion')
    expect(ta.value).toBe('I dont know.')
    expect(getActivePipelineSuggestion(session.field.id)?.suggestion).toBe("don't")
    expect(document.querySelectorAll('[data-flowlary-suggestion-host]').length).toBe(1)
  })

  it('3. suggestion Apply goes through the Write Gate', async () => {
    policy('suggestions')
    const spy = vi.spyOn(writeGate, 'commitWriteTransaction')
    const ta = textarea('I dont know.')
    const session = new FieldSession(ta)
    await runFieldCycle(ta, session)
    expect(applyPipelineSuggestion(session.field.id)).toBe('applied')
    expect(ta.value).toBe("I don't know.")
    expect(spy).toHaveBeenCalled()
    expect(spy.mock.calls.some((call) => call[4]?.trigger === 'suggestion_accept')).toBe(true)
  })

  it('4. suggestion Dismiss does not write', async () => {
    policy('suggestions')
    const ta = textarea('I dont know.')
    const session = new FieldSession(ta)
    await runFieldCycle(ta, session)
    expect(dismissPipelineSuggestion(session.field.id)).toBe('dismissed')
    expect(ta.value).toBe('I dont know.')
    expect(getActivePipelineSuggestion(session.field.id)).toBeNull()
  })

  it('5. stale suggestion cannot apply', async () => {
    policy('suggestions')
    const ta = textarea('I dont know.')
    const session = new FieldSession(ta)
    await runFieldCycle(ta, session)
    ta.value = 'I changed this sentence.'
    expect(applyPipelineSuggestion(session.field.id)).toBe('stale')
    expect(ta.value).toBe('I changed this sentence.')
  })

  it('6. layout suspicion blocks English correction', async () => {
    const ta = textarea('hsjo]lj ')
    const session = new FieldSession(ta)
    const context = buildFieldContext({
      element: ta,
      session,
      cycleId: 'layout',
      composing: false,
      textLength: ta.value.length,
    })
    const analysis = analyzeFieldText(ta.value)
    const candidates = collectShadowCandidates(ta.value, ta.value.length, context, analysis)
    const decision = decideWriting(context, analysis, candidates, { observeOnly: false })
    expect(decision.action).not.toBe('english_correction')
    if (analysis.hasLayoutSuspicion || candidates.some((item) => item.capability === 'layout_fix')) {
      expect(decision.blockedCandidateCapabilities).toContain('english_correction')
    }
    await runFieldCycle(ta, session)
    expect(ta.value).not.toContain('how')
  })

  it('7. shortcuts_only does not auto-write English', async () => {
    policy('shortcuts_only')
    const ta = textarea('I dont know.')
    const session = new FieldSession(ta)
    expect(await runFieldCycle(ta, session)).toBe('noop')
    expect(ta.value).toBe('I dont know.')
  })

  it('8. English shortcut uses the Write Gate', async () => {
    policy('shortcuts_only')
    const spy = vi.spyOn(writeGate, 'commitWriteTransaction')
    const ta = textarea('I dont know.')
    const session = new FieldSession(ta)
    expect(await runExplicitEnglishAssist(ta, session)).toBe('applied')
    expect(ta.value).toBe("I don't know.")
    expect(spy).toHaveBeenCalled()
    expect(spy.mock.calls.some((call) => call[4]?.trigger === 'shortcut')).toBe(true)
  })

  it('9. translated output is not rewritten when polish is off', async () => {
    applyUserWritingPolicy({
      helpStyle: 'auto',
      fixWrongTyping: true,
      improveEnglish: true,
      arabicToEnglishMode: true,
      polishAfterTranslate: false,
    })
    setPipelineTranslateFnForTests(async () => ({ ok: true, translation: 'I dont know.' }))
    const ta = textarea(ARABIC_SENTENCE)
    const session = new FieldSession(ta)
    await runFieldCycle(ta, session)
    expect(ta.value).toBe('I dont know.')
    session.enterCooldown(0)
    expect(await runFieldCycle(ta, session)).toBe('noop')
    expect(ta.value).toBe('I dont know.')
  })

  it('10. translated output may polish only after cooldown when enabled', async () => {
    applyUserWritingPolicy({
      helpStyle: 'auto',
      fixWrongTyping: true,
      improveEnglish: true,
      arabicToEnglishMode: true,
      polishAfterTranslate: true,
    })
    setPipelineTranslateFnForTests(async () => ({ ok: true, translation: 'I dont know.' }))
    const ta = textarea(ARABIC_SENTENCE)
    const session = new FieldSession(ta)
    await runFieldCycle(ta, session)
    expect(ta.value).toBe('I dont know.')
    expect(session.isInCooldown()).toBe(true)
    expect(await runFieldCycle(ta, session)).toBe('noop')
    expect(ta.value).toBe('I dont know.')
    session.enterCooldown(0)
    const result = await runFieldCycle(ta, session)
    expect(result).toBe('applied')
    expect(ta.value).toBe("I don't know.")
  })

  it('11. mixed ambiguous input suppresses English correction', async () => {
    const ta = textarea(MIXED)
    const session = new FieldSession(ta)
    const context = buildFieldContext({
      element: ta,
      session,
      cycleId: 'mixed',
      composing: false,
      textLength: ta.value.length,
    })
    const analysis = analyzeFieldText(ta.value)
    expect(analysis.hasAmbiguousMixed).toBe(true)
    const decision = decideWriting(
      context,
      analysis,
      collectShadowCandidates(ta.value, ta.value.length, context, analysis),
      { observeOnly: false },
    )
    expect(decision.action).not.toBe('english_correction')
    await runFieldCycle(ta, session)
    expect(ta.value).toBe(MIXED)
  })

  it('12. Arabizi suppresses English correction', async () => {
    const ta = textarea('mar7aba')
    const session = new FieldSession(ta)
    const analysis = analyzeFieldText(ta.value)
    expect(analysis.hasArabizi).toBe(true)
    const context = buildFieldContext({
      element: ta,
      session,
      cycleId: 'arabizi',
      composing: false,
      textLength: ta.value.length,
    })
    const decision = decideWriting(
      context,
      analysis,
      collectShadowCandidates(ta.value, ta.value.length, context, analysis),
      { observeOnly: false },
    )
    expect(decision.action).not.toBe('english_correction')
  })

  it('13. password fields are not written', async () => {
    const input = document.createElement('input')
    input.type = 'password'
    input.value = 'I dont know.'
    document.body.append(input)
    const session = new FieldSession(input)
    expect(await runFieldCycle(input, session)).toBe('noop')
    expect(input.value).toBe('I dont know.')
  })

  it('14. excluded sites are not written', async () => {
    const host = location.hostname || 'localhost'
    Object.defineProperty(location, 'hostname', { configurable: true, value: host || 'blocked.test' })
    stateManager.settings.excludedDomains = [location.hostname]
    const ta = textarea('I dont know.')
    const session = new FieldSession(ta)
    expect(await runFieldCycle(ta, session)).toBe('noop')
    expect(ta.value).toBe('I dont know.')
  })

  it('15. missing LLM configuration fails safely', async () => {
    resetWritingReviewForTests()
    setWritingReview(async () => {
      throw new Error('network')
    })
    const ta = textarea(REMOTE_SOURCE)
    const session = new FieldSession(ta)
    await runFieldCycle(ta, session)
    await flushRemote()
    expect(ta.value).toBe(REMOTE_SOURCE)
    expect(getActivePipelineSuggestion(session.field.id)).toBeNull()
  })

  it('16. LLM result cannot overwrite newer user text', async () => {
    const pending = deferred<{
      verdict: 'edits'
      ambiguityClass: string
      reasonCode: string
      edits: Array<{
        start: number
        end: number
        original: string
        proposed: string
        kind: 'spelling'
        confidence: 'high'
      }>
    }>()
    setWritingReview(() => pending.promise)
    const ta = textarea(REMOTE_SOURCE)
    const session = new FieldSession(ta)
    await runFieldCycle(ta, session)
    ta.value = 'Newer user text that should stay put.'
    session.bumpGeneration()
    pending.resolve({
      verdict: 'edits',
      ambiguityClass: 'english_island',
      reasonCode: 'spelling',
      edits: [{
        start: 0,
        end: REMOTE_SOURCE.length,
        original: REMOTE_SOURCE,
        proposed: 'SHOULD NOT APPLY THIS TEXT',
        kind: 'spelling',
        confidence: 'high',
      }],
    })
    await flushRemote()
    expect(ta.value).toBe('Newer user text that should stay put.')
    expect(getActivePipelineSuggestion(session.field.id)).toBeNull()
  })

  it('17. only one active suggestion per field', async () => {
    const ta = textarea('I dont know.')
    const session = new FieldSession(ta)
    presentPipelineSuggestion({
      fieldId: session.field.id,
      element: ta,
      session,
      generation: session.getGeneration(),
      range: { start: 0, end: ta.value.length },
      sourceText: ta.value,
      suggestion: 'first',
      action: 'english_correction',
      textOrigin: 'original_en',
    })
    presentPipelineSuggestion({
      fieldId: session.field.id,
      element: ta,
      session,
      generation: session.getGeneration(),
      range: { start: 0, end: ta.value.length },
      sourceText: ta.value,
      suggestion: 'second',
      action: 'english_correction',
      textOrigin: 'original_en',
    })
    expect(getActivePipelineSuggestion(session.field.id)?.suggestion).toBe('second')
    expect(document.querySelectorAll('[data-flowlary-suggestion-host]').length).toBe(1)
  })

  it('18. analytics records origin and outcome without raw text', async () => {
    policy('suggestions')
    const ta = textarea('I dont know.')
    const session = new FieldSession(ta)
    await runFieldCycle(ta, session)
    applyPipelineSuggestion(session.field.id)
    const snapshot = getWritingAnalyticsSnapshot()
    const serialized = JSON.stringify(snapshot)
    expect(serialized).not.toContain('dont')
    expect(serialized).not.toContain("don't")
    expect(snapshot.some((event) => event.action === 'english_correction')).toBe(true)
    expect(snapshot.some((event) => event.trigger === 'suggestion_accept')).toBe(true)
    expect(snapshot.some((event) => event.outcome === 'applied' || event.outcome === 'suggestion')).toBe(
      true,
    )
    expect(snapshot.every((event) => event.textOrigin !== 'translated_en')).toBe(true)
  })
})
