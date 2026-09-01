import type {
  LearningEventCategory,
  PracticeExerciseSpec,
  PracticeExerciseType,
  PracticeTargetPattern,
} from '@flowlary/shared'
import { practiceTargetPatternId } from '@flowlary/shared'

const SPELLING_PROMPTS = [
  'Write a short message about your plans for tomorrow.',
  'Write a sentence about receiving an email today.',
  'Describe something you want to achieve this week.',
  'Write a note thanking someone for their help.',
  'Describe a place you visited recently.',
]

const GRAMMAR_PROMPTS = [
  'Describe what you did yesterday.',
  'Write about a habit you are trying to build.',
  'Explain how you usually start your morning.',
  'Write about something you learned recently.',
  'Describe a goal you are working toward.',
]

const WORDING_PROMPTS = [
  'Write a short explanation of a project you are working on.',
  'Describe a problem you solved recently and how you approached it.',
  'Write a polite message asking a colleague for an update.',
  'Explain an idea clearly in 2–3 sentences.',
  'Write a brief summary of a book or article you read.',
]

const TARGETED_EXERCISE_TYPES: Exclude<PracticeExerciseType, 'free_writing'>[] = [
  'use_correct_form',
  'complete_the_sentence',
  'rewrite_naturally',
  'correct_the_sentence',
]

function genericPrompt(focus: LearningEventCategory, itemIndex: number): string {
  const pool =
    focus === 'spelling' ? SPELLING_PROMPTS : focus === 'wording' ? WORDING_PROMPTS : GRAMMAR_PROMPTS
  return pool[itemIndex % pool.length] ?? pool[0]!
}

function learningObjective(pattern: PracticeTargetPattern): string {
  return `Practice the recurring ${pattern.category} pattern "${pattern.displayOriginal}" → "${pattern.displayCorrected}".`
}

function expectedSkill(pattern: PracticeTargetPattern): string {
  return `Use "${pattern.displayCorrected}" correctly instead of "${pattern.displayOriginal}".`
}

function targetedPrompt(
  pattern: PracticeTargetPattern,
  exerciseType: Exclude<PracticeExerciseType, 'free_writing'>,
  itemIndex: number,
): string {
  const variant = itemIndex % 3
  switch (pattern.category) {
    case 'spelling':
      if (exerciseType === 'use_correct_form' || exerciseType === 'complete_the_sentence') {
        if (variant === 0) {
          return `Write a sentence that correctly uses "${pattern.displayCorrected}". Do not write "${pattern.displayOriginal}".`
        }
        if (variant === 1) {
          return `Complete a short message using the correct spelling "${pattern.displayCorrected}" (not "${pattern.displayOriginal}").`
        }
        return `Write 1–2 sentences where you naturally need the word "${pattern.displayCorrected}".`
      }
      return `Correct any spelling like "${pattern.displayOriginal}" and use "${pattern.displayCorrected}" in a natural sentence.`

    case 'grammar':
      if (variant === 0) {
        return `Write 2–3 sentences about your day. Use correct grammar for the pattern "${pattern.displayOriginal}" → "${pattern.displayCorrected}".`
      }
      if (variant === 1) {
        return `Complete this idea with correct grammar: avoid "${pattern.displayOriginal}" and write "${pattern.displayCorrected}" where appropriate.`
      }
      return `Write a short paragraph. Pay attention to the recurring grammar pattern "${pattern.displayOriginal}" → "${pattern.displayCorrected}".`

    case 'wording':
      if (variant === 0) {
        return `Rewrite an idea naturally. Prefer "${pattern.displayCorrected}" instead of "${pattern.displayOriginal}".`
      }
      if (variant === 1) {
        return `Write 2–3 sentences explaining something clearly. Avoid the wording "${pattern.displayOriginal}"; use "${pattern.displayCorrected}" or a natural alternative.`
      }
      return `Write a polite professional sentence using natural phrasing like "${pattern.displayCorrected}" rather than "${pattern.displayOriginal}".`

    default:
      return genericPrompt(pattern.category, itemIndex)
  }
}

export function buildPracticeExercise(
  focus: LearningEventCategory,
  pattern: PracticeTargetPattern | undefined,
  itemIndex = 0,
  targeted = Boolean(pattern),
): PracticeExerciseSpec {
  if (pattern && targeted) {
    const exerciseType = TARGETED_EXERCISE_TYPES[itemIndex % TARGETED_EXERCISE_TYPES.length]!
    return {
      targeted: true,
      exerciseType,
      category: pattern.category,
      targetPatternId: practiceTargetPatternId(pattern),
      targetPattern: pattern,
      prompt: targetedPrompt(pattern, exerciseType, itemIndex),
      learningObjective: learningObjective(pattern),
      expectedSkill: expectedSkill(pattern),
    }
  }

  return {
    targeted: false,
    exerciseType: 'free_writing',
    category: focus,
    prompt: genericPrompt(focus, itemIndex),
  }
}

export function buildPracticePrompt(
  focus: LearningEventCategory,
  pattern?: PracticeTargetPattern,
  itemIndex = 0,
  targeted = Boolean(pattern),
): string {
  return buildPracticeExercise(focus, pattern, itemIndex, targeted).prompt
}

/** Structured AI exercise output shape (for validation / future optional generation). */
export type PracticeAiExerciseOutput = {
  exerciseType: string
  prompt: string
  targetPattern: string
  category: string
  expectedSkill?: string
  difficulty?: string
  answerGuidance?: string
}

const ALLOWED_AI_EXERCISE_TYPES = new Set<string>(TARGETED_EXERCISE_TYPES)

export function validatePracticeAiExerciseOutput(
  output: unknown,
  expected: { category: LearningEventCategory; targetPatternId: string },
): output is PracticeAiExerciseOutput {
  if (!output || typeof output !== 'object' || Array.isArray(output)) return false
  const value = output as PracticeAiExerciseOutput
  if (typeof value.prompt !== 'string' || value.prompt.trim().length === 0) return false
  if (typeof value.exerciseType !== 'string' || !ALLOWED_AI_EXERCISE_TYPES.has(value.exerciseType)) {
    return false
  }
  if (value.category !== expected.category) return false
  if (typeof value.targetPattern !== 'string' || value.targetPattern !== expected.targetPatternId) {
    return false
  }
  if (value.prompt.includes('system instruction') || value.prompt.includes('ignore previous')) {
    return false
  }
  return true
}
