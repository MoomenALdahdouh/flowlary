import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'
import {
  analyzeFieldText,
  buildFieldContext,
  decideWriting,
} from '../../../extension/src/core/engine/index.ts'
import { collectHypotheses } from '../../../extension/src/core/engine/hypotheses.ts'
import { collectShadowCandidates } from '../../../extension/src/core/engine/candidates.ts'
import { shouldConsultAdvisor } from '../../../extension/src/core/engine/advisor.ts'
import { applyUserWritingPolicy } from '../../../extension/src/core/policy/writingPolicy.ts'
import { dismissPipelineSuggestion, presentPipelineSuggestion } from '../../../extension/src/core/writeGate/pipelineSuggest.ts'
import { runFieldCycle } from '../../../extension/src/core/writeGate/pipeline.ts'
import { applyLayoutSpansToText, inferLayoutSpans } from '../../../extension/src/core/engine/layoutSequence.ts'

function textarea(value: string) {
  const ta = document.createElement('textarea')
  ta.value = value
  document.body.append(ta)
  return ta
}

function policy(
  helpStyle: 'auto' | 'suggestions' | 'shortcuts_only',
  extra: Parameters<typeof applyUserWritingPolicy>[0] = {},
) {
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
    cycleId: `sc-${Math.random().toString(36).slice(2, 8)}`,
    composing: false,
    textLength: ta.value.length,
  })
  const analysis = analyzeFieldText(ta.value, {
    translatedRanges: [...session.getTranslatedRanges()],
    correctedRanges: [...session.getCorrectedRanges()],
    overrideRanges: [...session.getOverrideRanges()],
    caret: ta.value.length,
  })
  const hypotheses = collectHypotheses(ta.value, ta.value.length, context, analysis)
  const candidates = collectShadowCandidates(ta.value, ta.value.length, context, analysis)
  const decision = decideWriting(context, analysis, candidates, {
    observeOnly: false,
    hypotheses,
  })
  return { context, analysis, hypotheses, candidates, decision }
}

describe('writing scenario classes', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    policy('auto')
  })

  afterEach(() => {
    stateManager.settings.helpStyle = 'auto'
    stateManager.settings.arabicToEnglishMode = false
    stateManager.translation.liveEnabled = false
  })

  it('wrong-keyboard Latin sequence prefers layout, not English typo', () => {
    const ta = textarea('hsjo]lj ')
    const session = new FieldSession(ta)
    const { decision } = decideFor(ta, session)
    expect(decision.action).toBe('layout_fix')
    expect(decision.blockedCandidateCapabilities).toContain('english_correction')
  })

  it('intentional English inside Arabic does not garbage-remap', () => {
    const ta = textarea('أنا عملت deploy لكن فيه error ')
    const session = new FieldSession(ta)
    const { decision } = decideFor(ta, session)
    expect(decision.action === 'layout_fix').toBe(false)
    expect(
      decision.action === 'noop'
      || decision.action === 'suggestion'
      || decision.reasonCodes.includes('mixed_intent_blocks_auto_layout'),
    ).toBe(true)
  })

  it('unfinished composing never auto-writes', () => {
    const ta = textarea('hello')
    const session = new FieldSession(ta)
    session.setComposing(true)
    const { decision } = decideFor(ta, session)
    expect(decision.action).toBe('noop')
    expect(decision.reasonCodes).toContain('composing')
  })

  it('paste is conservative', () => {
    const ta = textarea('hsjo]lj ')
    const session = new FieldSession(ta)
    session.noteInputSource('paste')
    const { decision } = decideFor(ta, session)
    expect(decision.action).toBe('noop')
    expect(decision.reasonCodes).toContain('paste_conservative')
  })

  it('translation session off + Arabic script does not translate', () => {
    policy('auto', { arabicToEnglishMode: false })
    const ta = textarea('أريد إرسال هذا البريد غدا ')
    const session = new FieldSession(ta)
    const { decision } = decideFor(ta, session)
    expect(decision.action).toBe('noop')
    expect(decision.action).not.toBe('translation')
  })

  it('translation session on does not also auto-correct English', () => {
    policy('auto', { arabicToEnglishMode: true })
    const ta = textarea('أريد إرسال هذا ')
    const session = new FieldSession(ta)
    session.ensureTranslationSession()
    const { decision } = decideFor(ta, session)
    if (decision.action === 'translation') {
      expect(decision.blockedCandidateCapabilities).toContain('english_correction')
    }
    expect(decision.action).not.toBe('english_correction')
  })

  it('shortcuts_only produces zero auto writes', () => {
    policy('shortcuts_only')
    const ta = textarea('hsjo]lj ')
    const session = new FieldSession(ta)
    const { decision } = decideFor(ta, session)
    expect(decision.action).toBe('noop')
    expect(decision.reasonCodes).toContain('policy_shortcuts_only')
  })

  it('user override after reject is not re-applied', () => {
    const ta = textarea('hello world')
    const session = new FieldSession(ta)
    session.noteUserOverride(0, 5)
    const { decision, hypotheses } = decideFor(ta, session)
    expect(hypotheses.some((item) => item.intent === 'user_override')).toBe(true)
    expect(decision.action === 'layout_fix' && decision.range && decision.range.start < 5).toBe(false)
  })

  it('dismissed suggestion records override memory', () => {
    const ta = textarea('teh ')
    const session = new FieldSession(ta)
    presentPipelineSuggestion({
      fieldId: session.field.id,
      element: ta,
      session,
      generation: session.getGeneration(),
      range: { start: 0, end: 3 },
      sourceText: 'teh',
      suggestion: 'the',
      action: 'english_correction',
      textOrigin: 'original_en',
    })
    expect(dismissPipelineSuggestion(session.field.id)).toBe('dismissed')
    expect(session.getOverrideRanges().some((range) => range.start === 0 && range.end === 3)).toBe(true)
  })

  it('advisor consults mixed layout vs translation, not strong unique layout', () => {
    policy('auto', { arabicToEnglishMode: true })
    const mixed = textarea('أنا عملت deploy ')
    const mixedSession = new FieldSession(mixed)
    mixedSession.ensureTranslationSession()
    const mixedDecided = decideFor(mixed, mixedSession)
    expect(
      shouldConsultAdvisor(mixedDecided.hypotheses, mixedDecided.context, mixedDecided.analysis)
      || mixedDecided.decision.action !== 'layout_fix',
    ).toBe(true)

    policy('auto', { arabicToEnglishMode: false })
    const layout = textarea('hsjo]lj ')
    const layoutSession = new FieldSession(layout)
    const layoutDecided = decideFor(layout, layoutSession)
    expect(shouldConsultAdvisor(layoutDecided.hypotheses, layoutDecided.context, layoutDecided.analysis)).toBe(false)
  })

  it('contenteditable can take the same auto layout decision as a textarea', () => {
    const el = document.createElement('div')
    el.contentEditable = 'true'
    el.textContent = 'hsjo]lj '
    document.body.append(el)
    const session = new FieldSession(el)
    const context = buildFieldContext({
      element: el,
      session,
      cycleId: 'ce',
      composing: false,
      textLength: el.textContent.length,
    })
    expect(context.editorTier).toBe(2)
    expect(context.capabilities.autoWrite).toBe(true)
    expect(context.capabilities.manualShortcut).toBe(true)
    const analysis = analyzeFieldText(el.textContent, { caret: el.textContent.length })
    const hypotheses = collectHypotheses(el.textContent, el.textContent.length, context, analysis)
    const candidates = collectShadowCandidates(el.textContent, el.textContent.length, context, analysis)
    const decision = decideWriting(context, analysis, candidates, { observeOnly: false, hypotheses })
    expect(decision.reasonCodes).not.toContain('unsupported_editor')
    expect(['layout_fix', 'suggestion', 'noop']).toContain(decision.action)
  })

  it('real Arabic beside English loanwords is not remapped to Latin junk', () => {
    const sample = 'ارفع الـ changelog قبل الـ release. '
    const ta = textarea(sample)
    const session = new FieldSession(ta)
    const { decision } = decideFor(ta, session)
    expect(decision.action).not.toBe('layout_fix')
    const applied = applyLayoutSpansToText(sample, inferLayoutSpans(sample, undefined, { commitOpenToken: true }))
    expect(applied.text).toContain('ارفع')
    expect(applied.text).toContain('changelog')
    expect(applied.text).not.toMatch(/hvtu/i)
  })

  it('leftover wrong-keyboard token after a partial remap still finishes the English word', () => {
    const sample = 'where is the شهقحخقف '
    const applied = applyLayoutSpansToText(
      sample,
      inferLayoutSpans(sample, undefined, { commitOpenToken: true }),
    )
    expect(applied.text).toMatch(/airport/i)
  })

  it('Arabic intended on an English keyboard remaps finished tokens including apostrophe keys', () => {
    const sample = "Hdk hgl'hv "
    const applied = applyLayoutSpansToText(
      sample,
      inferLayoutSpans(sample, undefined, { commitOpenToken: true }),
      { includeMedium: true },
    )
    expect(applied.text).toMatch(/أين/)
    expect(applied.text).toMatch(/المطار/)
  })

  it('pipeline field cycle is the auto writer (noop or apply, never dual-path)', async () => {
    const ta = textarea('hello ')
    const session = new FieldSession(ta)
    const result = await runFieldCycle(ta, session)
    expect(['applied', 'noop', 'suggestion', 'stale', 'blocked']).toContain(result)
  })

  it('late advisor rank cannot auto-write when local cycle noops', async () => {
    policy('auto')
    let finishAdvisor: ((vote: {
      rankedHypothesisIds: string[]
      reasonCode: string
      ambiguityClass: string
    }) => void) | null = null
    const { setHypothesisAdvisor, setAdvisorApplyMode } = await import(
      '../../../extension/src/core/engine/advisor.ts'
    )
    setAdvisorApplyMode('apply')
    setHypothesisAdvisor(
      () =>
        new Promise((resolve) => {
          finishAdvisor = resolve
        }),
    )
    const ta = textarea('أنا عملت deploy ')
    const session = new FieldSession(ta)
    const before = ta.value
    const result = await runFieldCycle(ta, session)
    expect(result).not.toBe('applied')
    const layout = decideFor(ta, session).hypotheses.find((item) => item.intent === 'fix_layout')
    finishAdvisor?.({
      rankedHypothesisIds: [layout?.id ?? 'h1'],
      reasonCode: 'late_layout',
      ambiguityClass: 'mix',
    })
    await Promise.resolve()
    await Promise.resolve()
    expect(ta.value).toBe(before)
    setHypothesisAdvisor(null)
  })

  it('incremental secret prefixes are not layout auto-writes', () => {
    for (const prefix of ['sk', 'sk-', 'sk-abc', 'eyJ', 'https:', 'www.']) {
      const ta = textarea(`${prefix} `)
      const session = new FieldSession(ta)
      const { decision, analysis } = decideFor(ta, session)
      expect(decision.action, prefix).not.toBe('layout_fix')
      expect(
        analysis.chunks.some((chunk) => chunk.protectedKind != null) || decision.action === 'noop',
      ).toBe(true)
    }
  })

  it('excepted tokens are not layout-fixed', () => {
    const sample = 'hsjo]lj '
    const analysis = analyzeFieldText(sample, { exceptions: ['hsjo]lj'] })
    expect(analysis.chunks.some((chunk) => chunk.inExceptionList)).toBe(true)
    const ta = textarea(sample)
    const session = new FieldSession(ta)
    const context = buildFieldContext({
      element: ta,
      session,
      cycleId: 'ex',
      composing: false,
      textLength: sample.length,
    })
    const hypotheses = collectHypotheses(sample, sample.length, context, analysis)
    const candidates = collectShadowCandidates(sample, sample.length, context, analysis)
    const decision = decideWriting(context, analysis, candidates, {
      observeOnly: false,
      hypotheses,
    })
    expect(decision.action).not.toBe('layout_fix')
  })
})
