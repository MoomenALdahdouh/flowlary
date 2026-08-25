/** Normalized AI error codes returned by the Flowlary API gateway. */
export type AiErrorCode =
  | 'AI_UNAVAILABLE'
  | 'AI_TIMEOUT'
  | 'AI_RATE_LIMITED'
  | 'AI_AUTH_FAILED'
  | 'AI_INVALID_RESPONSE'
  | 'AI_PROVIDER_ERROR'
  | 'AI_ENTITLEMENT_DENIED'
  | 'AI_INVALID_REQUEST'

export type AiErrorBody = {
  ok: false
  error: {
    code: AiErrorCode
    message: string
    requestId?: string
  }
}

export function aiError(
  code: AiErrorCode,
  message: string,
  requestId?: string,
): AiErrorBody {
  return {
    ok: false,
    error: { code, message, requestId },
  }
}
