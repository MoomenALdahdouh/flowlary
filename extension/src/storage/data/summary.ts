import type { DataSummary } from '@flowlary/shared'
import type { FlowlaryStorage } from '../index.ts'
import { getUnifiedHistoryStore } from '../facade.ts'
import { getLearningProfile } from '../learning/index.ts'
import { getLearningEventService } from '../learning/events/index.ts'
import { getPracticeSessionStore } from '../learning/practice/sessions.ts'

export async function computeDataSummary(storage: FlowlaryStorage): Promise<DataSummary> {
  await getLearningEventService(storage).initialize()
  const [history, profile, eventStore, sessions] = await Promise.all([
    getUnifiedHistoryStore(storage),
    getLearningProfile(storage),
    getLearningEventService(storage).getStore(),
    getPracticeSessionStore(storage).list(),
  ])

  const profileConfigured = Boolean(
    profile.onboardingCompleted ||
      profile.level ||
      profile.nativeLanguage ||
      profile.focusAreas.length > 0,
  )

  return {
    activityCount: history.entries.length,
    learningEventCount: eventStore.events.length,
    practiceSessionCount: sessions.length,
    profileConfigured,
    onboardingCompleted: profile.onboardingCompleted,
  }
}
