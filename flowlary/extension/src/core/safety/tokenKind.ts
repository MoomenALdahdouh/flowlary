export type TokenSkipReason =
  | 'email'
  | 'url'
  | 'jwt'
  | 'uuid'
  | 'hash'
  | 'credit-card'
  | 'api-key'
  | 'access-token'
  | 'private-key'
  | 'auth-header'
  | 'password'
  | 'env-secret'
  | 'file-path'
  | 'shell'
  | 'code-identifier'
  | 'digits'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const URL = /^(https?:\/\/|www\.)/i
const HOST_PATH = /^[a-z0-9.-]+\.[a-z]{2,}\/+\S+/i
const JWT = /^[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}$/
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const HEX_HASH = /^(?:[0-9a-f]{32}|[0-9a-f]{40}|[0-9a-f]{64}|[0-9a-f]{128})$/i
const CARD_DIGITS = /[0-9]/g
const API_KEY =
  /^(sk|pk|rk|ghp|gho|github_pat|xox[baprs]|AKIA|AIza|ya29|xoxe)[-_]|^(sk-|pk-|rk-)/i
const BEARERISH = /^(Bearer|Basic)\s+\S+/i

function digitCount(value: string): number {
  return (value.match(CARD_DIGITS) ?? []).length
}

function looksLikeCard(value: string): boolean {
  if (!/^[\d][\d\s-]{11,22}[\d]$/.test(value)) return false
  const digits = digitCount(value)
  return digits >= 13 && digits <= 19
}

export function skipReasonForToken(
  token: string,
  context = '',
  raw = token,
): TokenSkipReason | null {
  const value = token.trim()
  if (!value) return null

  if (/^\d+$/.test(value)) return 'digits'
  if (EMAIL.test(value) || (value.includes('@') && value.includes('.'))) return 'email'
  if (URL.test(value) || value.includes('://') || HOST_PATH.test(value)) return 'url'
  if (value.startsWith('eyJ') || JWT.test(value)) return 'jwt'
  if (UUID.test(value)) return 'uuid'
  if (HEX_HASH.test(value)) return 'hash'
  if (looksLikeCard(value)) return 'credit-card'
  if (API_KEY.test(value) || /^(sk|pk)-[A-Za-z0-9]{16,}$/.test(value)) return 'api-key'
  if (BEARERISH.test(raw) || /^(ghp_|github_pat_|xox[baprs]-)/.test(value)) {
    return 'access-token'
  }
  if (/password/i.test(context) || /password/i.test(raw)) return 'password'
  if (/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/.test(raw)) return 'private-key'
  return null
}

export function isSafeToken(token: string, context = '', raw = token): boolean {
  return skipReasonForToken(token, context, raw) === null
}
