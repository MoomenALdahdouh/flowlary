import type { LayoutPracticeExercise } from '@flowlary/shared'
import { convertManualText } from '../../features/layout/layouts/convert.ts'
import {
  ARABIC_GOLDEN,
  ARABIC_REVERSE_GOLDEN,
  RUSSIAN_GOLDEN,
  WORLD_GOLDEN,
} from '../../features/layout/layouts/registry.ts'
import type { LayoutId } from '../../features/layout/layouts/types.ts'
import { isSupportedLayout } from '../../features/layout/layouts/registry.ts'

export type LayoutConverterPair = {
  sourceLayout: LayoutId
  targetLayout: LayoutId
}

type RawPair = {
  prompt: string
  expectedAnswer: string
}

function normalizeAnswer(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

/** Collect deterministic golden pairs for a directed layout pair. */
export function collectLayoutPracticePairs(
  sourceLayout: LayoutId,
  targetLayout: LayoutId,
): RawPair[] {
  if (sourceLayout === targetLayout) return []
  const pairs: RawPair[] = []

  if (sourceLayout === 'en-US-qwerty' && targetLayout === 'ar-101') {
    for (const [prompt, expectedAnswer] of ARABIC_GOLDEN) {
      pairs.push({ prompt, expectedAnswer })
    }
  }
  if (sourceLayout === 'ar-101' && targetLayout === 'en-US-qwerty') {
    for (const [prompt, expectedAnswer] of ARABIC_REVERSE_GOLDEN) {
      pairs.push({ prompt, expectedAnswer })
    }
  }
  if (sourceLayout === 'en-US-qwerty' && targetLayout === 'ru-standard') {
    for (const [prompt, expectedAnswer] of RUSSIAN_GOLDEN) {
      pairs.push({ prompt, expectedAnswer })
    }
  }
  if (sourceLayout === 'ru-standard' && targetLayout === 'en-US-qwerty') {
    for (const [, cyrillic] of RUSSIAN_GOLDEN) {
      const prompt = convertManualText(cyrillic, sourceLayout, targetLayout)
      if (prompt.ok && prompt.text) {
        pairs.push({ prompt: cyrillic, expectedAnswer: prompt.text })
      }
    }
  }

  for (const [prompt, expectedAnswer, source, target] of WORLD_GOLDEN) {
    if (source === sourceLayout && target === targetLayout) {
      pairs.push({ prompt, expectedAnswer })
    }
    if (source === targetLayout && target === sourceLayout) {
      const reversePrompt = convertManualText(expectedAnswer, targetLayout, sourceLayout)
      if (reversePrompt.ok && reversePrompt.text) {
        pairs.push({ prompt: reversePrompt.text, expectedAnswer: prompt })
      }
    }
  }

  const seen = new Set<string>()
  return pairs.filter((pair) => {
    const key = `${pair.prompt}→${pair.expectedAnswer}`
    if (seen.has(key)) return false
    seen.add(key)
    const converted = convertManualText(pair.prompt, sourceLayout, targetLayout)
    return converted.ok && normalizeAnswer(converted.text) === normalizeAnswer(pair.expectedAnswer)
  })
}

function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy
}

export function buildLayoutPracticeExercises(
  pair: LayoutConverterPair,
  count: number,
): LayoutPracticeExercise[] {
  if (!isSupportedLayout(pair.sourceLayout) || !isSupportedLayout(pair.targetLayout)) {
    return []
  }
  const pool = collectLayoutPracticePairs(pair.sourceLayout, pair.targetLayout)
  if (pool.length === 0) return []

  const selected = shuffle(pool).slice(0, count)
  while (selected.length < count && pool.length > 0) {
    selected.push(pool[selected.length % pool.length]!)
  }

  return selected.slice(0, count).map((item, index) => ({
    id: `${pair.sourceLayout}:${pair.targetLayout}:${index}:${item.prompt}`,
    prompt: item.prompt,
    expectedAnswer: item.expectedAnswer,
    sourceLayout: pair.sourceLayout,
    targetLayout: pair.targetLayout,
  }))
}

export function scoreLayoutPracticeAnswer(
  userAnswer: string,
  exercise: LayoutPracticeExercise,
): boolean {
  const trimmed = userAnswer.trim()
  if (!trimmed) return false
  if (normalizeAnswer(trimmed) === normalizeAnswer(exercise.expectedAnswer)) return true

  const converted = convertManualText(trimmed, exercise.sourceLayout, exercise.targetLayout)
  if (!converted.ok) return false
  return normalizeAnswer(converted.text) === normalizeAnswer(exercise.expectedAnswer)
}

export function layoutPracticePairSupported(pair: LayoutConverterPair): boolean {
  return collectLayoutPracticePairs(pair.sourceLayout, pair.targetLayout).length > 0
}
