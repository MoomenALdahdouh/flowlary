import type { LearningEventStoreV1 } from '@flowlary/shared'

/** Mutable slice accessor — wired from store.ts snapshot. */
export const learningEventsSnapshot = {
  learningEventsByAccount: {} as Record<string, LearningEventStoreV1>,
}

export function ensureLearningEventsSliceLoaded(
  raw: Record<string, LearningEventStoreV1> | undefined,
): void {
  learningEventsSnapshot.learningEventsByAccount = raw ?? {}
}
