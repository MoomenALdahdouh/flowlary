import { randomBytes } from 'node:crypto'
import { STUDENT_PROGRAM_DURATION_MONTHS } from '@flowlary/shared'
import type { AppConfig } from '../config/env.ts'
import { GatewayError } from '../gateway/errors.ts'
import {
  clearStudentReference,
  clearStudentVerificationRequest,
  findAccountByStudentReference,
  findStudentVerificationByTokenHash,
  getStudentBenefit,
  getStudentVerificationRequest,
  setStudentVerificationRequest,
  upsertStudentBenefit,
} from '../db/studentBenefitSlice.ts'
import { touch } from '../db/store.ts'
import type { StudentBenefitRecord, StudentBenefitStatus } from '../db/studentTypes.ts'
import { findAccountById } from '../db/store.ts'
import { hashVerificationToken } from './crypto.ts'
import { checkStudentOperationRateLimit } from '../middleware/rateLimit.ts'
import { maskEmail, sendVerificationEmail } from './emailService.ts'

export const STUDENT_VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000
export const STUDENT_VERIFY_RESEND_COOLDOWN_MS = 60 * 1000

function enforceStudentRateLimit(accountId: string, operation: Parameters<typeof checkStudentOperationRateLimit>[1]): void {
  try {
    checkStudentOperationRateLimit(accountId, operation)
  } catch {
    throw new GatewayError(
      'AI_RATE_LIMITED',
      'Too many student verification attempts. Try again later.',
      429,
      operation,
    )
  }
}

const ACADEMIC_DOMAIN_SUFFIXES = [
  '.edu',
  '.ac.uk',
  '.edu.au',
  '.ac.nz',
  '.edu.sg',
  '.ac.in',
  '.edu.tr',
  '.ac.za',
  '.edu.sa',
  '.edu.eg',
]

export type StudentStatusView = {
  status: StudentBenefitStatus | 'none'
  verified: boolean
  expiresAt: number | null
  institutionHint?: string
  verificationMethod?: StudentBenefitRecord['verificationMethod']
  pendingEmail?: string
}

function normalizeAcademicEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const email = raw.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return null
  return email
}

function isAcademicDomain(email: string): boolean {
  const domain = email.split('@')[1] ?? ''
  return ACADEMIC_DOMAIN_SUFFIXES.some((suffix) => domain.endsWith(suffix))
}

function hashStudentReference(email: string, config: AppConfig): string {
  return hashVerificationToken(`student:${email}`, config.jwtSecret)
}

function institutionFromEmail(email: string): string {
  return email.split('@')[1] ?? 'school'
}

function studentDurationMs(): number {
  return STUDENT_PROGRAM_DURATION_MONTHS * 30 * 24 * 60 * 60 * 1000
}

function buildVerificationUrl(config: AppConfig, token: string): string {
  const origin = config.webOrigin.replace(/\/$/, '')
  return `${origin}/account?student=1&token=${encodeURIComponent(token)}`
}

function normalizeBenefitStatus(record: StudentBenefitRecord, now: number): StudentBenefitRecord {
  if (record.status === 'active' && record.expiresAt != null && record.expiresAt <= now) {
    const expired = { ...record, status: 'expired' as const, verified: false, updatedAt: now }
    upsertStudentBenefit(expired)
    clearStudentReference(record.verificationReference)
    touch()
    return expired
  }
  return record
}

export function getActiveStudentBenefit(accountId: string, now = Date.now()): StudentBenefitRecord | null {
  const row = getStudentBenefit(accountId)
  if (!row) return null
  const normalized = normalizeBenefitStatus(row, now)
  if (normalized !== row) upsertStudentBenefit(normalized)
  if (normalized.status !== 'active' || !normalized.verified) return null
  if ((normalized.expiresAt ?? 0) <= now) return null
  return normalized
}

export function getStudentStatusView(accountId: string, now = Date.now()): StudentStatusView {
  const row = getStudentBenefit(accountId)
  const pending = getStudentVerificationRequest(accountId)
  if (!row && !pending) return { status: 'none', verified: false, expiresAt: null }

  if (row) {
    const normalized = normalizeBenefitStatus(row, now)
    if (normalized !== row) upsertStudentBenefit(normalized)
    return {
      status: normalized.status,
      verified: normalized.verified,
      expiresAt: normalized.expiresAt,
      institutionHint: normalized.institutionHint,
      verificationMethod: normalized.verificationMethod,
      pendingEmail: pending ? maskEmail(pending.academicEmail) : undefined,
    }
  }

  return {
    status: 'pending',
    verified: false,
    expiresAt: null,
    pendingEmail: pending ? maskEmail(pending.academicEmail) : undefined,
  }
}

export async function requestStudentVerification(
  config: AppConfig,
  accountId: string,
  academicEmailRaw: unknown,
): Promise<{ sent: boolean; maskedEmail: string }> {
  const account = findAccountById(accountId)
  if (!account) throw new GatewayError('AI_AUTH_FAILED', 'Account not found', 401, 'student-verify')

  const academicEmail = normalizeAcademicEmail(academicEmailRaw)
  if (!academicEmail) {
    throw new GatewayError('AI_INVALID_REQUEST', 'Enter a valid academic email address', 400, 'student-verify')
  }
  if (!isAcademicDomain(academicEmail)) {
    throw new GatewayError(
      'AI_INVALID_REQUEST',
      'Use an email address from an eligible academic institution',
      400,
      'student-verify',
    )
  }

  enforceStudentRateLimit(accountId, 'student-verify-request')

  const now = Date.now()
  const active = getActiveStudentBenefit(accountId, now)
  if (active) {
    throw new GatewayError('AI_INVALID_REQUEST', 'Student Pro is already active on this account', 409, 'student-verify')
  }

  const reference = hashStudentReference(academicEmail, config)
  const otherAccount = findAccountByStudentReference(reference)
  if (otherAccount && otherAccount !== accountId) {
    throw new GatewayError(
      'AI_INVALID_REQUEST',
      'This academic email is already linked to another account',
      409,
      'student-verify',
    )
  }

  const existingBenefit = getStudentBenefit(accountId)
  if (existingBenefit?.status === 'revoked') {
    throw new GatewayError('AI_INVALID_REQUEST', 'Student verification is not available', 403, 'student-verify')
  }

  const existingRequest = getStudentVerificationRequest(accountId)
  if (existingRequest && now - existingRequest.createdAt < STUDENT_VERIFY_RESEND_COOLDOWN_MS) {
    throw new GatewayError('AI_RATE_LIMITED', 'Please wait before requesting another verification email', 429, 'student-verify')
  }

  const token = randomBytes(32).toString('base64url')
  const tokenHash = hashVerificationToken(token, config.jwtSecret)

  setStudentVerificationRequest({
    accountId,
    academicEmail,
    tokenHash,
    expiresAt: now + STUDENT_VERIFY_TOKEN_TTL_MS,
    verificationReference: reference,
    institutionHint: institutionFromEmail(academicEmail),
    createdAt: now,
  })
  touch()

  upsertStudentBenefit({
    accountId,
    verified: false,
    verifiedAt: null,
    expiresAt: null,
    verificationMethod: 'academic_email',
    verificationReference: reference,
    institutionHint: institutionFromEmail(academicEmail),
    status: 'pending',
    createdAt: existingBenefit?.createdAt ?? now,
    updatedAt: now,
  })
  touch()

  await sendVerificationEmail(config, academicEmail, buildVerificationUrl(config, token))

  return { sent: true, maskedEmail: maskEmail(academicEmail) }
}

export function confirmStudentVerification(
  config: AppConfig,
  accountId: string,
  tokenRaw: unknown,
  now = Date.now(),
): { status: 'verified' | 'invalid_token' | 'expired_token' | 'already_verified' } {
  enforceStudentRateLimit(accountId, 'student-verify-confirm')

  const token = typeof tokenRaw === 'string' ? tokenRaw.trim() : ''
  if (!token) return { status: 'invalid_token' }

  const tokenHash = hashVerificationToken(token, config.jwtSecret)
  const request = findStudentVerificationByTokenHash(tokenHash)
  if (!request || request.accountId !== accountId) return { status: 'invalid_token' }
  if (request.expiresAt <= now) {
    clearStudentVerificationRequest(accountId)
    return { status: 'expired_token' }
  }

  const active = getActiveStudentBenefit(accountId, now)
  if (active) {
    clearStudentVerificationRequest(accountId)
    return { status: 'already_verified' }
  }

  const otherAccount = findAccountByStudentReference(request.verificationReference)
  if (otherAccount && otherAccount !== accountId) {
    clearStudentVerificationRequest(accountId)
    return { status: 'invalid_token' }
  }

  const expiresAt = now + studentDurationMs()
  upsertStudentBenefit({
    accountId,
    verified: true,
    verifiedAt: now,
    expiresAt,
    verificationMethod: 'academic_email',
    verificationReference: request.verificationReference,
    institutionHint: request.institutionHint,
    status: 'active',
    createdAt: getStudentBenefit(accountId)?.createdAt ?? now,
    updatedAt: now,
  })
  clearStudentVerificationRequest(accountId)
  touch()

  return { status: 'verified' }
}

export async function submitEnrollmentReview(
  config: AppConfig,
  accountId: string,
  institutionHintRaw: unknown,
): Promise<{ ok: true }> {
  const account = findAccountById(accountId)
  if (!account) throw new GatewayError('AI_AUTH_FAILED', 'Account not found', 401, 'student-review')

  const institutionHint =
    typeof institutionHintRaw === 'string' && institutionHintRaw.trim().length >= 2
      ? institutionHintRaw.trim().slice(0, 120)
      : null
  if (!institutionHint) {
    throw new GatewayError('AI_INVALID_REQUEST', 'Institution name is required', 400, 'student-review')
  }

  enforceStudentRateLimit(accountId, 'student-enrollment-review')

  const now = Date.now()
  if (getActiveStudentBenefit(accountId, now)) {
    throw new GatewayError('AI_INVALID_REQUEST', 'Student Pro is already active', 409, 'student-review')
  }

  const reference = hashVerificationToken(`enrollment:${accountId}:${institutionHint.toLowerCase()}`, config.jwtSecret)
  upsertStudentBenefit({
    accountId,
    verified: false,
    verifiedAt: null,
    expiresAt: null,
    verificationMethod: 'enrollment_review',
    verificationReference: reference,
    institutionHint,
    status: 'pending',
    createdAt: getStudentBenefit(accountId)?.createdAt ?? now,
    updatedAt: now,
  })
  touch()

  return { ok: true }
}

export function revokeStudentBenefit(accountId: string, now = Date.now()): void {
  const row = getStudentBenefit(accountId)
  if (!row) return
  clearStudentReference(row.verificationReference)
  upsertStudentBenefit({ ...row, status: 'revoked', verified: false, updatedAt: now })
  touch()
}
