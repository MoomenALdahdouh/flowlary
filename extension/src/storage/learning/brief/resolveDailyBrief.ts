import {
  createEmptyDailyBriefQuota,
  DAILY_BRIEF_MAX_GENERATIONS_PER_DAY,
  utcDayKey,
  type DailyBriefQuotaV1,
  type DailyLearningBrief,
  type DailyLearningBriefSnapshot,
} from '@flowlary/shared'
import { getAccountScopedStorage, type AccountOwnedKind } from '../../accountScopedStorage.ts'
import type { FlowlaryStorage } from '../../index.ts'
import { computeDailyBriefSnapshot } from './computeDailyBrief.ts'
import { getLearningProfile } from '../index.ts'
import { getLearningEventService, ensureLearningEventsInitialized } from '../events/index.ts'
import { getPracticeSessionStore, normalizePracticeSessionStore } from '../practice/sessions.ts'
import { readAccountSession } from '../../../config/accountAuth.ts'

const BRIEF_QUOTA_KIND: AccountOwnedKind = 'learningBriefQuota'

function normalizeDailyBriefQuota(raw: unknown, dayKey: string): DailyBriefQuotaV1 {
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
        ? (value.cachedBrief as DailyLearningBriefSnapshot)
        : null,
  }
}

async function readQuota(storage: FlowlaryStorage, dayKey: string): Promise<DailyBriefQuotaV1> {
  const scoped = getAccountScopedStorage(storage)
  if (!scoped.getActiveAccountId()) return createEmptyDailyBriefQuota(dayKey)
  const raw = await storage.get(scoped.keyFor(BRIEF_QUOTA_KIND), 'local')
  return normalizeDailyBriefQuota(raw, dayKey)
}

async function writeQuota(storage: FlowlaryStorage, quota: DailyBriefQuotaV1): Promise<void> {
  const scoped = getAccountScopedStorage(storage)
  if (!scoped.getActiveAccountId()) return
  await storage.set(scoped.keyFor(BRIEF_QUOTA_KIND), quota, 'local')
}

function signedOutBrief(now = Date.now()): DailyLearningBrief {
  const dayKey = utcDayKey(now)
  return {
    state: 'signed_out',
    evidenceVersion: 'signed_out',
    generatedAt: now,
    dayKey,
    focusCategory: null,
    recurringPattern: null,
    improvement: null,
    recommendedAction: { kind: 'keep_writing' },
    writingEventCount: 0,
    wordsWritten: 0,
    practiceSessionsThisWeek: 0,
    hasRecentWriting: false,
    fromCache: false,
    generationsUsedToday: 0,
    generationsRemainingToday: DAILY_BRIEF_MAX_GENERATIONS_PER_DAY,
    limitReached: false,
  }
}

function wrapBrief(
  snapshot: DailyLearningBriefSnapshot,
  quota: DailyBriefQuotaV1,
  fromCache: boolean,
  limitReached: boolean,
): DailyLearningBrief {
  return {
    ...snapshot,
    fromCache,
    generationsUsedToday: quota.generationsUsed,
    generationsRemainingToday: Math.max(0, DAILY_BRIEF_MAX_GENERATIONS_PER_DAY - quota.generationsUsed),
    limitReached,
  }
}

export async function resolveDailyLearningBrief(
  storage: FlowlaryStorage,
  now = Date.now(),
): Promise<DailyLearningBrief> {
  const session = await readAccountSession(storage)
  if (!session) {
    return signedOutBrief(now)
  }

  await ensureLearningEventsInitialized(storage)
  const dayKey = utcDayKey(now)
  const quota = await readQuota(storage, dayKey)

  const store = await getLearningEventService(storage).getStore()
  const practiceSessions = await getPracticeSessionStore(storage).list()
  const sessionStore = normalizePracticeSessionStore({ version: 1, sessions: practiceSessions })
  const profile = await getLearningProfile(storage)
  const snapshot = computeDailyBriefSnapshot(store, sessionStore, profile, now)

  if (quota.cachedBrief?.evidenceVersion === snapshot.evidenceVersion) {
    return wrapBrief(snapshot, quota, true, false)
  }

  if (quota.generationsUsed >= DAILY_BRIEF_MAX_GENERATIONS_PER_DAY) {
    if (quota.cachedBrief) {
      return wrapBrief(quota.cachedBrief, quota, true, true)
    }
    return wrapBrief(snapshot, quota, false, true)
  }

  const nextQuota: DailyBriefQuotaV1 = {
    ...quota,
    dayKey,
    generationsUsed: quota.generationsUsed + 1,
    lastEvidenceVersion: snapshot.evidenceVersion,
    cachedBrief: snapshot,
  }
  await writeQuota(storage, nextQuota)
  return wrapBrief(snapshot, nextQuota, false, false)
}

/** Test helpers */
export async function readDailyBriefQuotaForTests(
  storage: FlowlaryStorage,
  dayKey = utcDayKey(),
): Promise<DailyBriefQuotaV1> {
  return readQuota(storage, dayKey)
}

export async function clearDailyBriefQuotaForTests(storage: FlowlaryStorage): Promise<void> {
  const scoped = getAccountScopedStorage(storage)
  if (!scoped.getActiveAccountId()) return
  await storage.remove(scoped.keyFor(BRIEF_QUOTA_KIND), 'local')
}

export { computeDailyBriefSnapshot } from './computeDailyBrief.ts'
