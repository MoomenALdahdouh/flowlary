import { describe, expect, it } from 'vitest'
import {
  buildLayoutPracticeExercises,
  collectLayoutPracticePairs,
  layoutPracticePairSupported,
  scoreLayoutPracticeAnswer,
} from '../../../extension/src/storage/layoutPractice/exercises.ts'

describe('layout practice exercises', () => {
  it('generates deterministic Arabic reverse golden exercises', () => {
    const pairs = collectLayoutPracticePairs('ar-101', 'en-US-qwerty')
    expect(pairs.some((pair) => pair.prompt === 'اثممخ' && pair.expectedAnswer === 'hello')).toBe(true)
  })

  it('builds a 10-item session from supported pairs', () => {
    const exercises = buildLayoutPracticeExercises(
      { sourceLayout: 'ar-101', targetLayout: 'en-US-qwerty' },
      10,
    )
    expect(exercises).toHaveLength(10)
    expect(exercises.every((item) => item.sourceLayout === 'ar-101')).toBe(true)
  })

  it('scores a correct answer', () => {
    const [exercise] = buildLayoutPracticeExercises(
      { sourceLayout: 'ar-101', targetLayout: 'en-US-qwerty' },
      1,
    )
    expect(exercise).toBeTruthy()
    expect(scoreLayoutPracticeAnswer(exercise!.expectedAnswer, exercise!)).toBe(true)
  })

  it('rejects an empty answer', () => {
    const [exercise] = buildLayoutPracticeExercises(
      { sourceLayout: 'ar-101', targetLayout: 'en-US-qwerty' },
      1,
    )
    expect(scoreLayoutPracticeAnswer('', exercise!)).toBe(false)
  })

  it('rejects an incorrect answer', () => {
    const [exercise] = buildLayoutPracticeExercises(
      { sourceLayout: 'ar-101', targetLayout: 'en-US-qwerty' },
      1,
    )
    expect(scoreLayoutPracticeAnswer('world', exercise!)).toBe(false)
  })

  it('supports Russian to English pair', () => {
    expect(
      layoutPracticePairSupported({ sourceLayout: 'ru-standard', targetLayout: 'en-US-qwerty' }),
    ).toBe(true)
  })

  it('maps Russian golden pair deterministically', () => {
    const pairs = collectLayoutPracticePairs('en-US-qwerty', 'ru-standard')
    expect(pairs.some((pair) => pair.prompt === 'ghbdtn' && pair.expectedAnswer === 'привет')).toBe(
      true,
    )
  })
})
