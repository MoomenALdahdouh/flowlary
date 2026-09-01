import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cancelReviewWriting,
  handleReviewWriting,
  resetReviewWritingForTests,
} from '../../extension/src/background/reviewWriting.ts'
import { resetFlowlaryCacheForTests } from '../../extension/src/storage/cache/index.ts'
import { createMockChromeStorage } from '../helpers/mockChromeStorage.ts'
import { seedFlowlaryAccountAuth } from '../helpers/mockFlowlaryAuth.ts'

const packet = {
  cycleId: 'abort-review',
  snippet: 'hello comming',
  allowedKinds: ['spelling', 'grammar', 'punctuation'] as const,
}

describe('background writing review cancellation', () => {
  beforeEach(() => {
    const storage = createMockChromeStorage()
    seedFlowlaryAccountAuth(storage)
    storage.install()
    resetFlowlaryCacheForTests()
    resetReviewWritingForTests()
  })

  afterEach(() => {
    resetReviewWritingForTests()
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

    const pending = handleReviewWriting(packet)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    cancelReviewWriting(packet.cycleId)

    await expect(pending).resolves.toEqual({
      type: 'REVIEW_WRITING_RESULT',
      ok: false,
      error: 'network',
    })
    const request = fetchMock.mock.calls[0]?.[1]
    expect(request?.signal?.aborted).toBe(true)
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/ai/writing-review')
  })
})
