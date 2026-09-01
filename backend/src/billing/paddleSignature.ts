import { createHmac, timingSafeEqual } from 'node:crypto'

const MAX_AGE_SECONDS = 5 * 60

export type PaddleSignatureParts = {
  ts: string
  h1: string
}

export function parsePaddleSignatureHeader(header: string): PaddleSignatureParts | null {
  const parts: Record<string, string> = {}
  for (const segment of header.split(';')) {
    const trimmed = segment.trim()
    if (!trimmed) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    parts[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  if (!parts.ts || !parts.h1) return null
  return { ts: parts.ts, h1: parts.h1 }
}

export function signPaddlePayload(rawBody: string, secret: string, ts: string): string {
  return createHmac('sha256', secret).update(`${ts}:${rawBody}`, 'utf8').digest('hex')
}

/**
 * Verify Paddle Billing webhook signatures.
 * HMAC-SHA256 of `${ts}:${rawBody}` compared to `h1` from `Paddle-Signature`.
 */
export function verifyPaddleSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!rawBody || !signatureHeader || !secret) return false
  const parsed = parsePaddleSignatureHeader(signatureHeader)
  if (!parsed) return false
  const ts = Number(parsed.ts)
  if (!Number.isFinite(ts) || ts <= 0) return false
  if (Math.abs(nowSeconds - ts) > MAX_AGE_SECONDS) return false

  const expected = signPaddlePayload(rawBody, secret, parsed.ts)
  try {
    const a = Buffer.from(expected, 'hex')
    const b = Buffer.from(parsed.h1, 'hex')
    if (a.length === 0 || a.length !== b.length) return false
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}
