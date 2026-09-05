import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEYS } from '@flowlary/shared'
import { FlowlaryStorage } from '../../extension/src/storage/index.ts'
import { activeAccountContext } from '../../extension/src/storage/activeAccountContext.ts'
import {
  importWebAccountSession,
  loginAccount,
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

  it('re-exchanges when the extension session is near expiry', async () => {
    const mock = createMockChromeStorage()
    mock.install()
    seedFlowlaryAccountAuth(mock, { expiresAt: Date.now() + 30_000 })
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
            access_token: 'ext-access-new',
            refresh_token: 'ext-refresh-new',
            session_id: 'ext-session-new',
            expires_in: 3600,
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
      expiresAt: Date.now() + 3_600_000,
    })

    expect(result.sessionId).toBe('ext-session-new')
    expect(result.accessToken).toBe('ext-access-new')
  })

  it('deduplicates concurrent refresh requests', async () => {
    const mock = createMockChromeStorage()
    mock.install()
    seedFlowlaryAccountAuth(mock)
    let refreshCalls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo) => {
        const url = String(input)
        if (!url.includes('/api/auth/refresh')) {
          return { ok: false, status: 404, json: async () => ({}) }
        }
        refreshCalls += 1
        await new Promise((resolve) => setTimeout(resolve, 20))
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            access_token: 'refreshed-access',
            refresh_token: 'refreshed-refresh',
            session_id: 'refreshed-session',
            expires_in: 3600,
            account: { id: TEST_ACCOUNT_A, email: 'test@flowlary.com', plan: 'trial' },
          }),
        }
      }),
    )

    const storage = new FlowlaryStorage()
    const [first, second] = await Promise.all([
      refreshAccountSession(storage),
      refreshAccountSession(storage),
    ])

    expect(refreshCalls).toBe(1)
    expect(first?.accessToken).toBe('refreshed-access')
    expect(second?.accessToken).toBe('refreshed-access')
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

describe('extension account login error taxonomy', () => {
  beforeEach(() => {
    activeAccountContext.clear()
  })

  afterEach(() => {
    activeAccountContext.clear()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function installStorage() {
    const mock = createMockChromeStorage()
    mock.install()
    seedFlowlaryInstallAuth(mock)
    return new FlowlaryStorage()
  }

  function stubLogin(status: number, body: Record<string, unknown>, ok = status >= 200 && status < 300) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo) => {
        expect(String(input)).toContain('/api/auth/login')
        return { ok, status, json: async () => body }
      }),
    )
  }

  async function expectLoginCode(code: string) {
    const storage = installStorage()
    await expect(loginAccount(storage, 'user@flowlary.com', 'wrong-password')).rejects.toMatchObject({
      name: 'AccountAuthError',
      code,
      message: code,
    })
  }

  it('maps 401 to account_credentials', async () => {
    stubLogin(401, { error: { message: 'invalid credentials' } })
    await expectLoginCode('account_credentials')
  })

  it('maps transport failure to network', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    await expectLoginCode('network')
  })

  it('maps server 503 to network', async () => {
    stubLogin(503, { error: { message: 'unavailable' } })
    await expectLoginCode('network')
  })

  it('maps other HTTP login failures to account_login_failed', async () => {
    stubLogin(429, { error: { message: 'too many requests' } })
    await expectLoginCode('account_login_failed')
  })

  it('maps a 200 response that cannot form a session to account_login_invalid', async () => {
    stubLogin(200, { ok: true })
    await expectLoginCode('account_login_invalid')
  })

  it('persists a successful login session', async () => {
    stubLogin(200, {
      ok: true,
      access_token: 'login-access',
      refresh_token: 'login-refresh',
      session_id: 'login-session',
      expires_in: 3600,
      account: { id: TEST_ACCOUNT_A, email: 'user@flowlary.com', plan: 'trial' },
    })
    const storage = installStorage()
    const session = await loginAccount(storage, 'user@flowlary.com', 'correct-password')
    expect(session.sessionId).toBe('login-session')
    expect(session.email).toBe('user@flowlary.com')
    expect(await readAccountSession(storage)).toMatchObject({
      sessionId: 'login-session',
      accessToken: 'login-access',
    })
  })
})
