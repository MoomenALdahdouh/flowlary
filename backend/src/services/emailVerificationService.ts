import { randomBytes } from 'node:crypto'
import type { AppConfig } from '../config/env.ts'
import { GatewayError } from '../gateway/errors.ts'
import {
  clearEmailVerification,
  findAccountById,
  findEmailVerificationByTokenHash,
  getEmailVerification,
  setEmailVerification,
  updateAccount,
  type AccountRecord,
  type EmailVerificationRecord,
} from '../db/store.ts'
import { hashVerificationToken } from './crypto.ts'
import { maskEmail, sendVerificationEmail } from './emailService.ts'

export const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000
export const MAX_RESEND_PER_HOUR = 3
export const RESEND_COOLDOWN_MS = 60 * 1000
export const RESEND_WINDOW_MS = 60 * 60 * 1000

export type EmailVerificationOutcome =
  | 'verified'
  | 'already_verified'
  | 'invalid_token'
  | 'expired_token'

export type VerifyEmailTokenResult =
  | { status: 'verified'; account: AccountRecord }
  | { status: 'already_verified'; account: AccountRecord }
  | { status: 'invalid_token' }
  | { status: 'expired_token' }

function generateVerificationToken(): string {
  return randomBytes(32).toString('base64url')
}

function hashToken(token: string, config: AppConfig): string {
  return hashVerificationToken(token, config.jwtSecret)
}

function normalizeToken(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (trimmed.length < 16 || trimmed.length > 256) return null
  if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) return null
  return trimmed
}

function freshRecord(accountId: string, tokenHash: string, now: number, isResend: boolean): EmailVerificationRecord {
  return {
    accountId,
    tokenHash,
    expiresAt: now + VERIFICATION_TOKEN_TTL_MS,
    resendCount: isResend ? 1 : 0,
    resendWindowStartedAt: now,
    lastResendAt: isResend ? now : 0,
  }
}

function buildVerificationUrl(config: AppConfig, token: string): string {
  const origin = config.webOrigin.replace(/\/$/, '')
  return `${origin}/account/verify-email?token=${encodeURIComponent(token)}`
}

export async function issueVerificationToken(
  config: AppConfig,
  accountId: string,
  options?: { resend?: boolean },
): Promise<{ sent: boolean; maskedEmail: string }> {
  const account = findAccountById(accountId)
  if (!account) throw new GatewayError('AI_AUTH_FAILED', 'Account not found', 401, 'verify-email')
  if (account.emailVerified) {
    return { sent: false, maskedEmail: maskEmail(account.email) }
  }

  const now = Date.now()
  const existing = getEmailVerification(accountId)
  if (options?.resend) {
    if (existing && existing.lastResendAt > 0 && now - existing.lastResendAt < RESEND_COOLDOWN_MS) {
      throw new GatewayError('AI_RATE_LIMITED', 'Resend cooldown active', 429, 'verify-email')
    }
    const inWindow = existing ? now - existing.resendWindowStartedAt < RESEND_WINDOW_MS : false
    const resendCount = inWindow ? existing!.resendCount + 1 : 1
    if (inWindow && resendCount > MAX_RESEND_PER_HOUR) {
      throw new GatewayError('AI_RATE_LIMITED', 'Too many resend attempts', 429, 'verify-email')
    }
  }

  const token = generateVerificationToken()
  const tokenHash = hashToken(token, config)
  const record = freshRecord(accountId, tokenHash, now, Boolean(options?.resend))
  if (options?.resend && existing) {
    record.resendCount =
      now - existing.resendWindowStartedAt < RESEND_WINDOW_MS ? existing.resendCount + 1 : 1
    record.resendWindowStartedAt =
      now - existing.resendWindowStartedAt < RESEND_WINDOW_MS ? existing.resendWindowStartedAt : now
    record.lastResendAt = now
  }
  setEmailVerification(record)

  const verificationUrl = buildVerificationUrl(config, token)
  const sent = await sendVerificationEmail(config, account.email, verificationUrl)
  return { sent: sent.ok, maskedEmail: maskEmail(account.email) }
}

/** @deprecated Use issueVerificationToken */
export const issueVerificationCode = issueVerificationToken

export function verifyEmailWithToken(config: AppConfig, rawToken: unknown): VerifyEmailTokenResult {
  const token = normalizeToken(rawToken)
  if (!token) return { status: 'invalid_token' }

  const tokenHash = hashToken(token, config)
  const record = findEmailVerificationByTokenHash(tokenHash)
  if (!record) return { status: 'invalid_token' }

  const account = findAccountById(record.accountId)
  if (!account) return { status: 'invalid_token' }

  if (account.emailVerified) {
    clearEmailVerification(account.id)
    return { status: 'already_verified', account }
  }

  if (record.expiresAt < Date.now()) {
    clearEmailVerification(account.id)
    return { status: 'expired_token' }
  }

  account.emailVerified = true
  account.emailVerifiedAt = Date.now()
  updateAccount(account)
  clearEmailVerification(account.id)
  return { status: 'verified', account }
}

export function resetEmailVerificationForTests(): void {
  /* cleared via resetStoreForTests */
}
