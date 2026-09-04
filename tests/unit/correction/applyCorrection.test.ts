import { describe, expect, it, vi } from 'vitest'
import { acceptCorrectionSuggestion, runCorrectionRequest } from '../../../extension/src/features/correction/applyCorrection.ts'
import { createCorrectionMetrics } from '../../../extension/src/features/correction/metrics.ts'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'
import { CorrectionCard } from '../../../extension/src/features/correction/ui/CorrectionCard.ts'
import { IntelligentDebouncer } from '../../../extension/src/features/correction/debounce.ts'
import { requestCorrectionRemote } from '../../../extension/src/features/correction/client.ts'

vi.mock('../../../extension/src/features/correction/client.ts', () => ({
  requestCorrectionRemote: vi.fn(async (_id, text) => ({
    type: 'CORRECT_TEXT_RESULT',
    ok: true,
    requestId: _id,
    data: {
      originalText: text,
      correctedText: text.replace('dont', "don't"),
      changes: [],
    },
  })),
  cancelCorrectionRemote: vi.fn(),
}))

function fieldSetup(text: string) {
  const ta = document.createElement('textarea')
  ta.value = text
  document.body.append(ta)
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
  const getCard = (el: typeof ta) => {
    card.mount(el)
    fieldState.cardMounted = true
    return card
  }
  return { ta, session, debouncer, gen, fieldState, card, getCard }
}

describe('direct mode commit', () => {
  it('writes corrected text in direct mode', async () => {
    stateManager.correction.mode = 'direct'
    stateManager.correction.enabled = true
    stateManager.correction.consentAccepted = true
    const { ta, session, debouncer, gen, fieldState, getCard } = fieldSetup(
      'I dont know what to write today',
    )

    const result = await runCorrectionRequest(ta, session, ta.value, gen, {
      metrics: createCorrectionMetrics(),
      fieldState,
      currentDebouncerGeneration: () => debouncer.currentGeneration(),
      getCard,
    })

    expect(result).toBe('committed')
    expect(ta.value).toContain("don't")
  })
})

describe('consent at request time', () => {
  it('shows a local suggestion in box mode without calling remote correction when consent is missing', async () => {
    stateManager.correction.mode = 'box'
    stateManager.correction.enabled = true
    stateManager.correction.consentAccepted = false
    stateManager.correction.highlights = true
    vi.mocked(requestCorrectionRemote).mockClear()

    const { ta, session, debouncer, gen, fieldState, card, getCard } = fieldSetup('hell hwo are yuo')

    const result = await runCorrectionRequest(ta, session, ta.value, gen, {
      metrics: createCorrectionMetrics(),
      fieldState,
      currentDebouncerGeneration: () => debouncer.currentGeneration(),
      getCard,
    })

    expect(result).toBe('pending')
    expect(requestCorrectionRemote).not.toHaveBeenCalled()
    expect(card.getState()).toBe('ready')
    expect(card.getBinding()?.response.correctedText).toBe('Hello, how are you?')
  })
})

describe('box mode suggestion', () => {
  it('shows the card and keeps it after apply', async () => {
    stateManager.correction.mode = 'box'
    stateManager.correction.enabled = true
    stateManager.correction.consentAccepted = true
    stateManager.correction.highlights = true
    const { ta, session, debouncer, gen, fieldState, card, getCard } = fieldSetup(
      'I dont know what to write today',
    )

    const pending = await runCorrectionRequest(ta, session, ta.value, gen, {
      metrics: createCorrectionMetrics(),
      fieldState,
      currentDebouncerGeneration: () => debouncer.currentGeneration(),
      getCard,
    })
    expect(pending).toBe('pending')
    expect(card.getState()).toBe('ready')

    const binding = card.getBinding()
    expect(binding).toBeTruthy()
    const result = await acceptCorrectionSuggestion(ta, session, binding!, {
      metrics: createCorrectionMetrics(),
      fieldState,
      currentDebouncerGeneration: () => debouncer.currentGeneration(),
      getCard,
    })

    expect(result).toBe('committed')
    expect(ta.value).toContain("don't")
    expect(card.getState()).toBe('ready')
    expect(card.hasReadyCorrection()).toBe(true)
  })

  it('keeps a valid Box applicable when only the leftover debouncer generation moves', async () => {
    stateManager.correction.mode = 'box'
    stateManager.correction.enabled = true
    stateManager.correction.consentAccepted = true
    stateManager.correction.highlights = true
    const { ta, session, debouncer, gen, fieldState, card, getCard } = fieldSetup(
      'I dont know what to write today',
    )

    await runCorrectionRequest(ta, session, ta.value, gen, {
      metrics: createCorrectionMetrics(),
      fieldState,
      currentDebouncerGeneration: () => debouncer.currentGeneration(),
      getCard,
    })
    debouncer.bump()
    const binding = card.getBinding()
    expect(binding).toBeTruthy()
    const result = await acceptCorrectionSuggestion(ta, session, binding!, {
      metrics: createCorrectionMetrics(),
      fieldState,
      currentDebouncerGeneration: () => debouncer.currentGeneration(),
      getCard,
    })
    expect(result).toBe('committed')
    expect(ta.value).toContain("don't")
  })
})
