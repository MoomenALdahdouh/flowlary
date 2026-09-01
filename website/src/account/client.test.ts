import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEV_API_PROXY_PATH, resolvePublicApiUrl } from '../config.ts'
import {
  hasStoredWebSession,
  loginWebAccount,
  logoutWebAccount,
  mapAccountClientError,
  registerWebAccount,
} from './client.ts'

describe('resolvePublicApiUrl', () => {
  it('uses the same-origin proxy in development', () => {
    expect(import.meta.env.DEV).toBe(true)
    expect(resolvePublicApiUrl()).toBe(DEV_API_PROXY_PATH)
    expect(resolvePublicApiUrl()).not.toMatch(/127\.0\.0\.1/)
  })
})

describe('mapAccountClientError', () => {
  it('maps network failures separately from HTTP unavailability', () => {
    expect(mapAccountClientError(0, {}, 'network')).toBe('network')
    expect(mapAccountClientError(503, {})).toBe('unavailable')
  })

  it('maps duplicate email, validation, and credentials precisely', () => {
    expect(mapAccountClientError(409, { error: { message: 'Email already registered' } })).toBe('duplicate')
    expect(mapAccountClientError(400, { error: { message: 'Invalid email' } })).toBe('invalid_email')
    expect(mapAccountClientError(400, { error: { message: 'Invalid password' } })).toBe('invalid_password')
    expect(mapAccountClientError(401, { error: { message: 'Invalid credentials' } })).toBe('credentials')
    expect(mapAccountClientError(401, { error: { message: 'Session expired' } })).toBe('expired')
  })
})

describe('registerWebAccount / loginWebAccount', () => {
  afterEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('stores the session on successful registration', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          ok: true,
          account: {
            id: 'acc-1',
            email: 'new@flowlary.com',
            plan: 'trial',
            status: 'active',
            inTrial: true,
            isPro: false,
            remainingMs: 200,
            billingAvailable: false,
          },
          access_token: 'access',
          refresh_token: 'refresh',
          session_id: 'sid-1',
          expires_in: 900,
        }),
      })),
    )
    const result = await registerWebAccount('new@flowlary.com', 'password123')
    expect(result.ok).toBe(true)
    expect(localStorage.getItem('flowlary.web.session')).toContain('sid-1')
    expect(sessionStorage.getItem('flowlary.web.session')).toBeNull()
  })

  it('maps duplicate registration without writing a session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 409,
        json: async () => ({ error: { message: 'Email already registered' } }),
      })),
    )
    const result = await registerWebAccount('dup@flowlary.com', 'password123')
    expect(result).toEqual(expect.objectContaining({ ok: false, error: 'duplicate' }))
    expect(sessionStorage.getItem('flowlary.web.session')).toBeNull()
    expect(localStorage.getItem('flowlary.web.session')).toBeNull()
  })

  it('maps invalid credentials on login', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'Invalid credentials' } }),
      })),
    )
    const result = await loginWebAccount('user@flowlary.com', 'wrong-pass')
    expect(result).toEqual(expect.objectContaining({ ok: false, error: 'credentials' }))
  })

  it('maps a network failure without treating it as exhausted credits', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )
    const result = await registerWebAccount('user@flowlary.com', 'password123')
    expect(result).toEqual({ ok: false, error: 'network' })
  })

  it('clears the local session on logout', async () => {
    localStorage.setItem(
      'flowlary.web.session',
      JSON.stringify({
        accessToken: 'a',
        refreshToken: 'r',
        sessionId: 's',
        expiresAt: Date.now() + 60_000,
      }),
    )
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ ok: true }),
      })),
    )
    await logoutWebAccount()
    expect(localStorage.getItem('flowlary.web.session')).toBeNull()
    expect(sessionStorage.getItem('flowlary.web.session')).toBeNull()
  })

  it('migrates a tab session into localStorage so new tabs stay signed in', () => {
    sessionStorage.setItem(
      'flowlary.web.session',
      JSON.stringify({
        accessToken: 'a',
        refreshToken: 'r',
        sessionId: 'legacy-sid',
        expiresAt: Date.now() + 60_000,
      }),
    )
    expect(hasStoredWebSession()).toBe(true)
    expect(localStorage.getItem('flowlary.web.session')).toContain('legacy-sid')
    expect(sessionStorage.getItem('flowlary.web.session')).toBeNull()
  })
})
