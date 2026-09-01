import { describe, expect, it } from 'vitest'
import {
  buildPracticeExercise,
  validatePracticeAiExerciseOutput,
} from '../../../extension/src/storage/learning/practice/exercise.ts'

const pattern = {
  category: 'spelling' as const,
  normalizedOriginal: 'recieve',
  displayOriginal: 'recieve',
  displayCorrected: 'receive',
  count: 3,
}

describe('practice exercise generation', () => {
  it('builds targeted spelling exercise with pattern evidence', () => {
    const exercise = buildPracticeExercise('spelling', pattern, 0, true)
    expect(exercise.targeted).toBe(true)
    if (exercise.targeted) {
      expect(exercise.targetPatternId).toBe('spelling:recieve')
      expect(exercise.prompt).toContain('receive')
    }
  })

  it('falls back to generic free writing without pattern', () => {
    const exercise = buildPracticeExercise('grammar', undefined, 1, false)
    expect(exercise).toMatchObject({
      targeted: false,
      exerciseType: 'free_writing',
      category: 'grammar',
    })
  })

  it('varies targeted prompts by item index', () => {
    const first = buildPracticeExercise('grammar', { ...pattern, category: 'grammar', normalizedOriginal: 'he go', displayOriginal: 'He go', displayCorrected: 'He goes' }, 0, true)
    const second = buildPracticeExercise('grammar', { ...pattern, category: 'grammar', normalizedOriginal: 'he go', displayOriginal: 'He go', displayCorrected: 'He goes' }, 1, true)
    if (first.targeted && second.targeted) {
      expect(first.prompt).not.toBe(second.prompt)
    }
  })

  it('accepts valid structured AI output', () => {
    const valid = {
      exerciseType: 'use_correct_form',
      prompt: 'Write a sentence using "receive".',
      targetPattern: 'spelling:recieve',
      category: 'spelling',
    }
    expect(
      validatePracticeAiExerciseOutput(valid, {
        category: 'spelling',
        targetPatternId: 'spelling:recieve',
      }),
    ).toBe(true)
  })

  it('rejects malformed or wrong-category AI output', () => {
    expect(
      validatePracticeAiExerciseOutput(
        { exerciseType: 'use_correct_form', prompt: '', targetPattern: 'spelling:recieve', category: 'spelling' },
        { category: 'spelling', targetPatternId: 'spelling:recieve' },
      ),
    ).toBe(false)
    expect(
      validatePracticeAiExerciseOutput(
        {
          exerciseType: 'use_correct_form',
          prompt: 'Test',
          targetPattern: 'spelling:recieve',
          category: 'grammar',
        },
        { category: 'spelling', targetPatternId: 'spelling:recieve' },
      ),
    ).toBe(false)
  })
})
