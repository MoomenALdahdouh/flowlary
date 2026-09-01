import { randomBytes } from 'node:crypto'
import type { AppConfig } from '../config/env.ts'
import { GatewayError } from '../gateway/errors.ts'
import {
  findAccountByEmail,
  findAccountById,
  findPasswordResetByTokenHash,
  getPasswordReset,
  setPasswordReset,
  clearPasswordReset,
  updateAccount,
  deleteSessionsForAccount,
} from '../db/store.ts'
import { hashPassword, hashVerificationToken } from './crypto.ts'
import { maskEmail, sendPasswordResetEmail } from './emailService.ts'

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000
export const RESET_COOLDOWN_MS = 60 * 1000

function generateToken(): string {
  return randomBytes(32).toString('base64url')
}

function hashToken(token: string, config: AppConfig): string {
  return hashVerificationToken(token, config.jwtSecret)
}

export async function requestPasswordReset(
  config: AppConfig,
  email: string,
): Promise<{ ok: true } | { ok: false; reason: 'not_configured' }> {
  const account = findAccountByEmail(email.trim().toLowerCase())
  if (!account) {
    // Do not reveal whether the email exists.
    return { ok: true }
  }
  const now = Date.now()
  const existing = getPasswordReset(account.id)
  if (existing && now - existing.lastSentAt < RESET_COOLDOWN_MS) {
    return { ok: true }
  }
  const token = generateToken()
  setPasswordReset({
    accountId: account.id,
    tokenHash: hashToken(token, config),
    expiresAt: now + RESET_TOKEN_TTL_MS,
    lastSentAt: now,
  })
  const sent = await sendPasswordResetEmail(config, {
    to: account.email,
    maskedEmail: maskEmail(account.email),
    resetUrl: `${config.webOrigin.replace(/\/$/, '')}/account/reset-password?token=${encodeURIComponent(token)}`,
  })
  if (!sent.ok) return { ok: false, reason: 'not_configured' }
  return { ok: true }
}

export async function resetPasswordWithToken(
  config: AppConfig,
  token: string,
  password: string,
): Promise<
  | { status: 'reset' }
  | { status: 'invalid_token' }
  | { status: 'expired_token' }
  | { status: 'invalid_password' }
> {
  if (password.length < 8) return { status: 'invalid_password' }
  const trimmed = token.trim()
  if (!trimmed) return { status: 'invalid_token' }
  const record = findPasswordResetByTokenHash(hashToken(trimmed, config))
  if (!record) return { status: 'invalid_token' }
  if (record.expiresAt <= Date.now()) return { status: 'expired_token' }
  const account = findAccountById(record.accountId)
  if (!account) return { status: 'invalid_token' }
  updateAccount({
    ...account,
    passwordHash: hashPassword(password),
    updatedAt: Date.now(),
  })
  deleteSessionsForAccount(account.id)
  clearPasswordReset(account.id)
  return { status: 'reset' }
}
