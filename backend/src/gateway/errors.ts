import type { AiErrorCode } from '@flowlary/shared'

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
  if (message.startsWith('groq_http_')) {
    return new GatewayError('AI_UNAVAILABLE', 'AI provider unavailable', 503, requestId)
  }
  return new GatewayError('AI_PROVIDER_ERROR', 'AI provider error', 502, requestId)
}
