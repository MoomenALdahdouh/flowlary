import {
  createDefaultLearningProfile,
  createEmptyDailyBriefQuota,
  createEmptyFullReportQuota,
  type DailyBriefQuotaV1,
  type FullReportQuotaV1,
  type LearningProfile,
  type PracticeSessionStoreV1,
  utcDayKey,
} from '@flowlary/shared'
import {
  createEmptyPracticeSessionStore,
  normalizePracticeSessionStore,
} from '../learning/practice/sessions.ts'
import { normalizeLearningProfile } from './profile.ts'

const PREFIX = 'flowlary.web.account.'

function scopedKey(accountId: string, suffix: string): string {
  return `${PREFIX}${accountId}.${suffix}`
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value))
}

function removeKey(key: string): void {
  localStorage.removeItem(key)
}

export function readLearningProfile(accountId: string): LearningProfile {
  const raw = readJson<unknown>(scopedKey(accountId, 'learning.profile'))
  return normalizeLearningProfile(raw)
}

export function writeLearningProfile(accountId: string, profile: LearningProfile): void {
  writeJson(scopedKey(accountId, 'learning.profile'), profile)
}

export function readPracticeSessionStore(accountId: string): PracticeSessionStoreV1 {
  const raw = readJson<unknown>(scopedKey(accountId, 'learning.sessions'))
  return normalizePracticeSessionStore(raw)
}

export function writePracticeSessionStore(accountId: string, store: PracticeSessionStoreV1): void {
  writeJson(scopedKey(accountId, 'learning.sessions'), store)
}

function normalizeBriefQuota(raw: unknown, dayKey: string): DailyBriefQuotaV1 {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return createEmptyDailyBriefQuota(dayKey)
  }
  const value = raw as Partial<DailyBriefQuotaV1>
  if (value.version !== 1 || value.dayKey !== dayKey) {
    return createEmptyDailyBriefQuota(dayKey)
  }
  return {
    version: 1,
    dayKey,
    generationsUsed: typeof value.generationsUsed === 'number' ? Math.max(0, value.generationsUsed) : 0,
    lastEvidenceVersion: typeof value.lastEvidenceVersion === 'string' ? value.lastEvidenceVersion : null,
    cachedBrief:
      value.cachedBrief && typeof value.cachedBrief === 'object' && !Array.isArray(value.cachedBrief)
        ? value.cachedBrief
        : null,
  }
}

export function readDailyBriefQuota(accountId: string, dayKey = utcDayKey()): DailyBriefQuotaV1 {
  const raw = readJson<unknown>(scopedKey(accountId, 'learning.briefQuota'))
  return normalizeBriefQuota(raw, dayKey)
}

export function writeDailyBriefQuota(accountId: string, quota: DailyBriefQuotaV1): void {
  writeJson(scopedKey(accountId, 'learning.briefQuota'), quota)
}

function normalizeReportQuota(raw: unknown, dayKey: string): FullReportQuotaV1 {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return createEmptyFullReportQuota(dayKey)
  }
  const value = raw as Partial<FullReportQuotaV1>
  if (value.version !== 1 || value.dayKey !== dayKey) {
    return createEmptyFullReportQuota(dayKey)
  }
  return {
    version: 1,
    dayKey,
    generationsUsed: typeof value.generationsUsed === 'number' ? Math.max(0, value.generationsUsed) : 0,
    lastEvidenceVersion: typeof value.lastEvidenceVersion === 'string' ? value.lastEvidenceVersion : null,
    cachedReport:
      value.cachedReport && typeof value.cachedReport === 'object' && !Array.isArray(value.cachedReport)
        ? value.cachedReport
        : null,
  }
}

export function readFullReportQuota(accountId: string, dayKey = utcDayKey()): FullReportQuotaV1 {
  const raw = readJson<unknown>(scopedKey(accountId, 'learning.reportQuota'))
  return normalizeReportQuota(raw, dayKey)
}

export function writeFullReportQuota(accountId: string, quota: FullReportQuotaV1): void {
  writeJson(scopedKey(accountId, 'learning.reportQuota'), quota)
}

export function clearWebLearningLocalData(accountId: string): void {
  removeKey(scopedKey(accountId, 'learning.sessions'))
  removeKey(scopedKey(accountId, 'learning.briefQuota'))
  removeKey(scopedKey(accountId, 'learning.reportQuota'))
}

export function resetWebLearningProfile(accountId: string): LearningProfile {
  const profile = createDefaultLearningProfile()
  writeLearningProfile(accountId, profile)
  return profile
}
