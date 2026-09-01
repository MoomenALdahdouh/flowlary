import type { LearningProfile, PracticeSessionStoreV1 } from '@flowlary/shared'

export const learningSyncSnapshot = {
  learningProfileByAccount: {} as Record<string, LearningProfile>,
  practiceSessionsByAccount: {} as Record<string, PracticeSessionStoreV1>,
}

export function ensureLearningSyncSliceLoaded(
  profiles: Record<string, LearningProfile> | undefined,
  practice: Record<string, PracticeSessionStoreV1> | undefined,
): void {
  learningSyncSnapshot.learningProfileByAccount = profiles ?? {}
  learningSyncSnapshot.practiceSessionsByAccount = practice ?? {}
}
