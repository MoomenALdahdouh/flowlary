/**
 * Client entitlement-claim parser for install-auth and telemetry.
 *
 * X-Flowlary-Entitlement is never billing truth.
 * Account JWT paths use accountService.resolveServerEntitlementForAccount().
 */

export type ServerEntitlementTier = 'anonymous' | 'free'

export type EntitlementResolution = {
  /** Authoritative tier for AI access and rate limits. */
  tier: ServerEntitlementTier
  /** Raw client header value — logged for telemetry only. */
  clientClaim: string | null
}

const VALID_CLIENT_CLAIMS = new Set(['free', 'trial', 'pro', 'anonymous'])

export function parseClientEntitlementClaim(raw: string | undefined): string | null {
  if (!raw?.trim()) return null
  const claim = raw.trim().toLowerCase()
  return VALID_CLIENT_CLAIMS.has(claim) ? claim : null
}

/**
 * Resolve server entitlement for managed AI routes.
 *
 * - Unauthenticated → anonymous (deny managed AI)
 * - Client claim missing or anonymous → anonymous (fail-closed)
 * - Any other client claim (free/trial/pro/byok) → free server tier until billing verification exists
 *
 * Client pro/trial claims do NOT unlock pro/trial server rate limits.
 */
export function resolveServerEntitlement(
  clientClaimRaw: string | undefined,
  authenticated: boolean,
): EntitlementResolution {
  const clientClaim = parseClientEntitlementClaim(clientClaimRaw)

  if (!authenticated) {
    return { tier: 'anonymous', clientClaim }
  }

  if (!clientClaim || clientClaim === 'anonymous') {
    return { tier: 'anonymous', clientClaim }
  }

  return { tier: 'free', clientClaim }
}
