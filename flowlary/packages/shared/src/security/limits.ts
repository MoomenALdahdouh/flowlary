/** Security and payload bounds — fail closed when exceeded. */
export const SECURITY_LIMITS = {
  MAX_MESSAGE_TEXT_LENGTH: 10_000,
  MAX_CORRECTION_TEXT_LENGTH: 2_000,
  MAX_TRANSLATION_TEXT_LENGTH: 2_000,
  MAX_LAYOUT_TOKEN_LENGTH: 256,
  MAX_CONTEXT_LENGTH: 500,
  MAX_HISTORY_ID_LENGTH: 128,
  MAX_REQUEST_ID_LENGTH: 128,
  MAX_LANGUAGE_CODE_LENGTH: 16,
  MAX_FIELD_TYPE_LENGTH: 32,
  MAX_LICENSE_KEY_LENGTH: 256,
  MAX_SETTINGS_DOMAINS: 100,
  MAX_DOMAIN_LABEL_LENGTH: 253,
  MAX_AI_RESPONSE_LENGTH: 20_000,
  MAX_PAUSE_MS: 7 * 24 * 60 * 60 * 1000,
  MAX_GROQ_KEY_LENGTH: 512,
} as const

export function isBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length <= maxLength
}

export function isValidAiResponseLength(value: unknown): value is string {
  return isBoundedString(value, SECURITY_LIMITS.MAX_AI_RESPONSE_LENGTH)
}

export function sanitizeErrorCode(value: unknown, fallback = 'invalid_request'): string {
  if (typeof value !== 'string') return fallback
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 64) return fallback
  if (/[\r\n<>]/.test(trimmed)) return fallback
  return trimmed
}
