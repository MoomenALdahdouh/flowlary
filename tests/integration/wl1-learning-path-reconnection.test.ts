import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CorrectionChange, CorrectionResponse } from '@flowlary/shared'
import { createMockChromeStorage } from '../helpers/mockChromeStorage.ts'
import {
  TEST_ACCOUNT_A,
  TEST_ACCOUNT_B,
  activateTestAccount,
  clearTestAccountContext,
} from '../helpers/accountIsolation.ts'
import {
  activeAccountContext,
  flowlaryStorage,
  resetHistoryServiceForTests,
  resetLearningEventServiceForTests,
  resetPracticeSessionStoreForTests,
} from '../../extension/src/storage/index.ts'
import {
  bootstrapContentScriptAccount,
  resetContentScriptAccountListenerForTests,
} from '../../extension/src/content/accountBootstrap.ts'
import {
  bootstrapDashboardAccount,
  resetDashboardAccountListenerForTests,
} from '../../extension/src/dashboard/accountBootstrap.ts'
import {
  recordCorrectionAccepted,
  recordCorrectionDetected,
  recordCorrectionRejected,
  recordPracticeAccepted,
  recordPracticeDetected,
} from '../../extension/src/features/learning/recordCorrectionLearning.ts'
import { recordLayoutLearningAccepted } from '../../extension/src/features/learning/recordLayoutLearning.ts'
import { getLearningEventService } from '../../extension/src/storage/learning/events/index.ts'
import { getPracticeSessionStore } from '../../extension/src/storage/learning/practice/sessions.ts'
import {
  computeProgressMetrics,
  computeRecurringPatterns,
} from '../../extension/src/storage/learning/progress.ts'
import { computePracticeRecommendation } from '../../extension/src/storage/learning/practice/recommendation.ts'
import { handleMessage, resetBackgroundStartupForTests } from '../../extension/src/background/index.ts'
import { recordLearningEvents } from '../../extension/src/storage/learning/events/index.ts'

const correctionResponse: CorrectionResponse = {
  originalText: 'I recieved your email today.',
  correctedText: 'I received your email today.',
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

describe('WL-1 — learning path reconnection', () => {
  const store = createMockChromeStorage()

  beforeEach(async () => {
    store.reset()
    store.install()
    resetContentScriptAccountListenerForTests()
    resetDashboardAccountListenerForTests()
    resetBackgroundStartupForTests()
    resetHistoryServiceForTests()
    resetLearningEventServiceForTests()
    resetPracticeSessionStoreForTests()
    await clearTestAccountContext()
  })

  async function flushLearningWrites(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 25))
  }

  describe('A — signed-in correction → learning', () => {
    it('content bootstrap then accepted correction persists under account', async () => {
      await activateTestAccount(TEST_ACCOUNT_A)
      await bootstrapContentScriptAccount()
      recordCorrectionAccepted('wl1-a', correctionResponse.originalText, correctionResponse)
      await flushLearningWrites()

      const events = await getLearningEventService(flowlaryStorage).getEvents()
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        category: 'spelling',
        action: 'accepted',
        source: 'writing',
      })
    })
  })

  describe('B — signed-out correction → no account learning write', () => {
    it('fail-closed when no active account', async () => {
      await bootstrapContentScriptAccount()
      expect(activeAccountContext.getAccountId()).toBeNull()

      recordCorrectionAccepted('wl1-b', correctionResponse.originalText, correctionResponse)
      await flushLearningWrites()

      const events = await getLearningEventService(flowlaryStorage).getEvents()
      expect(events).toHaveLength(0)
    })
  })

  describe('C/D — accepted and rejected events', () => {
    it('accepted correction creates accepted event', async () => {
      await activateTestAccount(TEST_ACCOUNT_A)
      await bootstrapContentScriptAccount()
      recordCorrectionAccepted('wl1-c', correctionResponse.originalText, correctionResponse)
      await flushLearningWrites()
      const events = await getLearningEventService(flowlaryStorage).getEvents()
      expect(events[0]?.action).toBe('accepted')
    })

    it('rejected correction creates rejected event', async () => {
      await activateTestAccount(TEST_ACCOUNT_A)
      await bootstrapContentScriptAccount()
      recordCorrectionRejected('wl1-d', correctionResponse.originalText, correctionResponse)
      await flushLearningWrites()
      const events = await getLearningEventService(flowlaryStorage).getEvents()
      expect(events[0]?.action).toBe('rejected')
    })
  })

  describe('E — direct mode semantics (accepted only)', () => {
    it('direct accepted does not require detected first', async () => {
      await activateTestAccount(TEST_ACCOUNT_A)
      await bootstrapContentScriptAccount()
      recordCorrectionAccepted('wl1-direct', correctionResponse.originalText, correctionResponse)
      await flushLearningWrites()

      const store = await getLearningEventService(flowlaryStorage).getStore()
      const progress = computeProgressMetrics(store)
      expect(progress.errorCount).toBe(1)
      expect(progress.writingErrorCount).toBe(1)
    })
  })

  describe('F — invalid change produces no learning event', () => {
    it('unchanged correction response produces zero events', async () => {
      await activateTestAccount(TEST_ACCOUNT_A)
      await bootstrapContentScriptAccount()
      const noop: CorrectionResponse = {
        originalText: 'Hello world.',
        correctedText: 'Hello world.',
        changes: [],
      }
      recordCorrectionAccepted('wl1-f', noop.originalText, noop)
      await flushLearningWrites()
      expect(await getLearningEventService(flowlaryStorage).getEvents()).toHaveLength(0)
    })
  })

  describe('G/H — layout learning policy', () => {
    it('manual layout fix creates accepted layout event', async () => {
      await activateTestAccount(TEST_ACCOUNT_A)
      await bootstrapContentScriptAccount()
      recordLayoutLearningAccepted('layout-manual-wl1', 'lvpfh typing test', 'lvpfh', 'hello')
      await flushLearningWrites()
      const events = await getLearningEventService(flowlaryStorage).getEvents()
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({ category: 'layout', action: 'accepted' })
    })
  })

  describe('I — account switch isolation', () => {
    it('account A events never visible under account B', async () => {
      await activateTestAccount(TEST_ACCOUNT_A)
      await bootstrapContentScriptAccount()
      recordCorrectionAccepted('wl1-i', correctionResponse.originalText, correctionResponse)
      await flushLearningWrites()

      await activateTestAccount(TEST_ACCOUNT_B)
      await bootstrapContentScriptAccount()
      const eventsB = await getLearningEventService(flowlaryStorage).getEvents()
      expect(eventsB).toHaveLength(0)
    })

    it('generation snapshot invalidates stale account write', async () => {
      await activateTestAccount(TEST_ACCOUNT_A)
      await bootstrapContentScriptAccount()
      const snapshotA = activeAccountContext.snapshot()
      await activateTestAccount(TEST_ACCOUNT_B)
      expect(activeAccountContext.matches(snapshotA)).toBe(false)
    })
  })

  describe('J — progress reads correct account', () => {
    it('GET_PROGRESS reflects account-scoped learning events', async () => {
      await activateTestAccount(TEST_ACCOUNT_A)
      await bootstrapContentScriptAccount()
      recordCorrectionAccepted('wl1-j', correctionResponse.originalText, correctionResponse)
      await flushLearningWrites()

      const progressA = await handleMessage({ type: 'GET_PROGRESS' })
      expect(progressA && 'errorCount' in progressA && progressA.errorCount).toBe(1)

      await activateTestAccount(TEST_ACCOUNT_B)
      await bootstrapContentScriptAccount()
      const progressB = await handleMessage({ type: 'GET_PROGRESS' })
      expect(progressB && 'errorCount' in progressB && progressB.errorCount).toBe(0)
    })
  })

  describe('K — practice sessions correct account', () => {
    it('SAVE_PRACTICE_SESSION persists under active account only', async () => {
      await activateTestAccount(TEST_ACCOUNT_A)
      await bootstrapContentScriptAccount()
      await handleMessage({
        type: 'SAVE_PRACTICE_SESSION',
        session: {
          id: 'wl1-ps',
          version: 1,
          startedAt: Date.now() - 60_000,
          completedAt: Date.now(),
          focus: 'spelling',
          itemsAttempted: 3,
          itemsCompleted: 3,
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
      await bootstrapContentScriptAccount()
      sessions = await getPracticeSessionStore(flowlaryStorage).list()
      expect(sessions).toHaveLength(0)
    })
  })

  describe('L — recurring error → recommendation', () => {
    it('same mistake twice yields recurring pattern and ready recommendation', async () => {
      await activateTestAccount(TEST_ACCOUNT_A)
      await bootstrapContentScriptAccount()

      for (let i = 0; i < 3; i += 1) {
        await recordLearningEvents(flowlaryStorage, [
          {
            batchId: `wl1-rec-${i}`,
            sampleText: 'I recieved your email again.',
            sampleWordCount: 6,
            category: 'spelling',
            original: 'recieved',
            corrected: 'received',
            action: 'accepted',
            source: 'writing',
          },
        ])
      }
      await flushLearningWrites()

      const eventStore = await getLearningEventService(flowlaryStorage).getStore()
      const patterns = computeRecurringPatterns(eventStore.events)
      expect(patterns.some((p) => p.normalizedOriginal === 'recieved' && p.count >= 2)).toBe(true)

      const recommendation = computePracticeRecommendation(eventStore.events)
      expect(recommendation.state).toBe('ready')
      expect(recommendation.focus).toBe('spelling')
    })
  })

  describe('M — practice completion via dashboard bootstrap', () => {
    it('dashboard bootstrap enables practice learning writes', async () => {
      await activateTestAccount(TEST_ACCOUNT_A)
      await bootstrapDashboardAccount()

      recordPracticeDetected('practice-wl1-0', correctionResponse.originalText, correctionResponse)
      recordPracticeAccepted('practice-wl1-0', correctionResponse.originalText, correctionResponse)
      await flushLearningWrites()

      const events = await getLearningEventService(flowlaryStorage).getEvents()
      expect(events).toHaveLength(2)
      expect(events.every((event) => event.source === 'practice')).toBe(true)
    })

    it('practice learning drops without dashboard bootstrap', async () => {
      recordPracticeAccepted('practice-no-bootstrap', correctionResponse.originalText, correctionResponse)
      await flushLearningWrites()
      expect(await getLearningEventService(flowlaryStorage).getEvents()).toHaveLength(0)
    })
  })

  describe('N — box mode detected+accepted dedupe', () => {
    it('detected then accepted counts as one error', async () => {
      await activateTestAccount(TEST_ACCOUNT_A)
      await bootstrapContentScriptAccount()
      recordCorrectionDetected('wl1-box', correctionResponse.originalText, correctionResponse)
      recordCorrectionAccepted('wl1-box', correctionResponse.originalText, correctionResponse)
      await flushLearningWrites()

      const store = await getLearningEventService(flowlaryStorage).getStore()
      const progress = computeProgressMetrics(store)
      expect(progress.errorCount).toBe(1)
    })
  })

  describe('practice exclusion — layout not in English practice', () => {
    it('layout events excluded from practice recommendation', async () => {
      await activateTestAccount(TEST_ACCOUNT_A)
      await bootstrapContentScriptAccount()

      for (let i = 0; i < 3; i += 1) {
        recordLayoutLearningAccepted(`layout-${i}`, 'lvpfh test sample', 'lvpfh', 'hello')
      }
      await flushLearningWrites()

      const store = await getLearningEventService(flowlaryStorage).getStore()
      const recommendation = computePracticeRecommendation(store.events)
      expect(recommendation.state).toBe('none')
    })
  })
})
