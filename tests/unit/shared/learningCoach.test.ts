import { describe, expect, it } from 'vitest'
import {
  buildCoachCacheKey,
  buildGroqCoachPayload,
  validateLearningCoachResponse,
  type LearningCoachContext,
} from '@flowlary/shared'
import { buildLearningCoachContext as buildContextFromSnapshots } from '../../../extension/src/storage/learning/coach/buildLearningCoachContext.ts'
import { buildDeterministicCoachResponse } from '../../../extension/src/storage/learning/coach/buildDeterministicCoach.ts'

function sampleContext(overrides: Partial<LearningCoachContext> = {}): LearningCoachContext {
  return {
    schemaVersion: 1,
    evidenceVersion: 'ev-1',
    locale: 'en',
    evidenceQuality: 'ready',
    briefState: 'ready',
    periodDays: 7,
    wordsWritten: 120,
    writingEventCount: 12,
    errorsPer100Words: 4.5,
    trend: { label: 'improved', direction: 'down', percent: 15 },
    focusCategory: 'spelling',
    userFocusAreas: ['grammar'],
    prioritizedCategories: ['spelling', 'grammar'],
    recurringPatterns: [
      {
        category: 'spelling',
        original: 'recieved',
        corrected: 'received',
        count: 3,
        targetPatternId: 'spelling:recieved',
        explanation: {
          source: 'trusted_rule',
          confidence: 'high',
          ruleId: 'spell_common_001',
          ruleTitle: 'Common spelling',
          summary: 'Received follows i-before-e except after c.',
        },
      },
    ],
    areasToImprove: ['spelling'],
    practiceAction: 'practice_pattern',
    practiceProgressions: [],
    targetProgression: null,
    selfReportedLevel: 'intermediate',
    mode: 'focus',
    question: null,
    ...overrides,
  }
}

describe('learning coach validation (WL-4F)', () => {
  it('buildGroqCoachPayload excludes internal-only fields', () => {
    const context = sampleContext()
    const payload = buildGroqCoachPayload(context)
    expect(payload).not.toHaveProperty('evidenceVersion')
    expect(payload.recurringPatterns[0]?.count).toBe(3)
    expect(payload.selfReportedLevel).toBe('intermediate')
  })

  it('accepts valid AI response grounded in evidence', () => {
    const context = sampleContext()
    const validated = validateLearningCoachResponse(
      {
        summary: 'Your recurring spelling pattern is recieved → received (3 times).',
        observations: ['Spelling is a current focus area.'],
        recommendations: ['Practice recieved → received.'],
        explanations: ['Received follows i-before-e except after c.'],
        actions: [{ kind: 'practice_pattern', targetPatternId: 'spelling:recieved' }],
        evidenceReferences: ['recurring:spelling:recieved:3'],
      },
      context,
    )
    expect(validated?.source).toBe('ai')
    expect(validated?.actions[0]?.targetPatternId).toBe('spelling:recieved')
  })

  it('rejects CEFR claims', () => {
    const context = sampleContext()
    const validated = validateLearningCoachResponse(
      {
        summary: 'You are B1 level now.',
        observations: [],
        recommendations: [],
        explanations: [],
        actions: [{ kind: 'keep_writing' }],
        evidenceReferences: [],
      },
      context,
    )
    expect(validated).toBeNull()
  })

  it('rejects invented pattern pairs', () => {
    const context = sampleContext()
    const validated = validateLearningCoachResponse(
      {
        summary: 'You often write "teh" instead of "the".',
        observations: [],
        recommendations: [],
        explanations: [],
        actions: [{ kind: 'keep_writing' }],
        evidenceReferences: [],
      },
      context,
    )
    expect(validated).toBeNull()
  })

  it('rejects unsupported improvement claims without trend evidence', () => {
    const context = sampleContext({ trend: { label: 'flat', direction: null, percent: null } })
    const validated = validateLearningCoachResponse(
      {
        summary: 'You are improving rapidly in every area.',
        observations: ['Your grammar is improving fast.'],
        recommendations: [],
        explanations: [],
        actions: [{ kind: 'keep_writing' }],
        evidenceReferences: [],
      },
      context,
    )
    expect(validated).toBeNull()
  })

  it('rejects HTML in coach output', () => {
    const context = sampleContext()
    const validated = validateLearningCoachResponse(
      {
        summary: '<script>alert(1)</script>',
        observations: [],
        recommendations: [],
        explanations: [],
        actions: [{ kind: 'keep_writing' }],
        evidenceReferences: [],
      },
      context,
    )
    expect(validated).toBeNull()
  })

  it('buildCoachCacheKey is stable for same inputs', () => {
    const a = buildCoachCacheKey('ev-1', 'en', 'focus', null)
    const b = buildCoachCacheKey('ev-1', 'en', 'focus', null)
    expect(a).toBe(b)
  })

  it('deterministic coach response uses evidence-backed summary', () => {
    const context = sampleContext()
    const response = buildDeterministicCoachResponse(context, 'recurring_error', 'en')
    expect(response.summary).toContain('recieved')
    expect(response.source).toBe('deterministic')
    expect(response.actions.some((action) => action.kind === 'practice_pattern')).toBe(true)
  })
})

describe('buildLearningCoachContext from snapshots', () => {
  it('maps snapshot fields without raw events', () => {
    const snapshot = {
      schemaVersion: 1,
      evidenceVersion: 'snap-1',
      evidenceQuality: 'ready' as const,
      generatedAt: 1,
      dayKey: '2026-08-27',
      periodDays: 7,
      activity: {
        wordsWritten: 80,
        writingEventCount: 8,
        errorCount: 4,
        writingErrorCount: 4,
        errorsPer100Words: 5,
        practiceSessionsThisWeek: 1,
      },
      categoryMetrics: { spelling: 2, grammar: 1, wording: 1 },
      categoryPercentWriting: { spelling: 50 },
      recurringPatterns: [
        {
          category: 'spelling' as const,
          displayOriginal: 'recieved',
          displayCorrected: 'received',
          count: 2,
          targetPatternId: 'spelling:recieved',
        },
      ],
      trend: { label: 'flat', direction: null, percent: null },
      focusCategory: 'spelling' as const,
      userFocusAreas: ['spelling' as const],
      systemRecommendedFocus: 'spelling' as const,
      prioritizedCategories: ['spelling' as const],
      strengths: [],
      areasToImprove: ['spelling' as const],
      practicePlan: {
        recommendedAction: { kind: 'practice_pattern' as const, targetPatternId: 'spelling:recieved', category: 'spelling' as const },
        topTargets: [],
      },
      layoutInputCount: 0,
      practiceProgressions: [],
    }
    const brief = {
      state: 'ready' as const,
      evidenceVersion: 'brief-1',
      generatedAt: 1,
      dayKey: '2026-08-27',
      focusCategory: 'spelling' as const,
      recurringPattern: null,
      improvement: null,
      recommendedAction: { kind: 'practice_pattern' as const, targetPatternId: 'spelling:recieved', category: 'spelling' as const },
      writingEventCount: 8,
      wordsWritten: 80,
      practiceSessionsThisWeek: 1,
      hasRecentWriting: true,
      targetProgression: null,
    }
    const profile = {
      version: 1,
      learningLanguage: 'en',
      focusAreas: ['spelling' as const],
      onboardingCompleted: true,
      onboardingVersion: 1,
      createdAt: 1,
      updatedAt: 1,
    }

    const context = buildContextFromSnapshots({
      snapshot: snapshot as never,
      brief,
      profile,
      locale: 'en',
      mode: 'focus',
      question: null,
    })

    expect(context.recurringPatterns[0]?.count).toBe(2)
    expect(context.writingEventCount).toBe(8)
    expect(context.recurringPatterns.every((pattern) => pattern.category !== 'layout')).toBe(true)
  })
})
