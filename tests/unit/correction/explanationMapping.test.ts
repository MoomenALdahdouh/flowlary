import { describe, expect, it } from 'vitest'
import type { RuleExplanation } from '@flowlary/shared'
import {
  areExplanationsAligned,
  getAlignedExplanations,
  shouldShowPracticeLink,
  shouldShowTrustedRuleTitle,
} from '../../../extension/src/features/correction/ui/explanationMapping.ts'

describe('explanationMapping', () => {
  const trusted: RuleExplanation = {
    confidence: 'high',
    source: 'trusted_rule',
    category: 'spelling',
    ruleId: 'english.spelling.receive_ie_ei',
    ruleTitle: 'Receive spelling',
    summary: 'Summary',
    incorrectExample: 'recieve',
    correctExample: 'receive',
  }

  const pair: RuleExplanation = {
    confidence: 'medium',
    source: 'pair',
    category: 'spelling',
    summary: 'Pair summary',
    incorrectExample: 'recieved',
    correctExample: 'received',
  }

  it('requires equal-length aligned arrays', () => {
    expect(
      areExplanationsAligned([{ type: 'spelling', original: 'a', corrected: 'b', start: 0, end: 1 }], [pair]),
    ).toBe(true)
    expect(
      areExplanationsAligned([{ type: 'spelling', original: 'a', corrected: 'b', start: 0, end: 1 }], []),
    ).toBe(false)
    expect(areExplanationsAligned([], undefined)).toBe(false)
  })

  it('returns null for misaligned explanations', () => {
    expect(
      getAlignedExplanations(
        [{ type: 'spelling', original: 'a', corrected: 'b', start: 0, end: 1 }],
        undefined,
      ),
    ).toBeNull()
  })

  it('shows trusted rule title only for trusted high-confidence rules', () => {
    expect(shouldShowTrustedRuleTitle(trusted)).toBe(true)
    expect(shouldShowTrustedRuleTitle({ ...trusted, source: 'pair' })).toBe(false)
    expect(shouldShowTrustedRuleTitle({ ...trusted, confidence: 'medium' })).toBe(false)
    expect(shouldShowTrustedRuleTitle({ ...trusted, ruleId: undefined })).toBe(false)
  })

  it('shows practice link only when practiceTargetId exists and category is not layout', () => {
    expect(shouldShowPracticeLink({ ...pair, practiceTargetId: 'spelling:recieved' })).toBe(true)
    expect(shouldShowPracticeLink({ ...pair, category: 'layout', practiceTargetId: 'layout:x' })).toBe(false)
    expect(shouldShowPracticeLink(pair)).toBe(false)
  })
})
