import {
  COACH_MAX_AI_INTERACTIONS_PER_DAY,
  createEmptyLearningCoachQuota,
  hasProProductExperience,
  normalizeCoachQuestion,
  buildCoachCacheKey,
  utcDayKey,
  validateLearningCoachResponse,
  type LearningCoachContext,
  type LearningCoachMode,
  type LearningCoachQuotaV1,
  type LearningCoachResponse,
  type LearningCoachResult,
  type UiLocaleCode,
} from '@flowlary/shared'
import { getAccountScopedStorage, type AccountOwnedKind } from '../../accountScopedStorage.ts'
import type { FlowlaryStorage } from '../../index.ts'
import { computeLearningAnalysisSnapshot } from '../report/computeLearningAnalysisSnapshot.ts'
import { computeDailyBriefSnapshot } from '../brief/computeDailyBrief.ts'
import { getLearningProfile } from '../index.ts'
import { getLearningEventService, ensureLearningEventsInitialized } from '../events/index.ts'
import { getPracticeSessionStore, normalizePracticeSessionStore } from '../practice/sessions.ts'
import { readAccountSession } from '../../../config/accountAuth.ts'
import { readUiLocale } from '../../../popup/i18n/localeStorage.ts'
import type { UiLocale } from '../../../popup/i18n/types.ts'
import { activeAccountContext } from '../../activeAccountContext.ts'
import { getEntitlementService } from '../../../entitlement/service.ts'
import { fetchLearningCoachNarration } from '../../../background/learningCoach.ts'
import { buildLearningCoachContext } from './buildLearningCoachContext.ts'
import { buildDeterministicCoachResponse } from './buildDeterministicCoach.ts'

const COACH_QUOTA_KIND: AccountOwnedKind = 'learningCoachQuota'
const MAX_CACHE_ENTRIES = 24

function normalizeCoachQuota(raw: unknown, dayKey: string): LearningCoachQuotaV1 {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return createEmptyLearningCoachQuota(dayKey)
  }
  const value = raw as Partial<LearningCoachQuotaV1>
  if (value.version !== 1 || value.dayKey !== dayKey) {
    return createEmptyLearningCoachQuota(dayKey)
  }
  const cachedEntries = Array.isArray(value.cachedEntries)
    ? value.cachedEntries.filter(
        (entry) =>
          entry &&
          typeof entry === 'object' &&
          typeof (entry as { cacheKey?: string }).cacheKey === 'string' &&
          (entry as { response?: unknown }).response &&
          typeof (entry as { response?: { summary?: string } }).response?.summary === 'string',
      )
    : []
  return {
    version: 1,
    dayKey,
    aiInteractionsUsed:
      typeof value.aiInteractionsUsed === 'number' ? Math.max(0, value.aiInteractionsUsed) : 0,
    cachedEntries: cachedEntries as LearningCoachQuotaV1['cachedEntries'],
  }
}

async function readQuota(storage: FlowlaryStorage, dayKey: string): Promise<LearningCoachQuotaV1> {
  const scoped = getAccountScopedStorage(storage)
  if (!scoped.getActiveAccountId()) return createEmptyLearningCoachQuota(dayKey)
  const raw = await storage.get(scoped.keyFor(COACH_QUOTA_KIND), 'local')
  return normalizeCoachQuota(raw, dayKey)
}

async function writeQuota(storage: FlowlaryStorage, quota: LearningCoachQuotaV1): Promise<void> {
  const scoped = getAccountScopedStorage(storage)
  if (!scoped.getActiveAccountId()) return
  await storage.set(scoped.keyFor(COACH_QUOTA_KIND), quota, 'local')
}

function signedOutResult(locale: UiLocale): LearningCoachResult {
  return {
    state: 'signed_out',
    response: {
      summary: '',
      observations: [],
      recommendations: [],
      explanations: [],
      actions: [],
      evidenceReferences: [],
      source: 'deterministic',
    },
    fromCache: false,
    aiAvailable: false,
    aiUsed: false,
    interactionsUsedToday: 0,
    interactionsRemainingToday: 0,
    limitReached: false,
  }
}

function resolveResultState(context: LearningCoachContext): LearningCoachResult['state'] {
  if (context.briefState === 'empty' || context.evidenceQuality === 'no_data') return 'empty'
  if (context.briefState === 'insufficient' || context.evidenceQuality === 'insufficient') {
    return 'insufficient'
  }
  return 'ready'
}

function upsertCache(
  quota: LearningCoachQuotaV1,
  cacheKey: string,
  response: LearningCoachResponse,
): LearningCoachQuotaV1 {
  const filtered = quota.cachedEntries.filter((entry) => entry.cacheKey !== cacheKey)
  return {
    ...quota,
    cachedEntries: [{ cacheKey, response }, ...filtered].slice(0, MAX_CACHE_ENTRIES),
  }
}

export async function resolveLearningCoach(
  storage: FlowlaryStorage,
  mode: LearningCoachMode,
  question: string | null,
  now = Date.now(),
): Promise<LearningCoachResult> {
  const locale = (await readUiLocale()) as UiLocaleCode
  const session = await readAccountSession(storage)
  if (!session) {
    return signedOutResult(locale as UiLocale)
  }

  await ensureLearningEventsInitialized(storage)
  const dayKey = utcDayKey(now)
  let quota = await readQuota(storage, dayKey)

  const store = await getLearningEventService(storage).getStore()
  const practiceSessions = await getPracticeSessionStore(storage).list()
  const sessionStore = normalizePracticeSessionStore({ version: 1, sessions: practiceSessions })
  const profile = await getLearningProfile(storage)
  const snapshot = computeLearningAnalysisSnapshot(store, sessionStore, profile, now)
  const brief = computeDailyBriefSnapshot(store, sessionStore, profile, now)

  const normalizedQuestion = question ? normalizeCoachQuestion(question) : null
  const context = buildLearningCoachContext({
    snapshot,
    brief,
    profile,
    locale,
    mode,
    question: normalizedQuestion,
  })

  const cacheKey = buildCoachCacheKey(context.evidenceVersion, locale, mode, normalizedQuestion)
  const cached = quota.cachedEntries.find((entry) => entry.cacheKey === cacheKey)
  const entitlement = await getEntitlementService(storage).getSnapshot()
  const aiAvailable = hasProProductExperience(entitlement)
  const limitReached = quota.aiInteractionsUsed >= COACH_MAX_AI_INTERACTIONS_PER_DAY

  if (cached) {
    return {
      state: resolveResultState(context),
      response: cached.response,
      fromCache: true,
      aiAvailable,
      aiUsed: cached.response.source === 'ai',
      interactionsUsedToday: quota.aiInteractionsUsed,
      interactionsRemainingToday: Math.max(0, COACH_MAX_AI_INTERACTIONS_PER_DAY - quota.aiInteractionsUsed),
      limitReached,
    }
  }

  let response = buildDeterministicCoachResponse(context, mode, locale as UiLocale)
  let aiUsed = false

  if (aiAvailable && !limitReached) {
    try {
      const accountSnapshot = activeAccountContext.snapshot()
      const ai = await fetchLearningCoachNarration(context, locale, accountSnapshot)
      if (ai) {
        const validated = validateLearningCoachResponse(ai, context)
        if (validated) {
          response = validated
          aiUsed = true
        }
      }
    } catch {
      /* deterministic response remains */
    }
  }

  quota = upsertCache(quota, cacheKey, response)
  if (aiUsed) {
    quota = {
      ...quota,
      aiInteractionsUsed: quota.aiInteractionsUsed + 1,
    }
  }
  await writeQuota(storage, quota)

  return {
    state: resolveResultState(context),
    response,
    fromCache: false,
    aiAvailable,
    aiUsed,
    interactionsUsedToday: quota.aiInteractionsUsed,
    interactionsRemainingToday: Math.max(0, COACH_MAX_AI_INTERACTIONS_PER_DAY - quota.aiInteractionsUsed),
    limitReached: quota.aiInteractionsUsed >= COACH_MAX_AI_INTERACTIONS_PER_DAY,
  }
}

export async function readLearningCoachQuotaForTests(
  storage: FlowlaryStorage,
  dayKey = utcDayKey(),
): Promise<LearningCoachQuotaV1> {
  return readQuota(storage, dayKey)
}

export async function clearLearningCoachQuotaForTests(storage: FlowlaryStorage): Promise<void> {
  const scoped = getAccountScopedStorage(storage)
  if (!scoped.getActiveAccountId()) return
  await storage.remove(scoped.keyFor(COACH_QUOTA_KIND), 'local')
}
