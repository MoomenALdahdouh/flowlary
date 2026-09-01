import { describe, expect, it } from 'vitest'
import { mapProviderFailure } from '../../../backend/src/gateway/errors.ts'
import {
  AdvisorProviderFailureError,
  type AdvisorProviderErrorCategory,
} from '../../../backend/src/providers/advisorTypes.ts'

function error(category: AdvisorProviderErrorCategory): AdvisorProviderFailureError {
  return new AdvisorProviderFailureError({
    ok: false,
    provider: 'groq',
    model: 'test',
    category,
    retryable: false,
    fallbackEligible: false,
    latencyMs: 1,
    fallbackUsed: false,
    attempts: [],
  })
}

describe('advisor failure gateway mapping', () => {
  it.each([
    ['RATE_LIMITED', 'AI_RATE_LIMITED', 429],
    ['TIMEOUT', 'AI_TIMEOUT', 504],
    ['STALE_REQUEST', 'AI_TIMEOUT', 504],
    ['AUTH_FAILED', 'AI_PROVIDER_ERROR', 502],
    ['CONTRACT_FAILURE', 'AI_INVALID_RESPONSE', 502],
    ['INVALID_REQUEST', 'AI_INVALID_RESPONSE', 502],
    ['QUOTA_EXHAUSTED', 'AI_UNAVAILABLE', 503],
    ['NETWORK_ERROR', 'AI_UNAVAILABLE', 503],
    ['PROVIDER_UNAVAILABLE', 'AI_UNAVAILABLE', 503],
    ['SERVER_ERROR', 'AI_UNAVAILABLE', 503],
    ['UNKNOWN', 'AI_PROVIDER_ERROR', 502],
  ] as const)('maps %s to %s', (category, code, status) => {
    expect(mapProviderFailure(error(category), 'request')).toMatchObject({
      code,
      status,
      requestId: 'request',
    })
  })
})
