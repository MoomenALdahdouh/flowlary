import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildLayoutPracticeExercises,
  scoreLayoutPracticeAnswer,
} from '../../extension/src/storage/layoutPractice/exercises.ts'
import { computePracticeRecommendation } from '../../extension/src/storage/learning/practice/recommendation.ts'
import { getLearningEventService } from '../../extension/src/storage/learning/events/index.ts'
import {
  activateTestAccount,
  clearTestAccountContext,
  TEST_ACCOUNT_A,
} from '../helpers/accountIsolation.ts'
import { createMockChromeStorage } from '../helpers/mockChromeStorage.ts'
import {
  flowlaryStorage,
  resetLearningEventServiceForTests,
} from '../../extension/src/storage/index.ts'

describe('WL-6 layout practice isolation', () => {
  const store = createMockChromeStorage()

  beforeEach(async () => {
    store.reset()
    store.install()
    resetLearningEventServiceForTests()
    await clearTestAccountContext()
  })

  afterEach(async () => {
    await clearTestAccountContext()
  })

  it('does not create LearningEvents during a scored layout practice round', async () => {
    await activateTestAccount(TEST_ACCOUNT_A)
    const eventsBefore = await getLearningEventService(flowlaryStorage).getEvents()

    const exercises = buildLayoutPracticeExercises(
      { sourceLayout: 'ar-101', targetLayout: 'en-US-qwerty' },
      3,
    )
    expect(exercises.length).toBeGreaterThan(0)

    for (const exercise of exercises) {
      scoreLayoutPracticeAnswer(exercise.expectedAnswer, exercise)
    }

    const eventsAfter = await getLearningEventService(flowlaryStorage).getEvents()
    expect(eventsAfter).toHaveLength(eventsBefore.length)
  })

  it('does not affect English practice recommendation', async () => {
    await activateTestAccount(TEST_ACCOUNT_A)
    const recommendationBefore = computePracticeRecommendation([], Date.now(), ['grammar'])

    const exercises = buildLayoutPracticeExercises(
      { sourceLayout: 'en-US-qwerty', targetLayout: 'ru-standard' },
      5,
    )
    for (const exercise of exercises) {
      scoreLayoutPracticeAnswer(exercise.expectedAnswer, exercise)
    }

    const recommendationAfter = computePracticeRecommendation([], Date.now(), ['grammar'])
    expect(recommendationAfter).toEqual(recommendationBefore)
  })

  it('uses zero network calls for exercise scoring', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network blocked'))
    const [exercise] = buildLayoutPracticeExercises(
      { sourceLayout: 'ar-101', targetLayout: 'en-US-qwerty' },
      1,
    )
    expect(scoreLayoutPracticeAnswer(exercise!.expectedAnswer, exercise!)).toBe(true)
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
})
