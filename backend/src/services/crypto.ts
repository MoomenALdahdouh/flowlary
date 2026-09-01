import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }

export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, 32, SCRYPT_PARAMS)
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`
}

export function verifyPassword(password: string, encoded: string): boolean {
  const parts = encoded.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const salt = Buffer.from(parts[1]!, 'base64')
  const expected = Buffer.from(parts[2]!, 'base64')
  const actual = scryptSync(password, salt, expected.length, SCRYPT_PARAMS)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export function hashOpaqueToken(token: string, secret: string): string {
  return createHmac('sha256', secret).update(`refresh:${token}`).digest('hex')
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input
  return buf.toString('base64url')
}

function parseJwt(token: string, secret: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [headerB64, payloadB64, sig] = parts
  const expected = createHmac('sha256', secret).update(`${headerB64}.${payloadB64}`).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(payloadB64!, 'base64url').toString('utf8')) as Record<
      string,
      unknown
    >
    const exp = payload.exp
    if (typeof exp === 'number' && exp * 1000 < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

export function signAccessToken(
  payload: Record<string, unknown>,
  secret: string,
  expiresInSec: number,
): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const now = Math.floor(Date.now() / 1000)
  const body = base64url(
    JSON.stringify({ ...payload, iat: now, exp: now + expiresInSec, typ: 'access' }),
  )
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${sig}`
}

export function verifyAccessToken(token: string, secret: string): Record<string, unknown> | null {
  const payload = parseJwt(token, secret)
  if (!payload || payload.typ !== 'access') return null
  return payload
}

export function createRefreshToken(): string {
  return randomBytes(32).toString('hex')
}

export function hashVerificationCode(code: string, secret: string): string {
  return createHmac('sha256', secret).update(`email-verify:${code}`).digest('hex')
}

export function hashVerificationToken(token: string, secret: string): string {
  return createHmac('sha256', secret).update(`email-verify-token:${token}`).digest('hex')
}

export function verifyRefreshTokenHash(token: string, hash: string, secret: string): boolean {
  const expected = hashOpaqueToken(token, secret)
  const a = Buffer.from(hash)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
