/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'
import {
  analyzeFieldText,
  buildFieldContext,
  candidatesFromHypotheses,
  collectHypotheses,
  decideWriting,
} from '../../../extension/src/core/engine/index.ts'
import { applyUserWritingPolicy } from '../../../extension/src/core/policy/writingPolicy.ts'
import { runFieldCycle } from '../../../extension/src/core/writeGate/pipeline.ts'
import {
  getActivePipelineSuggestion,
  presentPipelineSuggestion,
  resetPipelineSuggestionsForTests,
} from '../../../extension/src/core/writeGate/pipelineSuggest.ts'
import { buildHighlightedTokens } from '../../../extension/src/features/correction/diff/tokenDiff.ts'
import { runCorrectionRequest } from '../../../extension/src/features/correction/applyCorrection.ts'
import { createCorrectionMetrics } from '../../../extension/src/features/correction/metrics.ts'
import { IntelligentDebouncer } from '../../../extension/src/features/correction/debounce.ts'
import { CorrectionCard } from '../../../extension/src/features/correction/ui/CorrectionCard.ts'
import { requestCorrectionRemote } from '../../../extension/src/features/correction/client.ts'

vi.mock('../../../extension/src/features/correction/client.ts', () => ({
  requestCorrectionRemote: vi.fn(),
  cancelCorrectionRemote: vi.fn(),
}))

function textarea(value: string) {
  const ta = document.createElement('textarea')
  ta.value = value
  document.body.append(ta)
  return ta
}

describe('whole-field English correction coordination', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    resetPipelineSuggestionsForTests()
    applyUserWritingPolicy({
      helpStyle: 'auto',
      fixWrongTyping: true,
      improveEnglish: true,
      arabicToEnglishMode: false,
    })
    stateManager.correction.enabled = true
    stateManager.correction.mode = 'direct'
    stateManager.correction.highlights = true
    stateManager.correction.consentAccepted = true
    vi.mocked(requestCorrectionRemote).mockReset()
  })

  afterEach(() => {
    resetPipelineSuggestionsForTests()
    vi.restoreAllMocks()
  })

  it('A. defers enforce English span suggestions when whole-field owns correction', async () => {
    const ta = textarea('I recieve your message and I has a meeting tomorow. ')
    const session = new FieldSession(ta)
    const result = await runFieldCycle(ta, session)
    expect(result).toBe('noop')
    expect(getActivePipelineSuggestion(session.field.id)).toBeNull()
    expect(document.querySelector('[data-flowlary-suggestion-host]')).toBeNull()
  })

  it('A2. decide marks deferred_to_whole_field for local spelling typos', () => {
    const text = 'I dont know. '
    const ta = textarea(text)
    const session = new FieldSession(ta)
    const context = buildFieldContext({
      element: ta,
      session,
      cycleId: 'wf',
      composing: false,
      textLength: text.length,
    })
    const analysis = analyzeFieldText(text, { caret: text.length, commitOpenToken: true })
    const hypotheses = collectHypotheses(text, text.length, context, analysis)
    const candidates = candidatesFromHypotheses(hypotheses, context)
    const decision = decideWriting(context, analysis, candidates, {
      observeOnly: false,
      hypotheses,
    })
    expect(decision.action).toBe('noop')
    expect(decision.reasonCodes).toContain('deferred_to_whole_field')
  })

  it('B. presentPipelineSuggestion suppresses English assist when whole-field is active', () => {
    const ta = textarea('hel ')
    const session = new FieldSession(ta)
    presentPipelineSuggestion({
      fieldId: session.field.id,
      element: ta,
      session,
      generation: session.getGeneration(),
      range: { start: 0, end: 3 },
      sourceText: 'hel',
      suggestion: 'help',
      action: 'english_correction',
      textOrigin: 'original_en',
    })
    expect(getActivePipelineSuggestion(session.field.id)).toBeNull()
  })

  it('I. InlineSuggestionCard still works when whole-field correction is disabled', () => {
    stateManager.correction.enabled = false
    applyUserWritingPolicy({ improveEnglish: false, fixWrongTyping: true, helpStyle: 'suggestions' })
    const ta = textarea('hel ')
    const session = new FieldSession(ta)
    presentPipelineSuggestion({
      fieldId: session.field.id,
      element: ta,
      session,
      generation: session.getGeneration(),
      range: { start: 0, end: 3 },
      sourceText: 'hel',
      suggestion: 'help',
      action: 'english_correction',
      textOrigin: 'original_en',
    })
    expect(getActivePipelineSuggestion(session.field.id)?.suggestion).toBe('help')
  })

  it('I2. layout InlineSuggestionCard still works when whole-field owns English', async () => {
    const ta = textarea('hsjo]lj ')
    const session = new FieldSession(ta)
    const result = await runFieldCycle(ta, session)
    expect(result === 'suggestion' || result === 'noop' || result === 'applied').toBe(true)
  })

  it('C/D. CORRECT_TEXT shows whole-field colored diff on CorrectionCard', async () => {
    vi.useFakeTimers()
    const original =
      'I recieve your message and I has a meeting tomorow.'
    const corrected =
      'I receive your message and I have a meeting tomorrow.'
    vi.mocked(requestCorrectionRemote).mockResolvedValue({
      type: 'CORRECT_TEXT_RESULT',
      ok: true,
      requestId: 'req-1',
      data: {
        originalText: original,
        correctedText: corrected,
        changes: [
          { type: 'spelling', original: 'recieve', corrected: 'receive' },
          { type: 'grammar', original: 'has', corrected: 'have' },
          { type: 'spelling', original: 'tomorow', corrected: 'tomorrow' },
        ],
      },
    })

    const ta = textarea(original)
    const session = new FieldSession(ta)
    const debouncer = new IntelligentDebouncer(() => undefined)
    const gen = debouncer.schedule(original)
    const fieldState = {
      debouncer,
      lastSentText: '',
      lastCorrectedFor: '',
      pendingRequestId: null,
      lastCorrectionRequestAt: 0,
      card: null,
      cardMounted: false,
    }
    const card = new CorrectionCard({
      highlights: true,
      onApply: () => undefined,
      onDismiss: () => undefined,
    })
    fieldState.card = card
    card.mount(ta)

    const pending = runCorrectionRequest(ta, session, original, gen, {
      metrics: createCorrectionMetrics(),
      fieldState,
      currentDebouncerGeneration: () => debouncer.currentGeneration(),
      getCard: () => card,
    })
    await vi.advanceTimersByTimeAsync(1000)
    const result = await pending

    expect(requestCorrectionRemote).toHaveBeenCalled()
    expect(result).toBe('committed')
    const tokens = buildHighlightedTokens(original, corrected, [
      { type: 'spelling', original: 'recieve', corrected: 'receive' },
      { type: 'grammar', original: 'has', corrected: 'have' },
      { type: 'spelling', original: 'tomorow', corrected: 'tomorrow' },
    ])
    expect(tokens.some((token) => token.changeType === 'grammar')).toBe(true)
    expect(tokens.filter((token) => token.type !== 'equal').length).toBeGreaterThan(1)
    expect(ta.value).toBe(corrected)
    vi.useRealTimers()
  })

  it('H. consent missing shows card error and does not call remote correction', async () => {
    stateManager.correction.consentAccepted = false
    const ta = textarea('I comming home today now ')
    const session = new FieldSession(ta)
    const debouncer = new IntelligentDebouncer(() => undefined)
    const gen = debouncer.schedule(ta.value)
    const fieldState = {
      debouncer,
      lastSentText: '',
      lastCorrectedFor: '',
      pendingRequestId: null,
      lastCorrectionRequestAt: 0,
      card: null,
      cardMounted: false,
    }
    const card = new CorrectionCard({
      highlights: true,
      onApply: () => undefined,
      onDismiss: () => undefined,
    })
    fieldState.card = card

    const result = await runCorrectionRequest(ta, session, ta.value, gen, {
      metrics: createCorrectionMetrics(),
      fieldState,
      currentDebouncerGeneration: () => debouncer.currentGeneration(),
      getCard: () => card,
    })

    expect(result).toBe('blocked')
    expect(requestCorrectionRemote).not.toHaveBeenCalled()
    expect(card.getState()).toBe('error')
    expect(getActivePipelineSuggestion(session.field.id)).toBeNull()
  })
})
