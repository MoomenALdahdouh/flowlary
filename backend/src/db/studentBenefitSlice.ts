import type { StudentBenefitRecord, StudentVerificationRequestRecord } from './studentTypes.ts'

type StudentSnapshot = {
  benefits: Record<string, StudentBenefitRecord>
  verificationRequests: Record<string, StudentVerificationRequestRecord>
  /** verificationReference → accountId for active/pending dedupe */
  referenceIndex: Record<string, string>
}

let benefits: Record<string, StudentBenefitRecord> = {}
let verificationRequests: Record<string, StudentVerificationRequestRecord> = {}
let referenceIndex: Record<string, string> = {}

export function loadStudentSlice(raw: Partial<StudentSnapshot> | undefined): void {
  benefits = raw?.benefits ?? {}
  verificationRequests = raw?.verificationRequests ?? {}
  referenceIndex = raw?.referenceIndex ?? {}
}

export function studentSliceSnapshot(): StudentSnapshot {
  return { benefits, verificationRequests, referenceIndex }
}

export function getStudentBenefit(accountId: string): StudentBenefitRecord | null {
  return benefits[accountId] ?? null
}

export function upsertStudentBenefit(record: StudentBenefitRecord): StudentBenefitRecord {
  benefits[record.accountId] = record
  if (record.status === 'active' || record.status === 'pending') {
    referenceIndex[record.verificationReference] = record.accountId
  }
  return record
}

export function clearStudentReference(reference: string): void {
  delete referenceIndex[reference]
}

export function findAccountByStudentReference(reference: string): string | null {
  return referenceIndex[reference] ?? null
}

export function getStudentVerificationRequest(accountId: string): StudentVerificationRequestRecord | null {
  return verificationRequests[accountId] ?? null
}

export function setStudentVerificationRequest(record: StudentVerificationRequestRecord): void {
  verificationRequests[record.accountId] = record
}

export function clearStudentVerificationRequest(accountId: string): void {
  delete verificationRequests[accountId]
}

export function findStudentVerificationByTokenHash(tokenHash: string): StudentVerificationRequestRecord | null {
  return Object.values(verificationRequests).find((row) => row.tokenHash === tokenHash) ?? null
}
