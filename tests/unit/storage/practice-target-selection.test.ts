import { describe, expect, it } from 'vitest'
import type { LearningEvent, PracticeRecommendation, PracticeTargetPattern } from '@flowlary/shared'
import {
  isEligiblePracticeTarget,
  isPatternSafeForTargeting,
  resolvePracticeSessionTargetById,
  selectPracticeSessionTarget,
} from '../../../extension/src/storage/learning/practice/targetSelection.ts'
import { computePracticeRecommendation } from '../../../extension/src/storage/learning/practice/recommendation.ts'

function writingEvent(
  patch: Partial<LearningEvent> & Pick<LearningEvent, 'original' | 'corrected'>,
): LearningEvent {
  return {
    id: patch.id ?? `e-${Math.random()}`,
    version: 1,
    timestamp: patch.timestamp ?? Date.now(),
    batchId: patch.batchId ?? 'batch-1',
    source: 'writing',
    category: patch.category ?? 'spelling',
    original: patch.original,
    corrected: patch.corrected,
    normalizedOriginal: patch.normalizedOriginal ?? patch.original.toLowerCase(),
    normalizedCorrected: patch.normalizedCorrected ?? patch.corrected.toLowerCase(),
    action: patch.action ?? 'accepted',
    sampleWordCount: patch.sampleWordCount ?? 20,
    sampleHash: patch.sampleHash ?? 'hash',
  }
}

function target(
  patch: Partial<PracticeTargetPattern> & Pick<PracticeTargetPattern, 'category' | 'normalizedOriginal'>,
): PracticeTargetPattern {
  return {
    displayOriginal: patch.displayOriginal ?? patch.normalizedOriginal,
    displayCorrected: patch.displayCorrected ?? 'fixed',
    count: patch.count ?? 2,
    ...patch,
  }
}

describe('practice target selection', () => {
  it('returns generic when no recurring pattern exists', () => {
    const recommendation: PracticeRecommendation = { state: 'emerging' }
    const result = selectPracticeSessionTarget('grammar', recommendation, [])
    expect(result).toEqual({ focus: 'grammar', targeted: false })
  })

  it('selects strongest grammar pattern when user chooses grammar', () => {
    const recommendation = computePracticeRecommendation([
      writingEvent({ original: 'recieve', corrected: 'receive', normalizedOriginal: 'recieve' }),
      writingEvent({
        id: '2',
        original: 'recieve',
        corrected: 'receive',
        normalizedOriginal: 'recieve',
        batchId: 'b2',
      }),
      writingEvent({
        id: '3',
        original: 'recieve',
        corrected: 'receive',
        normalizedOriginal: 'recieve',
        batchId: 'b3',
      }),
      writingEvent({
        id: 'g1',
        category: 'grammar',
        original: 'He go',
        corrected: 'He goes',
        normalizedOriginal: 'he go',
        batchId: 'g1',
      }),
      writingEvent({
        id: 'g2',
        category: 'grammar',
        original: 'She go',
        corrected: 'She goes',
        normalizedOriginal: 'he go',
        batchId: 'g2',
      }),
    ])
    const recurring = [
      target({
        category: 'spelling',
        normalizedOriginal: 'recieve',
        displayOriginal: 'recieve',
        displayCorrected: 'receive',
        count: 3,
      }),
      target({
        category: 'grammar',
        normalizedOriginal: 'he go',
        displayOriginal: 'He go',
        displayCorrected: 'He goes',
        count: 2,
      }),
    ]

    const result = selectPracticeSessionTarget('grammar', recommendation, recurring)
    expect(result.focus).toBe('grammar')
    expect(result.targeted).toBe(true)
    expect(result.pattern?.normalizedOriginal).toBe('he go')
  })

  it('recommended uses recommendation pattern when eligible', () => {
    const recommendation: PracticeRecommendation = {
      state: 'ready',
      focus: 'spelling',
      pattern: target({
        category: 'spelling',
        normalizedOriginal: 'recieve',
        displayOriginal: 'recieve',
        displayCorrected: 'receive',
        count: 3,
      }),
    }
    const result = selectPracticeSessionTarget('recommended', recommendation, [recommendation.pattern!])
    expect(result.targeted).toBe(true)
    expect(result.pattern?.normalizedOriginal).toBe('recieve')
  })

  it('rejects ambiguous short patterns', () => {
    expect(
      isPatternSafeForTargeting(
        target({ category: 'grammar', normalizedOriginal: 'go', displayOriginal: 'go', count: 2 }),
      ),
    ).toBe(false)
    expect(
      isEligiblePracticeTarget(
        target({ category: 'grammar', normalizedOriginal: 'he go', displayOriginal: 'He go', count: 2 }),
      ),
    ).toBe(true)
  })

  it('excludes layout targets', () => {
    expect(
      isEligiblePracticeTarget(
        target({
          category: 'layout' as never,
          normalizedOriginal: 'hello',
          count: 3,
        }),
      ),
    ).toBe(false)
  })

  it('falls back to generic when only insufficient evidence exists', () => {
    const recommendation: PracticeRecommendation = { state: 'ready', focus: 'wording' }
    const recurring = [
      target({
        category: 'wording',
        normalizedOriginal: 'big',
        displayOriginal: 'big',
        displayCorrected: 'large',
        count: 1,
      }),
    ]
    const result = selectPracticeSessionTarget('wording', recommendation, recurring)
    expect(result.targeted).toBe(false)
  })

  it('resolves deep-link target by pattern id', () => {
    const recurring = [
      target({
        category: 'spelling',
        normalizedOriginal: 'recieve',
        displayOriginal: 'recieve',
        displayCorrected: 'receive',
        count: 3,
      }),
    ]
    const resolved = resolvePracticeSessionTargetById('spelling:recieve', recurring)
    expect(resolved?.targeted).toBe(true)
    expect(resolved?.pattern?.normalizedOriginal).toBe('recieve')
  })
})
