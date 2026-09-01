import { beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEYS } from '@flowlary/shared'
import type { CorrectionChange, CorrectionResponse } from '@flowlary/shared'
import { createMockChromeStorage } from '../helpers/mockChromeStorage.ts'
import { flowlaryStorage, resetLearningEventServiceForTests } from '../../extension/src/storage/index.ts'
import { recordLearningEvents } from '../../extension/src/storage/learning/events/index.ts'
import {
  recordCorrectionAccepted,
  recordCorrectionDetected,
} from '../../extension/src/features/learning/recordCorrectionLearning.ts'
import { handleMessage, resetBackgroundStartupForTests } from '../../extension/src/background/index.ts'
import { computeProgressMetrics, countUniqueLearningErrors } from '../../extension/src/storage/learning/progress.ts'
import { getLearningEventService } from '../../extension/src/storage/learning/events/index.ts'
import { stateManager } from '../../extension/src/core/state/StateManager.ts'
import { activateTestAccount, clearTestAccountContext, TEST_ACCOUNT_A } from '../helpers/accountIsolation.ts'
import { buildAccountScopedKey } from '../../extension/src/storage/accountScopedStorage.ts'

describe('Phase 22C — learning events + progress', () => {
  const store = createMockChromeStorage()

  beforeEach(async () => {
    store.reset()
    store.install()
    resetBackgroundStartupForTests()
    resetLearningEventServiceForTests()
    await clearTestAccountContext()
    await activateTestAccount()
    Object.assign(stateManager.correction, {
      enabled: true,
      mode: 'direct',
      highlights: true,
      consentAccepted: true,
    })
    const handler = vi.fn(async (message: { type: string }) => handleMessage(message))
    const chromeGlobal = globalThis as {
      chrome: { runtime: { sendMessage: typeof handler } }
    }
    chromeGlobal.chrome.runtime.sendMessage = handler
  })

  const response: CorrectionResponse = {
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

  it('records accepted correction learning events only from writing corrections', async () => {
    recordCorrectionAccepted('batch-1', response.originalText, response)
    await new Promise((resolve) => setTimeout(resolve, 20))

    const events = await getLearningEventService(flowlaryStorage).getEvents()
    expect(events).toHaveLength(1)
    expect(events[0]?.category).toBe('spelling')
    expect(events[0]?.action).toBe('accepted')
  })

  it('critical: one mistake + accept + rerender does not double-count', async () => {
    recordCorrectionDetected('batch-1', response.originalText, response)
    recordCorrectionAccepted('batch-1', response.originalText, response)
    recordCorrectionAccepted('batch-1', response.originalText, response)
    recordCorrectionDetected('batch-1', response.originalText, response)
    await new Promise((resolve) => setTimeout(resolve, 20))

    const events = await getLearningEventService(flowlaryStorage).getEvents()
    expect(countUniqueLearningErrors(events)).toBe(1)
  })

  it('ignores empty changes and unchanged text', async () => {
    await recordLearningEvents(flowlaryStorage, [
      {
        batchId: 'b1',
        sampleText: 'Hello world',
        sampleWordCount: 2,
        category: 'spelling',
        original: 'hello',
        corrected: 'hello',
        action: 'accepted',
      },
    ])
    const events = await getLearningEventService(flowlaryStorage).getEvents()
    expect(events).toHaveLength(0)
  })

  it('activity separation: progress ignores activity history counts', async () => {
    store.local[STORAGE_KEYS.history] = {
      version: 1,
      entries: Array.from({ length: 50 }, (_, index) => ({
        id: `h-${index}`,
        operation: index % 3 === 0 ? 'CORRECT' : index % 3 === 1 ? 'TRANSLATE' : 'FIX_LAYOUT',
        timestamp: Date.now() - index,
        sourceText: 'x',
        resultText: 'y',
      })),
      _v: 1,
    }

    recordCorrectionAccepted('batch-only', response.originalText, response)
    await new Promise((resolve) => setTimeout(resolve, 20))

    const progress = await handleMessage({ type: 'GET_PROGRESS' })
    expect(progress && 'errorCount' in progress && progress.errorCount).toBe(1)
    if (progress && 'errorCount' in progress) {
      expect(progress.errorCount).not.toBe(50)
      expect(progress.errorCount).not.toBe(20)
    }
  })

  it('clear learning history preserves activity and profile', async () => {
    store.local[buildAccountScopedKey(TEST_ACCOUNT_A, 'history')] = {
      version: 1,
      entries: [{ id: '1', operation: 'CORRECT', timestamp: Date.now(), sourceText: 'a', resultText: 'b' }],
      _v: 1,
    }
    store.local[buildAccountScopedKey(TEST_ACCOUNT_A, 'learningProfile')] = {
      learningLanguage: 'en',
      focusAreas: ['grammar'],
      onboardingCompleted: true,
      _v: 1,
    }

    recordCorrectionAccepted('batch-1', response.originalText, response)
    await new Promise((resolve) => setTimeout(resolve, 20))

    const cleared = await handleMessage({ type: 'CLEAR_LEARNING_EVENTS' })
    expect(cleared && 'state' in cleared && cleared.state).toBe('empty')

    const history = await handleMessage({ type: 'GET_HISTORY' })
    expect(history && 'entries' in history && history.entries.length).toBe(1)

    const profile = await handleMessage({ type: 'GET_LEARNING' })
    expect(profile && 'profile' in profile && profile.profile.onboardingCompleted).toBe(true)
  })

  it('GET_PROGRESS returns honest empty state without events', async () => {
    const progress = await handleMessage({ type: 'GET_PROGRESS' })
    expect(progress && 'state' in progress && progress.state).toBe('empty')
    if (progress && 'errorsPer100Words' in progress) {
      expect(progress.errorsPer100Words).toBeNull()
    }
  })
})
