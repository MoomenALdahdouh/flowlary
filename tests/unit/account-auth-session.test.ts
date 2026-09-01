import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEYS } from '@flowlary/shared'
import { FlowlaryStorage } from '../../extension/src/storage/index.ts'
import { activeAccountContext } from '../../extension/src/storage/activeAccountContext.ts'
import {
  importWebAccountSession,
  readAccountSession,
  refreshAccountSession,
} from '../../extension/src/config/accountAuth.ts'
import { createMockChromeStorage } from '../helpers/mockChromeStorage.ts'
import { seedFlowlaryAccountAuth, seedFlowlaryInstallAuth } from '../helpers/mockFlowlaryAuth.ts'
import { TEST_ACCOUNT_A } from '../helpers/accountIsolation.ts'

describe('extension account session', () => {
  beforeEach(() => {
    activeAccountContext.clear()
  })

  afterEach(() => {
    activeAccountContext.clear()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('does not sign out when refresh fails with a server error', async () => {
    const mock = createMockChromeStorage()
    mock.install()
    seedFlowlaryAccountAuth(mock)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 503,
        json: async () => ({ error: { message: 'unavailable' } }),
      })),
    )

    const storage = new FlowlaryStorage()
    const kept = await refreshAccountSession(storage)
    expect(kept?.sessionId).toBe('test-session-id')
    expect(await readAccountSession(storage)).not.toBeNull()
  })

  it('does not overwrite an existing extension session for the same account', async () => {
    const mock = createMockChromeStorage()
    mock.install()
    seedFlowlaryAccountAuth(mock)
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const storage = new FlowlaryStorage()
    const result = await importWebAccountSession(storage, {
      accessToken: 'web-access',
      refreshToken: 'web-refresh',
      sessionId: 'web-session',
      accountId: TEST_ACCOUNT_A,
      email: 'test@flowlary.com',
      expiresAt: Date.now() + 60_000,
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.sessionId).toBe('test-session-id')
    expect(result.accessToken).toBe('test-access-token')
  })

  it('exchanges a website session for a separate extension session', async () => {
    const mock = createMockChromeStorage()
    mock.install()
    seedFlowlaryInstallAuth(mock)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo) => {
        const url = String(input)
        expect(url).toContain('/api/auth/device-session')
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            access_token: 'ext-access',
            refresh_token: 'ext-refresh',
            session_id: 'ext-session',
            expires_in: 900,
            account: { id: TEST_ACCOUNT_A, email: 'web@flowlary.com', plan: 'trial' },
          }),
        }
      }),
    )

    const storage = new FlowlaryStorage()
    const result = await importWebAccountSession(storage, {
      accessToken: 'web-access',
      refreshToken: 'web-refresh',
      sessionId: 'web-session',
      accountId: TEST_ACCOUNT_A,
      email: 'web@flowlary.com',
      expiresAt: Date.now() + 60_000,
    })

    expect(result.sessionId).toBe('ext-session')
    expect(result.accessToken).toBe('ext-access')
    expect(mock.local[STORAGE_KEYS.authSessionId]).toEqual({ value: 'ext-session', _v: 1 })
  })
})
