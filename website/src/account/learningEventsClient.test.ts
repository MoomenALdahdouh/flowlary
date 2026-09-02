import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchLearningEvents, ingestLearningEvents } from './learningEventsClient.ts'

function storeSession() {
  localStorage.setItem(
    'flowlary.web.session',
    JSON.stringify({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      sessionId: 'sid-1',
      expiresAt: Date.now() + 60_000,
    }),
  )
}

function headersOf(fetchMock: ReturnType<typeof vi.fn>): Record<string, string> {
  const init = fetchMock.mock.calls[0]?.[1] as unknown as { headers?: Record<string, string> } | undefined
  return init?.headers ?? {}
}

describe('learning events client headers', () => {
  afterEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.unstubAllGlobals()
  })

  it('does not send X-Flowlary-Client on GET so CORS preflight stays compatible', async () => {
    storeSession()
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, store: { version: 1, events: [], samples: [] } }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchLearningEvents()
    expect(result.ok).toBe(true)
    const headers = headersOf(fetchMock)
    expect(headers.Authorization).toBe('Bearer access-token')
    expect(headers['X-Flowlary-Client']).toBeUndefined()
    expect(headers['X-Flowlary-Surface']).toBeUndefined()
  })

  it('sends X-Flowlary-Client on ingest POST', async () => {
    storeSession()
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, result: { accepted: 1, deduplicated: 0, rejected: 0 } }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    await ingestLearningEvents([
      {
        batchId: 'batch-1',
        source: 'writing',
        category: 'spelling',
        original: 'teh',
        corrected: 'the',
        action: 'detected',
        sampleWordCount: 1,
        sampleHash: 'h1',
      },
    ])
    const headers = headersOf(fetchMock)
    expect(headers['X-Flowlary-Client']).toBe('website')
    expect(headers['X-Flowlary-Surface']).toBe('website')
  })
})
