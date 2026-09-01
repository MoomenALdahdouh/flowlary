import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CorrectionChange, CorrectionResponse } from '@flowlary/shared'
import * as shared from '@flowlary/shared'
import { createMockChromeStorage } from '../helpers/mockChromeStorage.ts'
import {
  TEST_ACCOUNT_A,
  TEST_ACCOUNT_B,
  activateTestAccount,
  clearTestAccountContext,
} from '../helpers/accountIsolation.ts'
import { seedFlowlaryAccountAuth } from '../helpers/mockFlowlaryAuth.ts'
import {
  handleCorrectText,
  resetCorrectHandlerForTests,
} from '../../extension/src/background/correct.ts'
import { resetFlowlaryCacheForTests, getCacheMetrics } from '../../extension/src/storage/cache/index.ts'
import { resetEntitlementServiceForTests } from '../../extension/src/entitlement/service.ts'
import { stateManager } from '../../extension/src/core/state/StateManager.ts'
import { getLearningEventService, resetLearningEventServiceForTests } from '../../extension/src/storage/learning/events/index.ts'
import { flowlaryStorage } from '../../extension/src/storage/index.ts'

function change(
  type: CorrectionChange['type'],
  original: string,
  corrected: string,
  start: number,
): CorrectionChange {
  return { type, original, corrected, start, end: start + original.length }
}

function mockResponse(
  changes: CorrectionChange[],
  originalText: string,
  correctedText: string,
): CorrectionResponse {
  return { originalText, correctedText, changes }
}

describe('WL-4C-D — trusted explanation resolver integration', () => {
  const store = createMockChromeStorage()
  const originalFetch = globalThis.fetch

  beforeEach(async () => {
    store.reset()
    store.install()
    resetCorrectHandlerForTests()
    resetFlowlaryCacheForTests()
    resetEntitlementServiceForTests()
    resetLearningEventServiceForTests()
    await clearTestAccountContext()
    seedFlowlaryAccountAuth(store)
    await activateTestAccount(TEST_ACCOUNT_A)
    Object.assign(stateManager.correction, {
      enabled: true,
      mode: 'direct',
      highlights: true,
      consentAccepted: true,
    })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    resetFlowlaryCacheForTests()
  })

  function stubCorrection(data: CorrectionResponse): void {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, data, model: 'flowlary-ai' }),
      } as Response),
    )
  }

  async function correct(text: string, requestId: string) {
    return handleCorrectText({
      type: 'CORRECT_TEXT',
      requestId,
      text,
    })
  }

  it('TEST 1: trusted spelling pair flows through CORRECT_TEXT', async () => {
    const data = mockResponse(
      [change('spelling', 'recieve', 'receive', 2)],
      'I recieve mail.',
      'I receive mail.',
    )
    stubCorrection(data)

    const result = await correct(data.originalText, 'wl4cd-trusted-spelling')
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.explanations).toHaveLength(1)
    expect(result.data.explanations?.[0]).toMatchObject({
      source: 'trusted_rule',
      confidence: 'high',
      ruleId: 'english.spelling.receive_ie_ei',
    })
  })

  it('TEST 2: unknown spelling falls back to pair explanation', async () => {
    const data = mockResponse(
      [change('spelling', 'recieved', 'received', 2)],
      'I recieved mail.',
      'I received mail.',
    )
    stubCorrection(data)

    const result = await correct(data.originalText, 'wl4cd-fallback-spelling')
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.explanations?.[0]?.source).toBe('pair')
    expect(result.data.explanations?.[0]?.ruleId).toBeUndefined()
  })

  it('TEST 3: grammar correction falls back', async () => {
    const data = mockResponse(
      [change('grammar', 'go', 'goes', 5)],
      'They go daily.',
      'They goes daily.',
    )
    stubCorrection(data)

    const result = await correct(data.originalText, 'wl4cd-grammar')
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.explanations?.[0]?.source).not.toBe('trusted_rule')
    expect(result.data.explanations?.[0]?.ruleId).toBeUndefined()
  })

  it('TEST 4: wording correction falls back', async () => {
    const data = mockResponse(
      [change('wording', 'make a photo', 'take a photo', 0)],
      'make a photo today',
      'take a photo today',
    )
    stubCorrection(data)

    const result = await correct(data.originalText, 'wl4cd-wording')
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.explanations?.[0]?.source).toBe('pair')
    expect(result.data.explanations?.[0]?.category).toBe('wording')
  })

  it('TEST 5: layout correction uses keyboard-input fallback', async () => {
    const data = mockResponse(
      [change('layout', 'lvpfh', 'hello', 0)],
      'lvpfh',
      'hello',
    )
    stubCorrection(data)

    const result = await correct(data.originalText, 'wl4cd-layout')
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.explanations?.[0]?.category).toBe('layout')
    expect(result.data.explanations?.[0]?.summary.toLowerCase()).toContain('keyboard input')
    expect(result.data.explanations?.[0]?.ruleId).toBeUndefined()
  })

  it('TEST 6: trusted explanation includes rule identity', async () => {
    const data = mockResponse(
      [change('spelling', 'definately', 'definitely', 0)],
      'definately true',
      'definitely true',
    )
    stubCorrection(data)

    const result = await correct(data.originalText, 'wl4cd-trusted-identity')
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const explanation = result.data.explanations?.[0]
    expect(explanation?.source).toBe('trusted_rule')
    expect(explanation?.confidence).toBe('high')
    expect(explanation?.ruleId).toBe('english.spelling.definitely_not_a')
    expect(explanation?.ruleTitle).toBeTruthy()
  })

  it('TEST 7: fallback explanation has no trusted identity', async () => {
    const data = mockResponse(
      [change('spelling', 'mesage', 'message', 0)],
      'mesage sent',
      'message sent',
    )
    stubCorrection(data)

    const result = await correct(data.originalText, 'wl4cd-fallback-identity')
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.explanations?.[0]?.ruleId).toBeUndefined()
    expect(result.data.explanations?.[0]?.ruleTitle).toBeUndefined()
  })

  it('TEST 8: correction succeeds when explanation enrichment succeeds', async () => {
    const data = mockResponse(
      [change('spelling', 'seperate', 'separate', 0)],
      'seperate files',
      'separate files',
    )
    stubCorrection(data)

    const result = await correct(data.originalText, 'wl4cd-success')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.explanations).toHaveLength(1)
    expect(result.data.changes).toEqual(data.changes)
  })

  it('TEST 9: correction succeeds when explanation generation throws', async () => {
    const data = mockResponse(
      [change('spelling', 'thier', 'their', 0)],
      'thier house',
      'their house',
    )
    stubCorrection(data)

    vi.spyOn(shared, 'enrichCorrectionResponseWithExplanations').mockImplementation(() => {
      throw new Error('forced_explanation_failure')
    })

    const result = await correct(data.originalText, 'wl4cd-expl-fail')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.changes).toEqual(data.changes)
    expect(result.data.explanations).toBeUndefined()
  })

  it('TEST 10: correction payload unchanged except optional explanations', async () => {
    const data = mockResponse(
      [change('spelling', 'recieved', 'received', 2)],
      'I recieved mail.',
      'I received mail.',
    )
    stubCorrection(data)

    const result = await correct(data.originalText, 'wl4cd-compat')
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.originalText).toBe(data.originalText)
    expect(result.data.correctedText).toBe(data.correctedText)
    expect(result.data.changes).toEqual(data.changes)
  })

  it('TEST 11: correction offsets remain unchanged', async () => {
    const data = mockResponse(
      [change('spelling', 'recieve', 'receive', 7)],
      'Please recieve this.',
      'Please receive this.',
    )
    stubCorrection(data)

    const result = await correct(data.originalText, 'wl4cd-offsets')
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.changes[0]?.start).toBe(7)
    expect(result.data.changes[0]?.end).toBe(14)
  })

  it('TEST 12: multiple changes receive independent explanations', async () => {
    const data = mockResponse(
      [
        change('spelling', 'recieve', 'receive', 2),
        change('grammar', 'go', 'goes', 20),
      ],
      'I recieve when they go.',
      'I receive when they goes.',
    )
    stubCorrection(data)

    const result = await correct(data.originalText, 'wl4cd-multi')
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.explanations).toHaveLength(2)
    expect(result.data.explanations?.[0]?.source).toBe('trusted_rule')
    expect(result.data.explanations?.[1]?.source).not.toBe('trusted_rule')
  })

  it('TEST 13: account switch still blocks cross-account cache reuse', async () => {
    const uniqueText = 'WL4C-D account isolation recieve mail today.'
    const data = mockResponse(
      [change('spelling', 'recieve', 'receive', 25)],
      uniqueText,
      uniqueText.replace('recieve', 'receive'),
    )

    let resolveFetch: ((value: Response) => void) | undefined
    const fetchGate = new Promise<Response>((resolve) => {
      resolveFetch = resolve
    })
    vi.stubGlobal('fetch', vi.fn(() => fetchGate))

    const pending = correct(uniqueText, 'wl4cd-account-switch')
    await new Promise((resolve) => setTimeout(resolve, 0))
    await activateTestAccount(TEST_ACCOUNT_B)
    resolveFetch!({
      ok: true,
      json: async () => ({ ok: true, data, model: 'flowlary-ai' }),
    } as Response)

    const result = await pending
    expect(result).toMatchObject({ ok: false, error: 'account_changed' })
  })

  it('TEST 14: cache hit returns explanations computed after retrieval', async () => {
    const data = mockResponse(
      [change('spelling', 'thier', 'their', 0)],
      'thier book',
      'their book',
    )
    stubCorrection(data)

    const text = data.originalText
    const first = await correct(text, 'wl4cd-cache-1')
    const second = await correct(text, 'wl4cd-cache-2')
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    if (!first.ok || !second.ok) return

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(getCacheMetrics().ai_requests_avoided).toBeGreaterThan(0)
    expect(second.data.explanations?.[0]?.source).toBe('trusted_rule')
    expect(second.data.explanations?.[0]?.ruleId).toBe('english.spelling.their_not_ie')
  })

  it('TEST 16: no additional Groq/fetch call for explanation', async () => {
    const data = mockResponse(
      [change('spelling', 'recive', 'receive', 0)],
      'recive now',
      'receive now',
    )
    stubCorrection(data)

    await correct(data.originalText, 'wl4cd-no-extra-fetch')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('TEST 17: explanation integration does not create LearningEvents', async () => {
    const data = mockResponse(
      [change('spelling', 'recieve', 'receive', 0)],
      'recieve now',
      'receive now',
    )
    stubCorrection(data)

    const before = await getLearningEventService(flowlaryStorage).getEvents()
    const result = await correct(data.originalText, 'wl4cd-no-learning')
    expect(result.ok).toBe(true)
    const after = await getLearningEventService(flowlaryStorage).getEvents()
    expect(after).toHaveLength(before.length)
  })

  it('TEST 18: explanation integration does not write learning or history via handleCorrectText', async () => {
    const data = mockResponse(
      [change('spelling', 'recieve', 'receive', 0)],
      'recieve now',
      'receive now',
    )
    stubCorrection(data)

    const result = await correct(data.originalText, 'wl4cd-no-history')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.explanations).toHaveLength(1)
  })

  it('TEST 19: layout explanation is not framed as grammar rule', async () => {
    const data = mockResponse(
      [change('layout', 'lvpfh', 'hello', 0)],
      'lvpfh',
      'hello',
    )
    stubCorrection(data)

    const result = await correct(data.originalText, 'wl4cd-layout-not-grammar')
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const summary = result.data.explanations?.[0]?.summary.toLowerCase() ?? ''
    expect(summary).toContain('keyboard')
    expect(summary).not.toMatch(/\bgrammar rule\b/)
  })

  it('TEST 20: practice target preserved when supplied via enrich options', () => {
    const data = mockResponse(
      [change('spelling', 'definately', 'definitely', 0)],
      'definately',
      'definitely',
    )

    const enriched = shared.enrichCorrectionResponseWithExplanations(data, {
      practiceTargetIdForChange: () => 'spelling:definately',
    })

    expect(enriched.explanations?.[0]?.practiceTargetId).toBe('spelling:definately')
  })
})
