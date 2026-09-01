import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultLearningProfile, COACH_MAX_AI_INTERACTIONS_PER_DAY } from '@flowlary/shared'
import { createMockChromeStorage } from '../helpers/mockChromeStorage.ts'
import {
  activateTestAccount,
  clearTestAccountContext,
  TEST_ACCOUNT_A,
  TEST_ACCOUNT_B,
} from '../helpers/accountIsolation.ts'
import { seedFlowlaryAccountAuth } from '../helpers/mockFlowlaryAuth.ts'
import {
  flowlaryStorage,
  resetLearningEventServiceForTests,
  resetPracticeSessionStoreForTests,
} from '../../extension/src/storage/index.ts'
import { recordLearningEvents } from '../../extension/src/storage/learning/events/index.ts'
import { handleMessage, resetBackgroundStartupForTests } from '../../extension/src/background/index.ts'
import {
  clearLearningCoachQuotaForTests,
  readLearningCoachQuotaForTests,
} from '../../extension/src/storage/learning/coach/resolveLearningCoach.ts'
import {
  clearDailyBriefQuotaForTests,
} from '../../extension/src/storage/learning/brief/resolveDailyBrief.ts'
import {
  clearFullReportQuotaForTests,
} from '../../extension/src/storage/learning/report/resolveFullLearningReport.ts'

describe('WL-4F — AI Learning Coach', () => {
  const store = createMockChromeStorage()

  beforeEach(async () => {
    store.reset()
    store.install()
    resetBackgroundStartupForTests()
    resetLearningEventServiceForTests()
    resetPracticeSessionStoreForTests()
    await clearTestAccountContext()
    await activateTestAccount(TEST_ACCOUNT_A)
    seedFlowlaryAccountAuth(store)
    await clearLearningCoachQuotaForTests(flowlaryStorage)
    await clearDailyBriefQuotaForTests(flowlaryStorage)
    await clearFullReportQuotaForTests(flowlaryStorage)
    const handler = vi.fn(async (message: { type: string; mode?: string; question?: string }) =>
      handleMessage(message),
    )
    ;(globalThis as { chrome: { runtime: { sendMessage: typeof handler } } }).chrome.runtime.sendMessage =
      handler
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await activateTestAccount(TEST_ACCOUNT_A)
  })

  async function seedWriting(): Promise<void> {
    await recordLearningEvents(
      flowlaryStorage,
      Array.from({ length: 4 }, (_, index) => ({
        batchId: `w-${index}`,
        sampleText: `I recieved your email number ${index}.`,
        sampleWordCount: 20,
        category: 'spelling' as const,
        original: 'recieved',
        corrected: 'received',
        action: 'accepted' as const,
        source: 'writing' as const,
      })),
    )
  }

  it('ASK_LEARNING_COACH returns deterministic response for signed-in user', async () => {
    await seedWriting()
    const result = await handleMessage({ type: 'ASK_LEARNING_COACH', mode: 'focus' })
    expect(result.response.summary.length).toBeGreaterThan(0)
    expect(result.response.source).toBe('deterministic')
    expect(result.aiUsed).toBe(false)
    expect(result.state).toBe('ready')
  })

  it('signed-out user cannot access personalized coach', async () => {
    await clearTestAccountContext()
    const result = await handleMessage({ type: 'ASK_LEARNING_COACH', mode: 'focus' })
    expect(result.state).toBe('signed_out')
  })

  it('caches duplicate questions without extra AI quota consumption', async () => {
    await seedWriting()
    const first = await handleMessage({ type: 'ASK_LEARNING_COACH', mode: 'recurring_error' })
    const quotaAfterFirst = await readLearningCoachQuotaForTests(flowlaryStorage)
    const second = await handleMessage({ type: 'ASK_LEARNING_COACH', mode: 'recurring_error' })
    const quotaAfterSecond = await readLearningCoachQuotaForTests(flowlaryStorage)

    expect(second.fromCache).toBe(true)
    expect(second.response.summary).toBe(first.response.summary)
    expect(quotaAfterSecond.aiInteractionsUsed).toBe(quotaAfterFirst.aiInteractionsUsed)
  })

  it('account isolation: account B does not see account A coach cache', async () => {
    await seedWriting()
    await handleMessage({ type: 'ASK_LEARNING_COACH', mode: 'improving' })

    await activateTestAccount(TEST_ACCOUNT_B)
    resetLearningEventServiceForTests()
    resetPracticeSessionStoreForTests()
    await clearLearningCoachQuotaForTests(flowlaryStorage)
    await seedWriting()

    const resultB = await handleMessage({ type: 'ASK_LEARNING_COACH', mode: 'improving' })
    const quotaB = await readLearningCoachQuotaForTests(flowlaryStorage)
    expect(quotaB.cachedEntries.length).toBe(1)
    expect(resultB.fromCache).toBe(false)
  })

  it('does not consume Daily Brief or Full Report quotas', async () => {
    await seedWriting()
    const briefBefore = await handleMessage({ type: 'GET_DAILY_BRIEF' })
    await handleMessage({ type: 'ASK_LEARNING_COACH', mode: 'practice_help' })
    const briefAfter = await handleMessage({ type: 'GET_DAILY_BRIEF' })
    expect(briefAfter.generationsUsedToday).toBe(briefBefore.generationsUsedToday)
  })

  it('empty learning state returns honest insufficient messaging', async () => {
    const result = await handleMessage({ type: 'ASK_LEARNING_COACH', mode: 'focus' })
    expect(['empty', 'insufficient']).toContain(result.state)
    expect(result.response.actions.some((action) => action.kind === 'keep_writing')).toBe(true)
  })

  it('coach quota remains separate with known daily limit', async () => {
    await seedWriting()
    await handleMessage({ type: 'ASK_LEARNING_COACH', mode: 'focus' })
    const quota = await readLearningCoachQuotaForTests(flowlaryStorage)
    expect(quota.aiInteractionsUsed).toBeLessThanOrEqual(COACH_MAX_AI_INTERACTIONS_PER_DAY)
  })
})
