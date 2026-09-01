import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CorrectionChange, CorrectionResponse } from '@flowlary/shared'
import { createMockChromeStorage } from '../helpers/mockChromeStorage.ts'
import {
  TEST_ACCOUNT_A,
  TEST_ACCOUNT_B,
  activateTestAccount,
  clearTestAccountContext,
} from '../helpers/accountIsolation.ts'
import { seedFlowlaryAccountAuth } from '../helpers/mockFlowlaryAuth.ts'
import {
  flowlaryStorage,
  resetLearningEventServiceForTests,
  resetPracticeSessionStoreForTests,
  activeAccountContext,
} from '../../extension/src/storage/index.ts'
import {
  recordPracticeAccepted,
  recordPracticeDetected,
} from '../../extension/src/features/learning/recordCorrectionLearning.ts'
import {
  handleCorrectText,
  resetCorrectHandlerForTests,
} from '../../extension/src/background/correct.ts'
import { handleMessage, resetBackgroundStartupForTests } from '../../extension/src/background/index.ts'
import { getLearningEventService } from '../../extension/src/storage/learning/events/index.ts'
import { getPracticeSessionStore } from '../../extension/src/storage/learning/practice/sessions.ts'
import { getCacheMetrics, resetFlowlaryCacheForTests } from '../../extension/src/storage/cache/index.ts'
import { getEntitlementService, resetEntitlementServiceForTests } from '../../extension/src/entitlement/service.ts'
import { stateManager } from '../../extension/src/core/state/StateManager.ts'
import { computePracticeRecommendation, resolvePracticeFocus } from '../../extension/src/storage/learning/practice/recommendation.ts'
import { recordLearningEvents } from '../../extension/src/storage/learning/events/index.ts'
import { countUniqueLearningErrors } from '../../extension/src/storage/learning/progress.ts'
import { evaluateFeatureAccess } from '@flowlary/shared'

const correctionResponse: CorrectionResponse = {
  originalText: 'I recieved your email.',
  correctedText: 'I received your email.',
  changes: [
    {
      type: 'spelling',
      original: 'recieved',
      corrected: 'received',
      start: 2,
      end: 10,
    } satisfies CorrectionChange,
  ],
}

describe('WL-4A — practice correctness hardening', () => {
  const store = createMockChromeStorage()
  const originalFetch = globalThis.fetch

  beforeEach(async () => {
    store.reset()
    store.install()
    resetBackgroundStartupForTests()
    resetCorrectHandlerForTests()
    resetFlowlaryCacheForTests()
    resetEntitlementServiceForTests()
    resetLearningEventServiceForTests()
    resetPracticeSessionStoreForTests()
    await clearTestAccountContext()
    seedFlowlaryAccountAuth(store)
    await activateTestAccount(TEST_ACCOUNT_A)
    await getLearningEventService(flowlaryStorage).initialize()
    Object.assign(stateManager.correction, {
      enabled: true,
      mode: 'direct',
      highlights: true,
      consentAccepted: true,
    })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.unstubAllGlobals()
    resetFlowlaryCacheForTests()
  })

  async function flushLearningWrites(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 25))
  }

  it('free plan with zero credits blocks practice correction', async () => {
    const { STORAGE_KEYS } = await import('@flowlary/shared')
    const { readServerEntitlementCache } = await import('../../extension/src/config/accountAuth.ts')
    const cache = await readServerEntitlementCache(flowlaryStorage)
    expect(cache).not.toBeNull()
    await flowlaryStorage.set(
      STORAGE_KEYS.authServerEntitlement,
      {
        ...cache!,
        plan: 'free',
        creditsRemaining: 0,
        isPro: false,
        inTrial: false,
        capabilities: ['practice.basic', 'ai.correction'],
      },
      'local',
    )

    const access = await getEntitlementService(flowlaryStorage).canUseFeature('practice')
    expect(access.allowed).toBe(false)
    expect(access.reason).toBe('usage_exhausted')

    const result = await handleCorrectText({
      type: 'CORRECT_TEXT',
      requestId: 'wl4a-zero-credits',
      text: 'I recieved your email.',
      mode: 'practice',
    })
    expect(result).toMatchObject({ ok: false, error: 'usage_exhausted' })
  })

  it('free plan with credits allows practice.basic correction', async () => {
    const { STORAGE_KEYS } = await import('@flowlary/shared')
    const { readServerEntitlementCache } = await import('../../extension/src/config/accountAuth.ts')
    const cache = await readServerEntitlementCache(flowlaryStorage)
    await flowlaryStorage.set(
      STORAGE_KEYS.authServerEntitlement,
      {
        ...cache!,
        plan: 'free',
        creditsRemaining: 5,
        isPro: false,
        inTrial: false,
        capabilities: ['practice.basic', 'ai.correction'],
      },
      'local',
    )

    const access = evaluateFeatureAccess('practice', 'free', {
      creditsRemaining: 5,
      capabilities: ['practice.basic', 'ai.correction'],
      signedIn: true,
    })
    expect(access.allowed).toBe(true)

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          data: correctionResponse,
          model: 'flowlary-ai',
        }),
      } as Response),
    )

    const result = await handleCorrectText({
      type: 'CORRECT_TEXT',
      requestId: 'wl4a-free-ok',
      text: correctionResponse.originalText,
      mode: 'practice',
    })
    expect(result.ok).toBe(true)
  })

  it('account switch during in-flight practice correction returns account_changed', async () => {
    const uniqueText = 'WL4A account switch practice sentence with unique wording.'
    let resolveFetch: ((value: Response) => void) | undefined
    const fetchGate = new Promise<Response>((resolve) => {
      resolveFetch = resolve
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(() => fetchGate),
    )

    const pending = handleCorrectText({
      type: 'CORRECT_TEXT',
      requestId: 'wl4a-account-switch',
      text: uniqueText,
      mode: 'practice',
    })

    await new Promise((resolve) => setTimeout(resolve, 0))
    await activateTestAccount(TEST_ACCOUNT_B)
    resolveFetch!({
      ok: true,
      json: async () => ({
        ok: true,
        data: {
          ...correctionResponse,
          originalText: uniqueText,
        },
        model: 'flowlary-ai',
      }),
    } as Response)

    const result = await pending
    expect(result).toMatchObject({ ok: false, error: 'account_changed' })
  })

  it('cached practice correction avoids second Groq call', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          data: correctionResponse,
          model: 'flowlary-ai',
        }),
      } as Response),
    )

    const message = {
      type: 'CORRECT_TEXT' as const,
      requestId: 'wl4a-cache-1',
      text: correctionResponse.originalText,
      mode: 'practice' as const,
    }
    const first = await handleCorrectText(message)
    const second = await handleCorrectText({ ...message, requestId: 'wl4a-cache-2' })
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(getCacheMetrics().ai_requests_avoided).toBeGreaterThan(0)
  })

  it('failed practice correction does not create learning events', async () => {
    recordPracticeDetected('practice-fail-0', correctionResponse.originalText, correctionResponse)
    await flushLearningWrites()
    const before = await getLearningEventService(flowlaryStorage).getEvents()
    expect(before).toHaveLength(1)

    stateManager.correction.consentAccepted = false
    const result = await handleCorrectText({
      type: 'CORRECT_TEXT',
      requestId: 'wl4a-fail',
      text: correctionResponse.originalText,
      mode: 'practice',
    })
    expect(result.ok).toBe(false)
    expect(result).toMatchObject({ error: 'consent_required' })

    const after = await getLearningEventService(flowlaryStorage).getEvents()
    expect(after).toHaveLength(1)
  })

  it('double accept does not double-count practice learning errors', async () => {
    recordPracticeDetected('practice-session-dup-0', correctionResponse.originalText, correctionResponse)
    recordPracticeAccepted('practice-session-dup-0', correctionResponse.originalText, correctionResponse)
    recordPracticeAccepted('practice-session-dup-0', correctionResponse.originalText, correctionResponse)
    await flushLearningWrites()

    const events = await getLearningEventService(flowlaryStorage).getEvents()
    expect(events.every((event) => event.source === 'practice')).toBe(true)
    expect(countUniqueLearningErrors(events)).toBe(1)
  })

  it('user focus overrides recommendation category', () => {
    const recommendation = computePracticeRecommendation(
      [
        {
          id: '1',
          version: 1,
          timestamp: Date.now(),
          batchId: 'w1',
          source: 'writing',
          category: 'spelling',
          original: 'recieved',
          corrected: 'received',
          normalizedOriginal: 'recieved',
          normalizedCorrected: 'received',
          action: 'accepted',
          sampleWordCount: 4,
          sampleHash: 'h1',
        },
        {
          id: '2',
          version: 1,
          timestamp: Date.now(),
          batchId: 'w2',
          source: 'writing',
          category: 'spelling',
          original: 'recieved',
          corrected: 'received',
          normalizedOriginal: 'recieved',
          normalizedCorrected: 'received',
          action: 'accepted',
          sampleWordCount: 4,
          sampleHash: 'h2',
        },
        {
          id: '3',
          version: 1,
          timestamp: Date.now(),
          batchId: 'w3',
          source: 'writing',
          category: 'spelling',
          original: 'recieved',
          corrected: 'received',
          normalizedOriginal: 'recieved',
          normalizedCorrected: 'received',
          action: 'accepted',
          sampleWordCount: 4,
          sampleHash: 'h3',
        },
      ],
      Date.now(),
      [],
    )

    expect(recommendation.focus).toBe('spelling')
    expect(resolvePracticeFocus('grammar', recommendation)).toEqual({ focus: 'grammar' })
  })

  it('layout events do not enter English practice recommendation', async () => {
    await recordLearningEvents(flowlaryStorage, [
      {
        batchId: 'layout-1',
        sampleText: 'hello',
        sampleWordCount: 1,
        category: 'layout',
        original: 'hello',
        corrected: 'hello',
        action: 'accepted',
        source: 'writing',
      },
      {
        batchId: 'layout-2',
        sampleText: 'hello',
        sampleWordCount: 1,
        category: 'layout',
        original: 'hello',
        corrected: 'hello',
        action: 'accepted',
        source: 'writing',
      },
      {
        batchId: 'layout-3',
        sampleText: 'hello',
        sampleWordCount: 1,
        category: 'layout',
        original: 'hello',
        corrected: 'hello',
        action: 'accepted',
        source: 'writing',
      },
    ])

    const home = await handleMessage({ type: 'GET_PRACTICE_HOME' })
    expect(home.recommendation.state).toBe('none')
  })

  it('completed session saves only once under active account', async () => {
    await handleMessage({
      type: 'SAVE_PRACTICE_SESSION',
      session: {
        id: 'wl4a-session-1',
        version: 1,
        startedAt: Date.now() - 60_000,
        completedAt: Date.now(),
        focus: 'grammar',
        itemsAttempted: 5,
        itemsCompleted: 5,
        correctionsDetected: 1,
        correctionsAccepted: 1,
        correctionsRejected: 0,
        wordsWritten: 40,
        status: 'completed',
      },
    })

    let sessions = await getPracticeSessionStore(flowlaryStorage).list()
    expect(sessions).toHaveLength(1)

    await activateTestAccount(TEST_ACCOUNT_B)
    sessions = await getPracticeSessionStore(flowlaryStorage).list()
    expect(sessions).toHaveLength(0)

    await activateTestAccount(TEST_ACCOUNT_A)
    sessions = await getPracticeSessionStore(flowlaryStorage).list()
    expect(sessions).toHaveLength(1)
    expect(sessions[0]?.id).toBe('wl4a-session-1')
  })

  it('generation bump rejects stale learning write guard after account switch', async () => {
    const guard = activeAccountContext.snapshot()
    await activateTestAccount(TEST_ACCOUNT_B)
    expect(activeAccountContext.matches(guard)).toBe(false)
  })
})
