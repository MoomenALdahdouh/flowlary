import { describe, expect, it, vi } from 'vitest'
import { runCorrectionRequest } from '../../../extension/src/features/correction/applyCorrection.ts'
import { createCorrectionMetrics } from '../../../extension/src/features/correction/metrics.ts'
import { FieldSession } from '../../../extension/src/core/session/FieldSession.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'
import { CorrectionCard } from '../../../extension/src/features/correction/ui/CorrectionCard.ts'
import { IntelligentDebouncer } from '../../../extension/src/features/correction/debounce.ts'

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

describe('direct mode commit', () => {
  it('writes corrected text in direct mode', async () => {
    stateManager.correction.mode = 'direct'
    stateManager.correction.enabled = true
    stateManager.correction.consentAccepted = true
    const ta = document.createElement('textarea')
    ta.value = 'I dont know what to write today'
    document.body.append(ta)
    const session = new FieldSession(ta)
    const debouncer = new IntelligentDebouncer(() => undefined)
    const gen = debouncer.schedule(ta.value)
    const fieldState = {
      debouncer,
      lastSentText: '',
      lastCorrectedFor: '',
      pendingRequestId: null,
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

    expect(result).toBe('committed')
    expect(ta.value).toContain("don't")
  })
})
