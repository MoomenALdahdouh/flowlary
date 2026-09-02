import {
  DAILY_BRIEF_MAX_GENERATIONS_PER_DAY,
  FULL_REPORT_MAX_GENERATIONS_PER_DAY,
  FULL_REPORT_SCHEMA_VERSION,
  computeAllTargetPracticeProgressions,
  deprioritizeStablePatterns,
  adjustRecommendationPatternForProgression,
  validateLearningReportNarration,
  type DailyLearningBrief,
  type DailyLearningBriefSnapshot,
  type FullLearningReport,
  type FullLearningReportNarrative,
  type LearningEventStoreV1,
  type LearningProfile,
  type PracticeSessionStoreV1,
  type UiLocaleCode,
  utcDayKey,
} from '@flowlary/shared'
import { computeDailyBriefSnapshot } from '../learning/brief/computeDailyBrief.ts'
import { computeProgressMetrics, type ProgressMetrics } from '../learning/progress.ts'
import { attachPersonalizationToProgress } from '../learning/personalization.ts'
import { computeLearningAnalysisSnapshot } from '../learning/report/computeLearningAnalysisSnapshot.ts'
import { computePracticeRecommendation } from '../learning/practice/recommendation.ts'
import { listPracticeRecurringTargets } from '../learning/practice/targetSelection.ts'
import { normalizePracticeSessionStore } from '../learning/practice/sessions.ts'
import { buildLearningCoachContext } from '../learning/coach/buildLearningCoachContext.ts'
import { buildDeterministicCoachResponse } from '../learning/coach/buildDeterministicCoach.ts'
import { fetchLearningEvents } from '../../account/learningEventsClient.ts'
import { readWebLearningStore } from '../../lab/webLearningStore.ts'
import {
  fetchRemoteLearningProfile,
  fetchRemotePracticeSessions,
  mergeLearningProfiles,
  mergePracticeStores,
  pushRemoteLearningProfile,
  pushRemotePracticeSessions,
} from '../../account/learningSyncClient.ts'
import {
  readDailyBriefQuota,
  readFullReportQuota,
  readLearningProfile,
  readPracticeSessionStore,
  writeLearningProfile,
  writePracticeSessionStore,
  writeDailyBriefQuota,
  writeFullReportQuota,
} from '../storage/webLocalStore.ts'
import { fetchWebLearningCoach, fetchWebLearningReportNarration } from '../api/learningAi.ts'
import { buildWebDeterministicReportNarrative } from './reportNarrative.ts'

export type WebLearningBundle = {
  store: LearningEventStoreV1
  profile: LearningProfile
  practiceStore: PracticeSessionStoreV1
}

export type LoadWebLearningBundleResult =
  | { ok: true; bundle: WebLearningBundle; degraded: boolean }
  | { ok: false; code: 'auth' }

export async function loadWebLearningBundle(accountId: string): Promise<LoadWebLearningBundleResult> {
  const [eventsResult, profileResult, practiceResult] = await Promise.all([
    fetchLearningEvents(),
    fetchRemoteLearningProfile(),
    fetchRemotePracticeSessions(),
  ])

  if (
    (!eventsResult.ok && eventsResult.code === 'auth')
    || (!profileResult.ok && profileResult.code === 'auth')
    || (!practiceResult.ok && practiceResult.code === 'auth')
  ) {
    return { ok: false, code: 'auth' }
  }

  const store = eventsResult.ok ? eventsResult.store : readWebLearningStore(accountId)
  const remoteProfile = profileResult.ok ? profileResult.value : null
  const remotePractice = practiceResult.ok ? practiceResult.value : null

  const localProfile = readLearningProfile(accountId)
  const localPractice = readPracticeSessionStore(accountId)
  const profile = mergeLearningProfiles(localProfile, remoteProfile)
  const practiceStore = mergePracticeStores(localPractice, remotePractice)

  writeLearningProfile(accountId, profile)
  writePracticeSessionStore(accountId, practiceStore)

  if (profileResult.ok && remoteProfile && profile.updatedAt > remoteProfile.updatedAt) {
    void pushRemoteLearningProfile(profile)
  }
  if (practiceResult.ok && remotePractice) {
    const localIds = new Set(localPractice.sessions.map((session) => session.id))
    const hasLocalOnly = practiceStore.sessions.some((session) => !localIds.has(session.id))
    if (hasLocalOnly || localPractice.sessions.length > remotePractice.sessions.length) {
      void pushRemotePracticeSessions(practiceStore)
    }
  } else if (practiceResult.ok && localPractice.sessions.length > 0) {
    void pushRemotePracticeSessions(practiceStore)
  }

  return {
    ok: true,
    degraded: !eventsResult.ok || !profileResult.ok || !practiceResult.ok,
    bundle: {
      store,
      profile,
      practiceStore,
    },
  }
}

export async function saveWebLearningProfile(accountId: string, profile: LearningProfile): Promise<void> {
  writeLearningProfile(accountId, profile)
  await pushRemoteLearningProfile(profile)
}

export function computeWebProgress(
  bundle: WebLearningBundle,
): ProgressMetrics {
  const metrics = computeProgressMetrics(bundle.store, bundle.practiceStore)
  return attachPersonalizationToProgress(metrics, bundle.profile, bundle.store.events)
}

export function resolveWebDailyBrief(
  bundle: WebLearningBundle,
  accountId: string,
  now = Date.now(),
): DailyLearningBrief {
  const dayKey = utcDayKey(now)
  const quota = readDailyBriefQuota(accountId, dayKey)
  const snapshot = computeDailyBriefSnapshot(bundle.store, bundle.practiceStore, bundle.profile, now)

  if (quota.cachedBrief?.evidenceVersion === snapshot.evidenceVersion) {
    return wrapBrief(snapshot, quota, true, false)
  }

  if (quota.generationsUsed >= DAILY_BRIEF_MAX_GENERATIONS_PER_DAY) {
    if (quota.cachedBrief) {
      return wrapBrief(quota.cachedBrief, quota, true, true)
    }
    return wrapBrief(snapshot, quota, false, true)
  }

  const nextQuota = {
    ...quota,
    dayKey,
    generationsUsed: quota.generationsUsed + 1,
    lastEvidenceVersion: snapshot.evidenceVersion,
    cachedBrief: snapshot,
  }
  writeDailyBriefQuota(accountId, nextQuota)
  return wrapBrief(snapshot, nextQuota, false, false)
}

function wrapBrief(
  snapshot: DailyLearningBriefSnapshot,
  quota: { generationsUsed: number },
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

export type WebPracticeHome = {
  recommendation: ReturnType<typeof computePracticeRecommendation>
  eventCount: number
  sessionsCompleted: number
  recurringTargets: ReturnType<typeof listPracticeRecurringTargets>
  targetProgressions: ReturnType<typeof computeAllTargetPracticeProgressions>
}

export function computeWebPracticeHome(bundle: WebLearningBundle): WebPracticeHome {
  const baseRecommendation = computePracticeRecommendation(
    bundle.store.events,
    Date.now(),
    bundle.profile.focusAreas,
  )
  const recurringTargets = listPracticeRecurringTargets(bundle.store.events)
  const sessions = bundle.practiceStore.sessions
  const progressions = computeAllTargetPracticeProgressions(recurringTargets, bundle.store.events, sessions)
  const filteredTargets = deprioritizeStablePatterns(recurringTargets, progressions)
  const adjusted = adjustRecommendationPatternForProgression(
    baseRecommendation,
    progressions,
    filteredTargets,
  )
  const recommendation =
    baseRecommendation.state === 'ready' && adjusted.pattern
      ? { ...baseRecommendation, focus: adjusted.focus ?? baseRecommendation.focus, pattern: adjusted.pattern }
      : baseRecommendation.state === 'ready' && !adjusted.pattern && adjusted.focus
        ? { ...baseRecommendation, focus: adjusted.focus, pattern: undefined }
        : baseRecommendation

  return {
    recommendation,
    eventCount: bundle.store.events.filter((event) => event.source === 'writing').length,
    sessionsCompleted: sessions.filter((session) => session.status === 'completed').length,
    recurringTargets: filteredTargets,
    targetProgressions: progressions,
  }
}

export async function resolveWebFullLearningReport(
  bundle: WebLearningBundle,
  accountId: string,
  locale: UiLocaleCode,
  isProOrTrial: boolean,
  now = Date.now(),
): Promise<FullLearningReport> {
  const dayKey = utcDayKey(now)
  const quota = readFullReportQuota(accountId, dayKey)
  const snapshot = computeLearningAnalysisSnapshot(
    bundle.store,
    bundle.practiceStore,
    bundle.profile,
    now,
  )

  const cacheIdentity = `${snapshot.evidenceVersion}:${locale}:${FULL_REPORT_SCHEMA_VERSION}`
  const cached = quota.cachedReport
  if (cached?.snapshot && `${cached.snapshot.evidenceVersion}:${cached.locale}:${FULL_REPORT_SCHEMA_VERSION}` === cacheIdentity) {
    return {
      ...cached,
      fromCache: true,
      generationsUsedToday: quota.generationsUsed,
      limitReached: quota.generationsUsed >= FULL_REPORT_MAX_GENERATIONS_PER_DAY,
      aiNarrationAvailable: isProOrTrial,
    }
  }

  if (quota.generationsUsed >= FULL_REPORT_MAX_GENERATIONS_PER_DAY) {
    if (cached) {
      return {
        ...cached,
        fromCache: true,
        generationsUsedToday: quota.generationsUsed,
        limitReached: true,
        aiNarrationAvailable: isProOrTrial,
      }
    }
    const deterministic = buildWebDeterministicReportNarrative(snapshot)
    return {
      state: snapshot.evidenceQuality,
      snapshot,
      narrative: deterministic,
      locale,
      fromCache: false,
      generationsUsedToday: quota.generationsUsed,
      limitReached: true,
      aiNarrationAvailable: isProOrTrial,
    }
  }

  let narrative: FullLearningReportNarrative = buildWebDeterministicReportNarrative(snapshot)

  if (isProOrTrial && snapshot.evidenceQuality !== 'no_data') {
    const ai = await fetchWebLearningReportNarration(snapshot, locale)
    if (ai) {
      const validated = validateLearningReportNarration(ai, snapshot)
      if (validated) {
        narrative = { ...validated, source: 'ai' }
      }
    }
  }

  const report: FullLearningReport = {
    state: snapshot.evidenceQuality,
    snapshot,
    narrative,
    locale,
    fromCache: false,
    generationsUsedToday: quota.generationsUsed + 1,
    limitReached: false,
    aiNarrationAvailable: isProOrTrial,
  }

  const nextQuota = {
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
  writeFullReportQuota(accountId, nextQuota)

  return {
    ...report,
    generationsUsedToday: nextQuota.generationsUsed,
  }
}

export async function resolveWebLearningCoach(
  bundle: WebLearningBundle,
  accountId: string,
  locale: UiLocaleCode,
  mode: import('@flowlary/shared').LearningCoachMode,
  question: string | null,
  isProOrTrial: boolean,
): Promise<import('@flowlary/shared').LearningCoachResponse> {
  const briefSnapshot = computeDailyBriefSnapshot(
    bundle.store,
    bundle.practiceStore,
    bundle.profile,
  )
  const snapshot = computeLearningAnalysisSnapshot(
    bundle.store,
    bundle.practiceStore,
    bundle.profile,
  )
  const context = buildLearningCoachContext({
    snapshot,
    brief: briefSnapshot,
    profile: bundle.profile,
    locale,
    mode,
    question,
  })

  if (isProOrTrial) {
    const ai = await fetchWebLearningCoach(context, locale)
    if (ai) return ai
  }

  return buildDeterministicCoachResponse(context, mode)
}

export function saveWebPracticeSession(
  accountId: string,
  session: import('@flowlary/shared').PracticeSessionRecord,
): void {
  const store = readPracticeSessionStore(accountId)
  const next = normalizePracticeSessionStore({
    version: store.version,
    sessions: [session, ...store.sessions.filter((item) => item.id !== session.id)],
  })
  writePracticeSessionStore(accountId, next)
  void pushRemotePracticeSessions(next)
}
