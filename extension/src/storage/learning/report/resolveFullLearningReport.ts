import {
  createEmptyFullReportQuota,
  FULL_REPORT_MAX_GENERATIONS_PER_DAY,
  FULL_REPORT_SCHEMA_VERSION,
  hasProProductExperience,
  utcDayKey,
  validateLearningReportNarration,
  type FullLearningReport,
  type FullLearningReportNarrative,
  type FullReportQuotaV1,
  type LearningAnalysisSnapshot,
  type UiLocaleCode,
} from '@flowlary/shared'
import { getAccountScopedStorage, type AccountOwnedKind } from '../../accountScopedStorage.ts'
import type { FlowlaryStorage } from '../../index.ts'
import { computeLearningAnalysisSnapshot } from './computeLearningAnalysisSnapshot.ts'
import { buildDeterministicFullReportNarrative } from './buildDeterministicReport.ts'
import { getLearningProfile } from '../index.ts'
import { getLearningEventService, ensureLearningEventsInitialized } from '../events/index.ts'
import { getPracticeSessionStore, normalizePracticeSessionStore } from '../practice/sessions.ts'
import { readAccountSession } from '../../../config/accountAuth.ts'
import { readUiLocale } from '../../../popup/i18n/localeStorage.ts'
import type { UiLocale } from '../../../popup/i18n/types.ts'
import { activeAccountContext } from '../../activeAccountContext.ts'
import { getEntitlementService } from '../../../entitlement/service.ts'
import { fetchLearningReportNarration } from '../../../background/learningReportNarrate.ts'

const REPORT_QUOTA_KIND: AccountOwnedKind = 'learningReportQuota'

function normalizeFullReportQuota(raw: unknown, dayKey: string): FullReportQuotaV1 {
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
        ? (value.cachedReport as FullReportQuotaV1['cachedReport'])
        : null,
  }
}

async function readQuota(storage: FlowlaryStorage, dayKey: string): Promise<FullReportQuotaV1> {
  const scoped = getAccountScopedStorage(storage)
  if (!scoped.getActiveAccountId()) return createEmptyFullReportQuota(dayKey)
  const raw = await storage.get(scoped.keyFor(REPORT_QUOTA_KIND), 'local')
  return normalizeFullReportQuota(raw, dayKey)
}

async function writeQuota(storage: FlowlaryStorage, quota: FullReportQuotaV1): Promise<void> {
  const scoped = getAccountScopedStorage(storage)
  if (!scoped.getActiveAccountId()) return
  await storage.set(scoped.keyFor(REPORT_QUOTA_KIND), quota, 'local')
}

function signedOutReport(locale: UiLocale, now = Date.now()): FullLearningReport {
  return {
    state: 'signed_out',
    snapshot: null,
    narrative: null,
    locale,
    fromCache: false,
    generationsUsedToday: 0,
    limitReached: false,
    aiNarrationAvailable: false,
  }
}

function cacheIdentity(snapshot: LearningAnalysisSnapshot, locale: UiLocaleCode): string {
  return `${snapshot.evidenceVersion}:${locale}:${FULL_REPORT_SCHEMA_VERSION}`
}

function wrapReport(
  snapshot: LearningAnalysisSnapshot,
  narrative: FullLearningReportNarrative,
  locale: UiLocaleCode,
  aiNarrationAvailable: boolean,
  fromCache: boolean,
  generationsUsed: number,
  limitReached: boolean,
): FullLearningReport {
  return {
    state: snapshot.evidenceQuality,
    snapshot,
    narrative,
    locale,
    fromCache,
    generationsUsedToday: generationsUsed,
    limitReached,
    aiNarrationAvailable,
  }
}

async function maybeEnhanceWithAiNarration(
  storage: FlowlaryStorage,
  snapshot: LearningAnalysisSnapshot,
  deterministic: FullLearningReportNarrative,
  locale: UiLocaleCode,
): Promise<FullLearningReportNarrative> {
  const entitlement = await getEntitlementService(storage).getSnapshot()
  const aiAvailable = hasProProductExperience(entitlement)
  if (!aiAvailable) return deterministic

  const accountSnapshot = activeAccountContext.snapshot()
  const ai = await fetchLearningReportNarration(snapshot, locale, accountSnapshot)
  if (!ai) return deterministic

  const validated = validateLearningReportNarration(ai, snapshot)
  if (!validated) return deterministic

  return {
    overview: validated.overview,
    strengths: validated.strengths,
    focusAreas: validated.focusAreas,
    improvements: validated.improvements,
    recommendations: validated.recommendations,
    nextSteps: validated.nextSteps,
    source: 'ai',
  }
}


export async function resolveFullLearningReport(
  storage: FlowlaryStorage,
  now = Date.now(),
): Promise<FullLearningReport> {
  const locale = (await readUiLocale()) as UiLocaleCode
  const session = await readAccountSession(storage)
  if (!session) {
    return signedOutReport(locale, now)
  }

  await ensureLearningEventsInitialized(storage)
  const dayKey = utcDayKey(now)
  const quota = await readQuota(storage, dayKey)

  const store = await getLearningEventService(storage).getStore()
  const practiceSessions = await getPracticeSessionStore(storage).list()
  const sessionStore = normalizePracticeSessionStore({ version: 1, sessions: practiceSessions })
  const profile = await getLearningProfile(storage)
  const snapshot = computeLearningAnalysisSnapshot(store, sessionStore, profile, now)

  const entitlement = await getEntitlementService(storage).getSnapshot()
  const aiNarrationAvailable = hasProProductExperience(entitlement)

  const cached = quota.cachedReport
  if (
    cached?.snapshot &&
    cacheIdentity(snapshot, locale) === cacheIdentity(cached.snapshot, cached.locale)
  ) {
    return {
      ...cached,
      fromCache: true,
      generationsUsedToday: quota.generationsUsed,
      limitReached: quota.generationsUsed >= FULL_REPORT_MAX_GENERATIONS_PER_DAY,
      aiNarrationAvailable,
    }
  }

  if (quota.generationsUsed >= FULL_REPORT_MAX_GENERATIONS_PER_DAY) {
    if (cached) {
      return {
        ...cached,
        fromCache: true,
        generationsUsedToday: quota.generationsUsed,
        limitReached: true,
        aiNarrationAvailable,
      }
    }
    const deterministic = buildDeterministicFullReportNarrative(snapshot, locale as UiLocale)
    return wrapReport(snapshot, deterministic, locale, aiNarrationAvailable, false, quota.generationsUsed, true)
  }

  let narrative = buildDeterministicFullReportNarrative(snapshot, locale as UiLocale)
  narrative = await maybeEnhanceWithAiNarration(storage, snapshot, narrative, locale)

  const report = wrapReport(
    snapshot,
    narrative,
    locale,
    aiNarrationAvailable,
    false,
    quota.generationsUsed + 1,
    false,
  )

  const nextQuota: FullReportQuotaV1 = {
    ...quota,
    dayKey,
    generationsUsed: quota.generationsUsed + 1,
    lastEvidenceVersion: snapshot.evidenceVersion,
    cachedReport: {
      state: report.state,
      snapshot: report.snapshot,
      narrative: report.narrative,
      locale: report.locale,
      aiNarrationAvailable: report.aiNarrationAvailable,
    },
  }
  await writeQuota(storage, nextQuota)

  return {
    ...report,
    generationsUsedToday: nextQuota.generationsUsed,
  }
}

export async function readFullReportQuotaForTests(
  storage: FlowlaryStorage,
  dayKey = utcDayKey(),
): Promise<FullReportQuotaV1> {
  return readQuota(storage, dayKey)
}

export async function clearFullReportQuotaForTests(storage: FlowlaryStorage): Promise<void> {
  const scoped = getAccountScopedStorage(storage)
  if (!scoped.getActiveAccountId()) return
  await storage.remove(scoped.keyFor(REPORT_QUOTA_KIND), 'local')
}

export { computeLearningAnalysisSnapshot } from './computeLearningAnalysisSnapshot.ts'
