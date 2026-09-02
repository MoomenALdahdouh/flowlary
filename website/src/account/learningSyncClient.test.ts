import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchRemoteLearningProfile,
  fetchRemotePracticeSessions,
  pushRemoteLearningProfile,
} from './learningSyncClient.ts'
import { createDefaultLearningProfile } from '@flowlary/shared'

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

function callInit(fetchMock: ReturnType<typeof vi.fn>): { method?: string; headers?: Record<string, string> } {
  return (fetchMock.mock.calls[0]?.[1] ?? {}) as { method?: string; headers?: Record<string, string> }
}

describe('learning sync client', () => {
  afterEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.unstubAllGlobals()
  })

  it('does not send X-Flowlary-Client on profile GET', async () => {
    storeSession()
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, profile: null }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await fetchRemoteLearningProfile()
    expect(result).toEqual({ ok: true, value: null })
    const headers = callInit(fetchMock).headers ?? {}
    expect(headers.Authorization).toBe('Bearer access-token')
    expect(headers['X-Flowlary-Client']).toBeUndefined()
    expect(headers['X-Flowlary-Surface']).toBeUndefined()
  })

  it('does not send X-Flowlary-Client on practice GET', async () => {
    storeSession()
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, store: { version: 1, sessions: [] } }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await fetchRemotePracticeSessions()
    expect(result.ok).toBe(true)
    const headers = callInit(fetchMock).headers ?? {}
    expect(headers['X-Flowlary-Client']).toBeUndefined()
  })

  it('surfaces 401 as auth instead of empty profile', async () => {
    storeSession()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 401,
        json: async () => ({ ok: false }),
      })),
    )
    expect(await fetchRemoteLearningProfile()).toEqual({ ok: false, code: 'auth' })
    expect(await fetchRemotePracticeSessions()).toEqual({ ok: false, code: 'auth' })
  })

  it('sends client headers on profile PUT', async () => {
    storeSession()
    const fetchMock = vi.fn(async () => ({ ok: true }))
    vi.stubGlobal('fetch', fetchMock)
    await pushRemoteLearningProfile(createDefaultLearningProfile())
    const init = callInit(fetchMock)
    expect(init.method).toBe('PUT')
    expect(init.headers?.['X-Flowlary-Client']).toBe('website')
    expect(init.headers?.['X-Flowlary-Surface']).toBe('website')
  })
})
