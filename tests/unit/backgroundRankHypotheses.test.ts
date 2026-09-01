import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cancelRankHypotheses,
  handleRankHypotheses,
  resetRankHypothesesForTests,
} from '../../extension/src/background/rankHypotheses.ts'
import type { AdvisorPacket } from '../../extension/src/core/engine/advisor.ts'
import { resetFlowlaryCacheForTests } from '../../extension/src/storage/cache/index.ts'
import { createMockChromeStorage } from '../helpers/mockChromeStorage.ts'
import { seedFlowlaryAccountAuth } from '../helpers/mockFlowlaryAuth.ts'

const packet: AdvisorPacket = {
  cycleId: 'abort-cycle',
  generation: 1,
  policy: {
    helpStyle: 'auto',
    arabicToEnglishMode: false,
    layoutAuto: true,
    correctionEnabled: true,
  },
  allowedIntents: ['preserve', 'fix_english'],
  snippet: 'test',
  hypotheses: [
    {
      id: 'h1',
      intent: 'preserve',
      localScore: 0.6,
      risk: 'low',
      needsLLM: true,
      conflicts: ['h2'],
      evidence: [],
      mixUnsafe: false,
      hasReplacement: false,
    },
    {
      id: 'h2',
      intent: 'fix_english',
      localScore: 0.5,
      risk: 'medium',
      needsLLM: true,
      conflicts: ['h1'],
      evidence: [],
      mixUnsafe: false,
      hasReplacement: true,
    },
  ],
}

describe('background hypothesis advisor cancellation', () => {
  beforeEach(() => {
    const storage = createMockChromeStorage()
    seedFlowlaryAccountAuth(storage)
    storage.install()
    resetFlowlaryCacheForTests()
    resetRankHypothesesForTests()
  })

  afterEach(() => {
    resetRankHypothesesForTests()
    resetFlowlaryCacheForTests()
    vi.unstubAllGlobals()
  })

  it('aborts the active backend fetch for a stale generation', async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>(
      (_resolve, reject) => {
        init?.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true },
        )
      },
    ))
    vi.stubGlobal('fetch', fetchMock)

    const pending = handleRankHypotheses(packet)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    cancelRankHypotheses(packet.cycleId)

    await expect(pending).resolves.toEqual({
      type: 'RANK_HYPOTHESES_RESULT',
      ok: false,
      error: 'network',
    })
    const request = fetchMock.mock.calls[0]?.[1]
    expect(request?.signal?.aborted).toBe(true)
  })
})
