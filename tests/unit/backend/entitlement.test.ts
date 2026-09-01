import { describe, expect, it } from 'vitest'
import { resolveServerEntitlement, parseClientEntitlementClaim } from '../../../backend/src/middleware/entitlement.ts'

describe('server entitlement resolution', () => {
  it('denies unauthenticated requests', () => {
    expect(resolveServerEntitlement('pro', false)).toEqual({
      tier: 'anonymous',
      clientClaim: 'pro',
    })
  })

  it('denies authenticated requests with anonymous client claim', () => {
    expect(resolveServerEntitlement('anonymous', true)).toEqual({
      tier: 'anonymous',
      clientClaim: 'anonymous',
    })
  })

  it('denies authenticated requests with missing client claim', () => {
    expect(resolveServerEntitlement(undefined, true)).toEqual({
      tier: 'anonymous',
      clientClaim: null,
    })
  })

  it('does not grant pro server tier from client pro claim', () => {
    expect(resolveServerEntitlement('pro', true)).toEqual({
      tier: 'free',
      clientClaim: 'pro',
    })
  })

  it('does not grant trial server tier from client trial claim', () => {
    expect(resolveServerEntitlement('trial', true)).toEqual({
      tier: 'free',
      clientClaim: 'trial',
    })
  })

  it('grants free server tier for authenticated free claim', () => {
    expect(resolveServerEntitlement('free', true)).toEqual({
      tier: 'free',
      clientClaim: 'free',
    })
  })

  it('treats invalid client claims as null', () => {
    expect(parseClientEntitlementClaim('super-pro')).toBeNull()
  })
})
