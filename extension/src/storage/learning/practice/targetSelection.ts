import type { LearningEvent, LearningEventCategory, PracticeFocus, PracticeRecommendation, PracticeTargetPattern } from '@flowlary/shared'
import { PRACTICE_TARGET_MIN_COUNT, parsePracticeTargetPatternId, practiceTargetPatternId } from '@flowlary/shared'
import { computeRecurringPatterns } from '../progress.ts'
import { resolvePracticeFocus } from './recommendation.ts'

const WRITING_PRACTICE_CATEGORIES = new Set<LearningEventCategory>(['spelling', 'grammar', 'wording'])

/** Minimum token length for a pattern to be targeted (avoid ambiguous single-letter targets). */
const MIN_TARGET_TOKEN_LENGTH = 3

export function filterWritingPracticeEvents(events: LearningEvent[]): LearningEvent[] {
  return events.filter(
    (event) =>
      event.source === 'writing' &&
      event.action !== 'rejected' &&
      event.category !== 'layout' &&
      WRITING_PRACTICE_CATEGORIES.has(event.category),
  )
}

export function listPracticeRecurringTargets(events: LearningEvent[], limit = 10): PracticeTargetPattern[] {
  return computeRecurringPatterns(filterWritingPracticeEvents(events), limit).map((pattern) => ({
    category: pattern.category,
    normalizedOriginal: pattern.normalizedOriginal,
    displayOriginal: pattern.displayOriginal,
    displayCorrected: pattern.displayCorrected,
    count: pattern.count,
  }))
}

export function isEligiblePracticeTarget(pattern: PracticeTargetPattern): boolean {
  return (
    pattern.count >= PRACTICE_TARGET_MIN_COUNT &&
    WRITING_PRACTICE_CATEGORIES.has(pattern.category) &&
    pattern.normalizedOriginal.length > 0 &&
    pattern.displayOriginal.length > 0 &&
    pattern.displayCorrected.length > 0 &&
    pattern.displayOriginal !== pattern.displayCorrected
  )
}

export function isPatternSafeForTargeting(pattern: PracticeTargetPattern): boolean {
  if (!isEligiblePracticeTarget(pattern)) return false
  const token = pattern.normalizedOriginal.trim()
  if (token.length < MIN_TARGET_TOKEN_LENGTH) return false
  return true
}

export type PracticeSessionTarget = {
  focus: LearningEventCategory
  pattern?: PracticeTargetPattern
  targeted: boolean
  targetPatternId?: string
}

function sortTargetsForCategory(
  patterns: PracticeTargetPattern[],
  category: LearningEventCategory,
): PracticeTargetPattern[] {
  return patterns
    .filter((pattern) => pattern.category === category)
    .filter(isEligiblePracticeTarget)
    .sort((a, b) => b.count - a.count || a.normalizedOriginal.localeCompare(b.normalizedOriginal))
}

/**
 * Select the practice session target for a focus choice.
 * User category choice is authoritative; within that category the strongest
 * eligible recurring pattern is selected. Falls back to generic category practice.
 */
export function selectPracticeSessionTarget(
  choice: PracticeFocus,
  recommendation: PracticeRecommendation,
  recurringTargets: PracticeTargetPattern[],
): PracticeSessionTarget {
  const resolved = resolvePracticeFocus(
    choice === 'recommended' ? 'recommended' : choice,
    recommendation,
  )
  const focus = resolved.focus

  if (choice === 'recommended' && resolved.pattern && isPatternSafeForTargeting(resolved.pattern)) {
    if (resolved.pattern.category === focus) {
      return {
        focus,
        pattern: resolved.pattern,
        targeted: true,
        targetPatternId: practiceTargetPatternId(resolved.pattern),
      }
    }
  }

  const bestInCategory = sortTargetsForCategory(recurringTargets, focus).find(isPatternSafeForTargeting)
  if (bestInCategory) {
    return {
      focus,
      pattern: bestInCategory,
      targeted: true,
      targetPatternId: practiceTargetPatternId(bestInCategory),
    }
  }

  return { focus, targeted: false }
}

/** Resolve a deep-link target when the pattern is eligible in current recurring targets. */
export function resolvePracticeSessionTargetById(
  targetPatternId: string,
  recurringTargets: PracticeTargetPattern[],
): PracticeSessionTarget | null {
  const parsed = parsePracticeTargetPatternId(targetPatternId)
  if (!parsed) return null

  const match = recurringTargets.find(
    (pattern) =>
      pattern.category === parsed.category &&
      pattern.normalizedOriginal === parsed.normalizedOriginal &&
      isPatternSafeForTargeting(pattern),
  )
  if (!match) return null

  return {
    focus: match.category,
    pattern: match,
    targeted: true,
    targetPatternId: practiceTargetPatternId(match),
  }
}
