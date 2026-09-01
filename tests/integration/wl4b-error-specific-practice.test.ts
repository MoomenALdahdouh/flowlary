import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockChromeStorage } from '../helpers/mockChromeStorage.ts'
import {
  activateTestAccount,
  clearTestAccountContext,
  TEST_ACCOUNT_A,
  TEST_ACCOUNT_B,
} from '../helpers/accountIsolation.ts'
import {
  flowlaryStorage,
  resetLearningEventServiceForTests,
  resetPracticeSessionStoreForTests,
} from '../../extension/src/storage/index.ts'
import { recordLearningEvents } from '../../extension/src/storage/learning/events/index.ts'
import { handleMessage, resetBackgroundStartupForTests } from '../../extension/src/background/index.ts'
import { selectPracticeSessionTarget } from '../../extension/src/storage/learning/practice/targetSelection.ts'
import { buildPracticeExercise } from '../../extension/src/storage/learning/practice/exercise.ts'

describe('WL-4B — error-specific practice', () => {
  const store = createMockChromeStorage()

  beforeEach(async () => {
    store.reset()
    store.install()
    resetBackgroundStartupForTests()
    resetLearningEventServiceForTests()
    resetPracticeSessionStoreForTests()
    await clearTestAccountContext()
    await activateTestAccount(TEST_ACCOUNT_A)
    const handler = vi.fn(async (message: { type: string }) => handleMessage(message))
    ;(globalThis as { chrome: { runtime: { sendMessage: typeof handler } } }).chrome.runtime.sendMessage =
      handler
  })

  async function seedSpellingPattern(): Promise<void> {
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
  }

  it('GET_PRACTICE_HOME returns recurring targets for targeted selection', async () => {
    await seedSpellingPattern()
    const home = await handleMessage({ type: 'GET_PRACTICE_HOME' })
    expect(home.recurringTargets.length).toBeGreaterThan(0)
    expect(home.recurringTargets[0]).toMatchObject({
      category: 'spelling',
      normalizedOriginal: 'recieved',
      count: 3,
    })
  })

  it('explicit grammar focus selects grammar recurring target, not spelling recommendation', async () => {
    await recordLearningEvents(flowlaryStorage, [
      ...Array.from({ length: 3 }, (_, index) => ({
        batchId: `s-${index}`,
        sampleText: 'I recieved your email.',
        sampleWordCount: 5,
        category: 'spelling' as const,
        original: 'recieved',
        corrected: 'received',
        action: 'accepted' as const,
        source: 'writing' as const,
      })),
      {
        batchId: 'g1',
        sampleText: 'He go to school.',
        sampleWordCount: 5,
        category: 'grammar' as const,
        original: 'He go',
        corrected: 'He goes',
        action: 'accepted' as const,
        source: 'writing' as const,
      },
      {
        batchId: 'g2',
        sampleText: 'He go again.',
        sampleWordCount: 4,
        category: 'grammar' as const,
        original: 'He go',
        corrected: 'He goes',
        action: 'accepted' as const,
        source: 'writing' as const,
      },
    ])

    const home = await handleMessage({ type: 'GET_PRACTICE_HOME' })

    const target = selectPracticeSessionTarget('grammar', home.recommendation, home.recurringTargets)
    expect(target.focus).toBe('grammar')
    expect(target.targeted).toBe(true)
    expect(target.pattern?.category).toBe('grammar')
    expect(target.pattern?.normalizedOriginal).toBe('he go')

    const exercise = buildPracticeExercise(target.focus, target.pattern, 0, target.targeted)
    expect(exercise.targeted).toBe(true)
    if (exercise.targeted) {
      expect(exercise.prompt.toLowerCase()).toContain('he goes')
    }
  })

  it('recommended path uses strongest eligible recurring pattern', async () => {
    await seedSpellingPattern()
    const home = await handleMessage({ type: 'GET_PRACTICE_HOME' })
    const target = selectPracticeSessionTarget('recommended', home.recommendation, home.recurringTargets)
    expect(target.targeted).toBe(true)
    expect(target.pattern?.normalizedOriginal).toBe('recieved')
    const exercise = buildPracticeExercise(target.focus, target.pattern, 0, target.targeted)
    expect(exercise.targeted).toBe(true)
    if (exercise.targeted) {
      expect(exercise.prompt).toContain('received')
    }
  })

  it('layout events never appear in recurring practice targets', async () => {
    await recordLearningEvents(flowlaryStorage, [
      {
        batchId: 'l1',
        sampleText: 'hello',
        sampleWordCount: 1,
        category: 'layout',
        original: 'hello',
        corrected: 'hello',
        action: 'accepted',
        source: 'writing',
      },
      {
        batchId: 'l2',
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
    expect(home.recurringTargets).toEqual([])
  })

  it('account-scoped targets do not leak between accounts', async () => {
    await seedSpellingPattern()
    const homeA = await handleMessage({ type: 'GET_PRACTICE_HOME' })
    expect(homeA.recurringTargets[0]?.normalizedOriginal).toBe('recieved')

    await activateTestAccount(TEST_ACCOUNT_B)
    const homeB = await handleMessage({ type: 'GET_PRACTICE_HOME' })
    expect(homeB.recurringTargets).toEqual([])
  })
})
