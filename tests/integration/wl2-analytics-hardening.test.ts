import { beforeEach, describe, expect, it } from 'vitest'
import {
  MIN_WORDS_FOR_ERROR_RATE,
  PROGRESS_TREND_PERIOD_MS,
  type LearningEvent,
} from '@flowlary/shared'
import { createMockChromeStorage } from '../helpers/mockChromeStorage.ts'
import {
  TEST_ACCOUNT_A,
  TEST_ACCOUNT_B,
  activateTestAccount,
  clearTestAccountContext,
} from '../helpers/accountIsolation.ts'
import {
  flowlaryStorage,
  resetLearningEventServiceForTests,
  resetPracticeSessionStoreForTests,
} from '../../extension/src/storage/index.ts'
import { recordLearningEvents } from '../../extension/src/storage/learning/events/index.ts'
import { bootstrapContentScriptAccount, resetContentScriptAccountListenerForTests } from '../../extension/src/content/accountBootstrap.ts'
import { handleMessage, resetBackgroundStartupForTests } from '../../extension/src/background/index.ts'
import { computeProgressMetrics } from '../../extension/src/storage/learning/progress.ts'
import { getLearningEventService } from '../../extension/src/storage/learning/events/index.ts'

describe('WL-2 — analytics hardening', () => {
  const store = createMockChromeStorage()

  beforeEach(async () => {
    store.reset()
    store.install()
    resetContentScriptAccountListenerForTests()
    resetBackgroundStartupForTests()
    resetLearningEventServiceForTests()
    resetPracticeSessionStoreForTests()
    await clearTestAccountContext()
  })

  const now = Date.now()
  const week = PROGRESS_TREND_PERIOD_MS

  function writingEvent(
    patch: Partial<LearningEvent> & { batchId: string; timestamp: number },
  ): Parameters<typeof recordLearningEvents>[1][number] {
    return {
      batchId: patch.batchId,
      sampleText: 'I recieved your email today and wanted to follow up quickly.',
      sampleWordCount: 12,
      category: patch.category ?? 'spelling',
      original: patch.original ?? 'recieved',
      corrected: patch.corrected ?? 'received',
      action: patch.action ?? 'accepted',
      source: 'writing',
    }
  }

  it('account A metrics do not include account B data', async () => {
    await activateTestAccount(TEST_ACCOUNT_A)
    await bootstrapContentScriptAccount()
    await recordLearningEvents(flowlaryStorage, [
      writingEvent({ batchId: 'a1', timestamp: now, original: 'recieved', corrected: 'received' }),
    ])
    await new Promise((resolve) => setTimeout(resolve, 20))

    let progress = await handleMessage({ type: 'GET_PROGRESS' })
    expect(progress && 'errorCount' in progress && progress.errorCount).toBe(1)

    await activateTestAccount(TEST_ACCOUNT_B)
    await bootstrapContentScriptAccount()
    progress = await handleMessage({ type: 'GET_PROGRESS' })
    expect(progress && 'errorCount' in progress && progress.errorCount).toBe(0)
  })

  it('insufficient words shows no error rate but retains error count', async () => {
    await activateTestAccount(TEST_ACCOUNT_A)
    await bootstrapContentScriptAccount()
    await recordLearningEvents(flowlaryStorage, [
      {
        batchId: 'small',
        sampleText: 'I wrote teh short note.',
        sampleWordCount: 5,
        category: 'spelling',
        original: 'teh',
        corrected: 'the',
        action: 'accepted',
        source: 'writing',
      },
    ])
    await new Promise((resolve) => setTimeout(resolve, 20))

    const progress = await handleMessage({ type: 'GET_PROGRESS' })
    expect(progress && 'state' in progress && progress.state).toBe('insufficient_words')
    expect(progress && 'errorsPer100Words' in progress && progress.errorsPer100Words).toBeNull()
    expect(progress && 'errorCount' in progress && progress.errorCount).toBe(1)
  })

  it('layout percentages do not dilute writing group percentages', async () => {
    await activateTestAccount(TEST_ACCOUNT_A)
    await bootstrapContentScriptAccount()
    await recordLearningEvents(flowlaryStorage, [
      writingEvent({ batchId: 'w1', timestamp: now, category: 'spelling' }),
      writingEvent({
        batchId: 'w2',
        timestamp: now,
        category: 'grammar',
        original: 'wanted',
        corrected: 'want',
      }),
      {
        batchId: 'l1',
        sampleText: 'lvpfh typing sample text here today',
        sampleWordCount: 8,
        category: 'layout',
        original: 'lvpfh',
        corrected: 'hello',
        action: 'accepted',
        source: 'writing',
      },
    ])
    await new Promise((resolve) => setTimeout(resolve, 20))

    const progress = await handleMessage({ type: 'GET_PROGRESS' })
    expect(progress && 'byTypePercentWriting' in progress && progress.byTypePercentWriting).toEqual({
      spelling: 50,
      grammar: 50,
      wording: 0,
    })
    expect(progress && 'byTypePercentInput' in progress && progress.byTypePercentInput).toEqual({
      layout: 100,
    })
  })

  it('rate-based trend improves when error count rises but rate falls', () => {
    const previousStart = now - week * 2
    const currentStart = now - week

    const event = (
      id: string,
      batchId: string,
      timestamp: number,
      original = 'recieved',
      corrected = 'received',
      category: LearningEvent['category'] = 'spelling',
    ): LearningEvent => ({
      id,
      version: 1,
      timestamp,
      batchId,
      source: 'writing',
      category,
      original,
      corrected,
      normalizedOriginal: original.toLowerCase(),
      normalizedCorrected: corrected.toLowerCase(),
      action: 'accepted',
      sampleWordCount: 12,
      sampleHash: 'sample',
    })

    const previousEvents = ['p1', 'p2', 'p3', 'p4', 'p5'].map((batchId, index) =>
      event(`${index}`, batchId, previousStart + index + 1),
    )
    const currentEvents = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10'].map(
      (batchId, index) =>
        event(
          `c${index}`,
          batchId,
          currentStart + index + 1,
          index % 2 === 0 ? 'recieved' : 'wanted',
          index % 2 === 0 ? 'received' : 'want',
          index % 2 === 0 ? 'spelling' : 'grammar',
        ),
    )

    const store = {
      version: 1 as const,
      events: [...previousEvents, ...currentEvents],
      samples: [
        { hash: 'prev', batchId: 'p1', wordCount: 100, timestamp: previousStart + 1 },
        { hash: 'curr', batchId: 'c1', wordCount: 500, timestamp: currentStart + 1 },
      ],
    }

    const metrics = computeProgressMetrics(store, { version: 1, sessions: [] }, now)
    expect(metrics.trend.direction).toBe('down')
    expect(metrics.trend.label).toBe('improved')
  })
})
