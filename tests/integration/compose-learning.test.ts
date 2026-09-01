import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CorrectionResponse } from '@flowlary/shared'
import { createMockChromeStorage } from '../helpers/mockChromeStorage.ts'
import { TEST_ACCOUNT_A, activateTestAccount, clearTestAccountContext } from '../helpers/accountIsolation.ts'
import {
  flowlaryStorage,
  resetLearningEventServiceForTests,
} from '../../extension/src/storage/index.ts'
import { bootstrapDashboardAccount, resetDashboardAccountListenerForTests } from '../../extension/src/dashboard/accountBootstrap.ts'
import { recordCorrectionDetected } from '../../extension/src/features/learning/recordCorrectionLearning.ts'
import { getLearningEventService } from '../../extension/src/storage/learning/events/index.ts'
import { computeProgressMetrics } from '../../extension/src/storage/learning/progress.ts'
import { computePracticeRecommendation } from '../../extension/src/storage/learning/practice/recommendation.ts'
import * as remoteSync from '../../extension/src/storage/learning/events/remoteSync.ts'

const composeCorrection: CorrectionResponse = {
  originalText: 'I has been working on this project for three month.',
  correctedText: 'I have been working on this project for three months.',
  changes: [
    { type: 'grammar', original: 'has', corrected: 'have', start: 2, end: 5 },
    { type: 'grammar', original: 'month', corrected: 'months', start: 45, end: 50 },
  ],
}

describe('Compose workbench learning recording', () => {
  const store = createMockChromeStorage()

  beforeEach(async () => {
    store.reset()
    store.install()
    resetDashboardAccountListenerForTests()
    resetLearningEventServiceForTests()
    await clearTestAccountContext()
    vi.spyOn(remoteSync, 'pullAndMergeRemoteLearningEvents').mockImplementation(
      async (_storage, local) => local,
    )
    vi.spyOn(remoteSync, 'syncLearningEventsToRemote').mockResolvedValue(undefined)
  })

  async function flushLearningWrites(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 25))
  }

  it('records writing events after dashboard bootstrap (compose correction path)', async () => {
    await activateTestAccount(TEST_ACCOUNT_A)
    await bootstrapDashboardAccount()

    recordCorrectionDetected('compose-test', composeCorrection.originalText, composeCorrection)
    await flushLearningWrites()

    const eventStore = await getLearningEventService(flowlaryStorage).getStore()
    expect(eventStore.events.length).toBeGreaterThan(0)
    expect(eventStore.events.every((event) => event.source === 'writing')).toBe(true)

    const progress = computeProgressMetrics(eventStore)
    expect(progress.state).not.toBe('empty')
    expect(progress.errorCount).toBeGreaterThan(0)

    const recommendation = computePracticeRecommendation(eventStore.events)
    expect(recommendation.state).not.toBe('none')
  })

  it('does not record compose learning without dashboard account bootstrap', async () => {
    recordCorrectionDetected('compose-no-bootstrap', composeCorrection.originalText, composeCorrection)
    await flushLearningWrites()
    const events = await getLearningEventService(flowlaryStorage).getEvents()
    expect(events).toHaveLength(0)
  })
})
