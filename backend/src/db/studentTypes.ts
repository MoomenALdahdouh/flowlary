import { STUDENT_PROGRAM_DURATION_MONTHS } from '@flowlary/shared'

export type StudentVerificationMethod = 'academic_email' | 'enrollment_review' | 'manual'

export type StudentBenefitStatus = 'pending' | 'active' | 'expired' | 'revoked'

export type StudentBenefitRecord = {
  accountId: string
  verified: boolean
  verifiedAt: number | null
  expiresAt: number | null
  verificationMethod: StudentVerificationMethod
  /** SHA-256 of normalized academic email or review ticket id — global dedupe. */
  verificationReference: string
  institutionHint?: string
  status: StudentBenefitStatus
  createdAt: number
  updatedAt: number
}

export type StudentVerificationRequestRecord = {
  accountId: string
  academicEmail: string
  tokenHash: string
  expiresAt: number
  verificationReference: string
  institutionHint?: string
  createdAt: number
}

export const STUDENT_BENEFIT_DURATION_MS = STUDENT_PROGRAM_DURATION_MONTHS * 30 * 24 * 60 * 60 * 1000
