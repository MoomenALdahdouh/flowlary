import { beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEYS } from '@flowlary/shared'
import type { CorrectionChange, CorrectionResponse } from '@flowlary/shared'
import { createMockChromeStorage } from '../helpers/mockChromeStorage.ts'
import {
  flowlaryStorage,
  resetLearningEventServiceForTests,
  resetPracticeSessionStoreForTests,
} from '../../extension/src/storage/index.ts'
import { recordLearningEvents } from '../../extension/src/storage/learning/events/index.ts'
import {
  recordPracticeAccepted,
  recordPracticeDetected,
} from '../../extension/src/features/learning/recordCorrectionLearning.ts'
import { handleMessage, resetBackgroundStartupForTests } from '../../extension/src/background/index.ts'
import { countUniqueLearningErrors } from '../../extension/src/storage/learning/progress.ts'
import { getLearningEventService } from '../../extension/src/storage/learning/events/index.ts'
import { getPracticeSessionStore } from '../../extension/src/storage/learning/practice/sessions.ts'
import { stateManager } from '../../extension/src/core/state/StateManager.ts'
import { activateTestAccount, clearTestAccountContext } from '../helpers/accountIsolation.ts'

describe('Phase 22D — practice center', () => {
  const store = createMockChromeStorage()

  beforeEach(async () => {
    store.reset()
    store.install()
    resetBackgroundStartupForTests()
    resetLearningEventServiceForTests()
    resetPracticeSessionStoreForTests()
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

  it('GET_PRACTICE_HOME returns recommendation from writing events only', async () => {
    await recordLearningEvents(flowlaryStorage, [
      {
        batchId: 'w1',
        sampleText: 'I recieved your email.',
        sampleWordCount: 5,
        category: 'spelling',
        original: 'recieved',
        corrected: 'received',
        action: 'accepted',
        source: 'writing',
      },
      {
        batchId: 'w2',
        sampleText: 'I recieved again.',
        sampleWordCount: 4,
        category: 'spelling',
        original: 'recieved',
        corrected: 'received',
        action: 'accepted',
        source: 'writing',
      },
      {
        batchId: 'w3',
        sampleText: 'Still recieved.',
        sampleWordCount: 3,
        category: 'spelling',
        original: 'recieved',
        corrected: 'received',
        action: 'accepted',
        source: 'writing',
      },
    ])

    const home = await handleMessage({ type: 'GET_PRACTICE_HOME' })
    expect(home).toMatchObject({
      eventCount: 3,
      recommendation: { state: 'ready', focus: 'spelling' },
    })
  })

  it('critical: practice accept + rerender does not double-count learning errors', async () => {
    recordPracticeDetected('practice-session-1-0', response.originalText, response)
    recordPracticeAccepted('practice-session-1-0', response.originalText, response)
    recordPracticeAccepted('practice-session-1-0', response.originalText, response)
    recordPracticeDetected('practice-session-1-0', response.originalText, response)
    await new Promise((resolve) => setTimeout(resolve, 20))

    const events = await getLearningEventService(flowlaryStorage).getEvents()
    expect(events.every((event) => event.source === 'practice')).toBe(true)
    expect(countUniqueLearningErrors(events)).toBe(1)
  })

  it('SAVE_PRACTICE_SESSION persists locally and CLEAR_LEARNING_EVENTS removes it', async () => {
    await handleMessage({
      type: 'SAVE_PRACTICE_SESSION',
      session: {
        id: 'ps-1',
        version: 1,
        startedAt: Date.now() - 60_000,
        completedAt: Date.now(),
        focus: 'spelling',
        itemsAttempted: 5,
        itemsCompleted: 5,
        correctionsDetected: 2,
        correctionsAccepted: 1,
        correctionsRejected: 1,
        wordsWritten: 80,
        status: 'completed',
      },
    })

    let sessions = await getPracticeSessionStore(flowlaryStorage).list()
    expect(sessions).toHaveLength(1)

    await handleMessage({ type: 'CLEAR_LEARNING_EVENTS' })
    sessions = await getPracticeSessionStore(flowlaryStorage).list()
    expect(sessions).toHaveLength(0)
  })

  it('translation activity does not change practice recommendation inputs', async () => {
    await recordLearningEvents(flowlaryStorage, [
      {
        batchId: 'w1',
        sampleText: 'I recieved your email.',
        sampleWordCount: 5,
        category: 'spelling',
        original: 'recieved',
        corrected: 'received',
        action: 'accepted',
        source: 'writing',
      },
      {
        batchId: 'w2',
        sampleText: 'I recieved again.',
        sampleWordCount: 4,
        category: 'spelling',
        original: 'recieved',
        corrected: 'received',
        action: 'accepted',
        source: 'writing',
      },
      {
        batchId: 'w3',
        sampleText: 'Still recieved.',
        sampleWordCount: 3,
        category: 'spelling',
        original: 'recieved',
        corrected: 'received',
        action: 'accepted',
        source: 'writing',
      },
    ])

    const before = await handleMessage({ type: 'GET_PRACTICE_HOME' })

    store.local[STORAGE_KEYS.history] = {
      version: 1,
      entries: Array.from({ length: 20 }, (_, index) => ({
        id: `h-${index}`,
        operation: 'TRANSLATE',
        timestamp: Date.now() - index,
        sourceText: 'Hello world',
        resultText: 'Hola mundo',
      })),
      _v: 1,
    }

    const after = await handleMessage({ type: 'GET_PRACTICE_HOME' })
    expect(after).toEqual(before)
  })
})
