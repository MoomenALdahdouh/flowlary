import {
  createDefaultLearningProfile,
  DEFAULT_FOCUS_AREAS,
  DEFAULT_LEARNING_LANGUAGE,
  isLearningFocus,
  isLearningLevel,
  isOnboardingStep,
  LEARNING_PROFILE_VERSION,
  MAX_PRACTICE_SESSIONS,
  ONBOARDING_VERSION,
  PRACTICE_SESSION_STORE_VERSION,
  type LearningProfile,
  type PracticeSessionRecord,
  type PracticeSessionStoreV1,
} from '@flowlary/shared'
import { ensureLoaded, touch } from '../db/store.ts'
import { learningSyncSnapshot } from '../db/learningSyncStoreSlice.ts'
import { clearAccountLearningEvents } from './learningEventsService.ts'

function emptyPracticeStore(): PracticeSessionStoreV1 {
  return { version: PRACTICE_SESSION_STORE_VERSION, sessions: [] }
}

export function normalizeServerLearningProfile(raw: unknown, now = Date.now()): LearningProfile | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const value = raw as Partial<LearningProfile>
  const defaults = createDefaultLearningProfile(now)
  const focusAreas = Array.isArray(value.focusAreas)
    ? value.focusAreas.filter(isLearningFocus)
    : defaults.focusAreas
  const level = isLearningLevel(value.level) ? value.level : undefined
  const nativeLanguage =
    typeof value.nativeLanguage === 'string' && value.nativeLanguage.trim()
      ? value.nativeLanguage.trim()
      : undefined
  const onboardingStep =
    value.onboardingStep === null
      ? null
      : isOnboardingStep(value.onboardingStep)
        ? value.onboardingStep
        : defaults.onboardingStep

  return {
    version: typeof value.version === 'number' ? value.version : LEARNING_PROFILE_VERSION,
    learningLanguage:
      typeof value.learningLanguage === 'string' && value.learningLanguage.trim()
        ? value.learningLanguage.trim()
        : DEFAULT_LEARNING_LANGUAGE,
    nativeLanguage,
    level,
    focusAreas: focusAreas.length > 0 ? focusAreas : [...DEFAULT_FOCUS_AREAS],
    onboardingCompleted: value.onboardingCompleted === true,
    onboardingVersion:
      typeof value.onboardingVersion === 'number' ? value.onboardingVersion : ONBOARDING_VERSION,
    onboardingStep,
    setupPromptDismissed: value.setupPromptDismissed === true,
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : now,
  }
}

function sanitizePracticeSession(raw: unknown): PracticeSessionRecord | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const value = raw as Partial<PracticeSessionRecord>
  if (typeof value.id !== 'string' || typeof value.startedAt !== 'number') return null
  const focus = value.focus
  if (
    focus !== 'recommended' &&
    focus !== 'spelling' &&
    focus !== 'grammar' &&
    focus !== 'wording'
  ) {
    return null
  }
  return {
    id: value.id,
    version: typeof value.version === 'number' ? value.version : 1,
    startedAt: value.startedAt,
    completedAt: typeof value.completedAt === 'number' ? value.completedAt : undefined,
    focus,
    targetPattern:
      value.targetPattern &&
      typeof value.targetPattern === 'object' &&
      (value.targetPattern.category === 'spelling' ||
        value.targetPattern.category === 'grammar' ||
        value.targetPattern.category === 'wording')
        ? {
            category: value.targetPattern.category,
            normalizedOriginal: String(value.targetPattern.normalizedOriginal ?? ''),
            displayOriginal: String(value.targetPattern.displayOriginal ?? ''),
            displayCorrected: String(value.targetPattern.displayCorrected ?? ''),
            count: Number(value.targetPattern.count ?? 0),
          }
        : undefined,
    itemsAttempted: typeof value.itemsAttempted === 'number' ? value.itemsAttempted : 0,
    itemsCompleted: typeof value.itemsCompleted === 'number' ? value.itemsCompleted : 0,
    correctionsDetected: typeof value.correctionsDetected === 'number' ? value.correctionsDetected : 0,
    correctionsAccepted: typeof value.correctionsAccepted === 'number' ? value.correctionsAccepted : 0,
    correctionsRejected: typeof value.correctionsRejected === 'number' ? value.correctionsRejected : 0,
    wordsWritten: typeof value.wordsWritten === 'number' ? value.wordsWritten : 0,
    status: value.status === 'abandoned' ? 'abandoned' : 'completed',
  }
}

export function normalizeServerPracticeStore(raw: unknown): PracticeSessionStoreV1 {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return emptyPracticeStore()
  const value = raw as Partial<PracticeSessionStoreV1>
  const sessions: PracticeSessionRecord[] = []
  if (Array.isArray(value.sessions)) {
    for (const item of value.sessions) {
      const session = sanitizePracticeSession(item)
      if (session) sessions.push(session)
    }
  }
  sessions.sort((a, b) => (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt))
  return {
    version: PRACTICE_SESSION_STORE_VERSION,
    sessions: sessions.slice(0, MAX_PRACTICE_SESSIONS),
  }
}

export function getAccountLearningProfile(accountId: string): LearningProfile | null {
  ensureLoaded()
  return learningSyncSnapshot.learningProfileByAccount[accountId] ?? null
}

export function putAccountLearningProfile(accountId: string, profile: LearningProfile): LearningProfile {
  ensureLoaded()
  learningSyncSnapshot.learningProfileByAccount[accountId] = profile
  touch()
  return profile
}

export function getAccountPracticeSessions(accountId: string): PracticeSessionStoreV1 {
  ensureLoaded()
  return learningSyncSnapshot.practiceSessionsByAccount[accountId] ?? emptyPracticeStore()
}

export function mergeAccountPracticeSessions(
  accountId: string,
  incoming: PracticeSessionStoreV1,
): { store: PracticeSessionStoreV1; added: number } {
  ensureLoaded()
  const current = getAccountPracticeSessions(accountId)
  const byId = new Map(current.sessions.map((session) => [session.id, session]))
  let added = 0
  for (const session of incoming.sessions) {
    if (!session?.id) continue
    if (!byId.has(session.id)) added += 1
    byId.set(session.id, session)
  }
  const merged = [...byId.values()].sort(
    (a, b) => (b.completedAt ?? b.startedAt) - (a.completedAt ?? a.startedAt),
  )
  const store: PracticeSessionStoreV1 = {
    version: PRACTICE_SESSION_STORE_VERSION,
    sessions: merged.slice(0, MAX_PRACTICE_SESSIONS),
  }
  learningSyncSnapshot.practiceSessionsByAccount[accountId] = store
  touch()
  return { store, added }
}

export function clearAccountLearningData(accountId: string): void {
  clearAccountLearningEvents(accountId)
  ensureLoaded()
  delete learningSyncSnapshot.learningProfileByAccount[accountId]
  delete learningSyncSnapshot.practiceSessionsByAccount[accountId]
  touch()
}

export function resetAccountLearningSyncForTests(): void {
  ensureLoaded()
  learningSyncSnapshot.learningProfileByAccount = {}
  learningSyncSnapshot.practiceSessionsByAccount = {}
}
