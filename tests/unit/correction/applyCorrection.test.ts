import { describe, expect, it, vi } from 'vitest'
import { runCorrectionRequest } from '../../../extension/src/features/correction/applyCorrection.ts'
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
  return { ta, session, debouncer, gen, fieldState, card }
}

describe('direct mode commit', () => {
  it('writes corrected text in direct mode', async () => {
    stateManager.correction.mode = 'direct'
    stateManager.correction.enabled = true
    stateManager.correction.consentAccepted = true
    const { ta, session, debouncer, gen, fieldState, card } = fieldSetup(
      'I dont know what to write today',
    )

    const result = await runCorrectionRequest(ta, session, ta.value, gen, {
      metrics: createCorrectionMetrics(),
      fieldState,
      currentDebouncerGeneration: () => debouncer.currentGeneration(),
      getCard: () => card,
    })

    expect(result).toBe('committed')
    expect(ta.value).toContain("don't")
  })
})

describe('consent at request time', () => {
  it('shows card error without calling remote correction when consent is missing', async () => {
    stateManager.correction.mode = 'direct'
    stateManager.correction.enabled = true
    stateManager.correction.consentAccepted = false
    stateManager.correction.highlights = true
    vi.mocked(requestCorrectionRemote).mockClear()

    const { ta, session, debouncer, gen, fieldState, card } = fieldSetup('I comming home today now')

    const result = await runCorrectionRequest(ta, session, ta.value, gen, {
      metrics: createCorrectionMetrics(),
      fieldState,
      currentDebouncerGeneration: () => debouncer.currentGeneration(),
      getCard: () => card,
    })

    expect(result).toBe('blocked')
    expect(requestCorrectionRemote).not.toHaveBeenCalled()
    expect(card.getState()).toBe('error')
  })
})
