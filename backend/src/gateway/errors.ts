import type { AiErrorCode } from '@flowlary/shared'
import { AdvisorProviderFailureError } from '../providers/advisorTypes.ts'

export class GatewayError extends Error {
  readonly code: AiErrorCode
  readonly status: number
  readonly requestId: string

  constructor(code: AiErrorCode, message: string, status: number, requestId: string) {
    super(message)
    this.code = code
    this.status = status
    this.requestId = requestId
  }
}

export function mapProviderFailure(err: unknown, requestId: string): GatewayError {
  if (err instanceof GatewayError) return err
  if (err instanceof AdvisorProviderFailureError) {
    const category = err.result.category
    if (category === 'RATE_LIMITED') {
      return new GatewayError('AI_RATE_LIMITED', 'AI advisor capacity unavailable', 429, requestId)
    }
    if (category === 'TIMEOUT' || category === 'STALE_REQUEST') {
      return new GatewayError('AI_TIMEOUT', 'AI advisor timed out', 504, requestId)
    }
    if (category === 'AUTH_FAILED') {
      return new GatewayError('AI_PROVIDER_ERROR', 'AI provider authentication failed', 502, requestId)
    }
    if (
      category === 'CONTRACT_FAILURE'
      || category === 'INVALID_REQUEST'
    ) {
      return new GatewayError('AI_INVALID_RESPONSE', 'AI advisor returned an invalid response', 502, requestId)
    }
    if (
      category === 'PROVIDER_UNAVAILABLE'
      || category === 'SERVER_ERROR'
      || category === 'NETWORK_ERROR'
      || category === 'QUOTA_EXHAUSTED'
    ) {
      return new GatewayError('AI_UNAVAILABLE', 'AI advisor unavailable', 503, requestId)
    }
    return new GatewayError('AI_PROVIDER_ERROR', 'AI advisor provider error', 502, requestId)
  }
  if (err instanceof DOMException && err.name === 'AbortError') {
    return new GatewayError('AI_TIMEOUT', 'AI request timed out', 504, requestId)
  }
  const message = err instanceof Error ? err.message : 'provider_error'
  if (message === 'invalid_api_key') {
    return new GatewayError('AI_PROVIDER_ERROR', 'Provider authentication failed', 502, requestId)
  }
  if (message === 'rate_limited') {
    return new GatewayError('AI_RATE_LIMITED', 'Provider rate limit reached', 429, requestId)
  }
  if (message === 'invalid_response') {
    return new GatewayError('AI_INVALID_RESPONSE', 'Provider returned invalid response', 502, requestId)
  }
  if (
    message.startsWith('groq_http_') ||
    message.startsWith('google_http_') ||
    message === 'google_unavailable' ||
    message === 'google_not_configured' ||
    message === 'groq_connect_timeout' ||
    message === 'groq_network_failure'
  ) {
    return new GatewayError('AI_UNAVAILABLE', 'AI provider unavailable', 503, requestId)
  }
  if (message === 'google_auth_failed' || message === 'google_project_missing') {
    return new GatewayError('AI_PROVIDER_ERROR', 'Provider authentication failed', 502, requestId)
  }
  if (message === 'google_rate_limited') {
    return new GatewayError('AI_RATE_LIMITED', 'Provider rate limit reached', 429, requestId)
  }
  if (message === 'google_quota') {
    return new GatewayError('AI_UNAVAILABLE', 'AI provider unavailable', 503, requestId)
  }
  if (message === 'google_timeout') {
    return new GatewayError('AI_TIMEOUT', 'AI request timed out', 504, requestId)
  }
  if (message === 'google_invalid_response' || message === 'google_invalid_request') {
    return new GatewayError('AI_INVALID_RESPONSE', 'Provider returned invalid response', 502, requestId)
  }
  if (err instanceof Error && 'kind' in err && typeof (err as { kind?: string }).kind === 'string') {
    const kind = (err as { kind: string }).kind
    if (kind === 'auth') return new GatewayError('AI_PROVIDER_ERROR', 'Provider authentication failed', 502, requestId)
    if (kind === 'rate_limit') return new GatewayError('AI_RATE_LIMITED', 'Provider rate limit reached', 429, requestId)
    if (kind === 'timeout') return new GatewayError('AI_TIMEOUT', 'AI request timed out', 504, requestId)
    if (kind === 'invalid') return new GatewayError('AI_INVALID_RESPONSE', 'Provider returned invalid response', 502, requestId)
    if (kind === 'quota' || kind === 'unavailable') {
      return new GatewayError('AI_UNAVAILABLE', 'AI provider unavailable', 503, requestId)
    }
  }
  return new GatewayError('AI_PROVIDER_ERROR', 'AI provider error', 502, requestId)
}
