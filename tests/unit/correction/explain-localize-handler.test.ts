import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createTrustedRuleExplanation,
  type RuleExplanation,
} from '@flowlary/shared'
import {
  clearExplanationLocalizeCache,
  handleLocalizeExplanation,
  peekExplanationLocalizeCache,
  seedExplanationLocalizeCache,
} from '../../../extension/src/background/explainLocalize.ts'

vi.mock('../../../extension/src/config/auth.ts', () => ({
  buildAuthenticatedHeaders: vi.fn(async () => ({ Authorization: 'Bearer test' })),
  resolveEntitlementHeader: vi.fn(() => ({})),
}))

vi.mock('../../../extension/src/entitlement/service.ts', () => ({
  getEntitlementService: vi.fn(() => ({
    getSnapshot: vi.fn(async () => ({ isPro: true, inTrial: false })),
  })),
}))

vi.mock('../../../extension/src/features/correction/readiness.ts', () => ({
  isCorrectionAiReady: vi.fn(() => true),
}))

vi.mock('../../../extension/src/core/state/StateManager.ts', () => ({
  stateManager: { correction: { consentAccepted: true } },
}))

vi.mock('../../../extension/src/storage/index.ts', () => ({
  flowlaryStorage: {},
  getEntitlement: vi.fn(async () => ({ status: 'pro' })),
  resolveEntitlementStatus: vi.fn(() => 'pro'),
}))

vi.mock('../../../extension/src/storage/activeAccountContext.ts', () => ({
  activeAccountContext: {
    snapshot: vi.fn(() => ({ accountId: 'acct-12345678', generation: 1 })),
    matches: vi.fn(() => true),
  },
}))

const explanation: RuleExplanation = createTrustedRuleExplanation({
  rule: { ruleId: 'english.spelling.definitely_not_a', category: 'spelling', ruleVersion: '1.0' },
  ruleTitle: 'Definitely spelling',
  summary: "The adverb 'definitely' is written with 'itely', not 'ately'.",
  original: 'definately',
  corrected: 'definitely',
})

describe('handleLocalizeExplanation', () => {
  beforeEach(() => {
    clearExplanationLocalizeCache()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('rejects free-path trusted rules that already have static locale copy', async () => {
    const result = await handleLocalizeExplanation({
      type: 'LOCALIZE_EXPLANATION',
      requestId: 'r1',
      locale: 'ar',
      explanation,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('static_available')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns cache hit without fetch for Pro locale miss', async () => {
    seedExplanationLocalizeCache(
      explanation.ruleId!,
      '1.0',
      'de',
      { ruleTitle: 'Definitely Rechtschreibung', summary: 'Deutsche Zusammenfassung' },
    )
    const result = await handleLocalizeExplanation({
      type: 'LOCALIZE_EXPLANATION',
      requestId: 'r2',
      locale: 'de',
      explanation,
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.fromCache).toBe(true)
      expect(result.fields.summary).toContain('Deutsche')
    }
    expect(fetch).not.toHaveBeenCalled()
    expect(
      peekExplanationLocalizeCache('EXPLAIN_LOCALIZE:english.spelling.definitely_not_a:1.0:de'),
    ).toBeTruthy()
  })

  it('does not call backend for fallback explanations', async () => {
    const fallback: RuleExplanation = {
      confidence: 'uncertain',
      source: 'fallback',
      category: 'grammar',
      summary: 'Grammar fallback',
      incorrectExample: 'go',
      correctExample: 'goes',
    }
    const result = await handleLocalizeExplanation({
      type: 'LOCALIZE_EXPLANATION',
      requestId: 'r3',
      locale: 'ar',
      explanation: fallback,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('not_eligible')
  })
})
