import { describe, expect, it } from 'vitest'
import { authenticateRequest } from '../../../backend/src/middleware/auth.ts'
import { loadConfig } from '../../../backend/src/config/env.ts'
import { configureStorePath, resetStoreForTests } from '../../../backend/src/db/store.ts'
import { registerAccount } from '../../../backend/src/services/accountService.ts'
import type { AppConfig } from '../../../backend/src/config/env.ts'

function config(overrides: Partial<AppConfig> = {}): AppConfig {
  configureStorePath(':memory:')
  resetStoreForTests()
  return {
    ...loadConfig(),
    env: 'development',
    authDisabled: true,
    authSecret: 'test-auth-secret',
    jwtSecret: 'test-jwt-secret',
    dataPath: ':memory:',
    groqApiKey: 'test',
    ...overrides,
  }
}

describe('authenticateRequest with development authDisabled', () => {
  it('honors a valid account JWT instead of anonymous dev auth', () => {
    const cfg = config()
    const registered = registerAccount(cfg, 'jwt-dev@flowlary.com', 'password123')
    const auth = authenticateRequest(cfg, {
      authorization: `Bearer ${registered.tokens.accessToken}`,
      'x-flowlary-install-id': 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    })
    expect(auth.authKind).toBe('account')
    expect(auth.accountId).toBe(registered.account.id)
    expect(auth.allowed).toBe(true)
  })

  it('falls back to open dev auth when no account JWT is present', () => {
    const cfg = config()
    const auth = authenticateRequest(cfg, {
      'x-flowlary-install-id': 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    })
    expect(auth.authKind).toBe('dev')
    expect(auth.accountId).toBeNull()
    expect(auth.allowed).toBe(true)
  })
})
