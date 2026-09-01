import { beforeEach, describe, expect, it } from 'vitest'
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
  setLearningProfile,
} from '../../extension/src/storage/index.ts'
import { recordLearningEvents } from '../../extension/src/storage/learning/events/index.ts'
import { createDefaultLearningProfile } from '@flowlary/shared'
import { handleMessage, resetBackgroundStartupForTests } from '../../extension/src/background/index.ts'
import { resolvePracticeFocus } from '../../extension/src/storage/learning/practice/recommendation.ts'

describe('WL-3 — personalization', () => {
  const store = createMockChromeStorage()

  beforeEach(async () => {
    store.reset()
    store.install()
    resetBackgroundStartupForTests()
    resetLearningEventServiceForTests()
    await clearTestAccountContext()
  })

  it('GET_PROGRESS includes personalization with user focus preserved', async () => {
    await activateTestAccount(TEST_ACCOUNT_A)
    await setLearningProfile(flowlaryStorage, {
      ...createDefaultLearningProfile(),
      focusAreas: ['grammar'],
      onboardingCompleted: true,
    })

    await recordLearningEvents(flowlaryStorage, [
      {
        batchId: 'w1',
        sampleText: 'I recieved your email today.',
        sampleWordCount: 60,
        category: 'spelling',
        original: 'recieved',
        corrected: 'received',
        action: 'accepted',
        source: 'writing',
      },
      {
        batchId: 'w2',
        sampleText: 'I recieved again today.',
        sampleWordCount: 60,
        category: 'spelling',
        original: 'recieved',
        corrected: 'received',
        action: 'accepted',
        source: 'writing',
      },
      {
        batchId: 'w3',
        sampleText: 'Still recieved today.',
        sampleWordCount: 60,
        category: 'spelling',
        original: 'recieved',
        corrected: 'received',
        action: 'accepted',
        source: 'writing',
      },
    ])
    await new Promise((resolve) => setTimeout(resolve, 20))

    const progress = await handleMessage({ type: 'GET_PROGRESS' })
    expect(progress && 'personalization' in progress && progress.personalization?.userFocusAreas).toEqual([
      'grammar',
    ])
    expect(progress && 'personalization' in progress && progress.personalization?.state).toBe('ready')
  })

  it('account B does not see account A focus personalization', async () => {
    await activateTestAccount(TEST_ACCOUNT_A)
    await setLearningProfile(flowlaryStorage, {
      ...createDefaultLearningProfile(),
      focusAreas: ['grammar'],
      onboardingCompleted: true,
    })
    await recordLearningEvents(flowlaryStorage, [
      {
        batchId: 'a1',
        sampleText: 'I recieved your email today.',
        sampleWordCount: 60,
        category: 'spelling',
        original: 'recieved',
        corrected: 'received',
        action: 'accepted',
        source: 'writing',
      },
    ])
    await new Promise((resolve) => setTimeout(resolve, 20))

    await activateTestAccount(TEST_ACCOUNT_B)
    await setLearningProfile(flowlaryStorage, {
      ...createDefaultLearningProfile(),
      focusAreas: ['spelling'],
      onboardingCompleted: true,
    })

    const progress = await handleMessage({ type: 'GET_PROGRESS' })
    expect(progress && 'personalization' in progress && progress.personalization?.userFocusAreas).toEqual([
      'spelling',
    ])
    expect(progress && 'errorCount' in progress && progress.errorCount).toBe(0)
  })

  it('explicit practice focus overrides recommendation', () => {
    const recommendation = {
      state: 'ready' as const,
      focus: 'spelling' as const,
    }
    const resolved = resolvePracticeFocus('grammar', recommendation)
    expect(resolved.focus).toBe('grammar')
  })

  it('GET_PRACTICE_HOME uses profile focus areas for recommendation boost', async () => {
    await activateTestAccount(TEST_ACCOUNT_A)
    await setLearningProfile(flowlaryStorage, {
      ...createDefaultLearningProfile(),
      focusAreas: ['grammar'],
      onboardingCompleted: true,
    })

    const now = Date.now()
    await recordLearningEvents(flowlaryStorage, [
      {
        batchId: 's1',
        sampleText: 'I recieved your email.',
        sampleWordCount: 20,
        category: 'spelling',
        original: 'recieved',
        corrected: 'received',
        action: 'accepted',
        source: 'writing',
      },
      {
        batchId: 's2',
        sampleText: 'I recieved again.',
        sampleWordCount: 20,
        category: 'spelling',
        original: 'recieved',
        corrected: 'received',
        action: 'accepted',
        source: 'writing',
      },
      {
        batchId: 'g1',
        sampleText: 'I wanted to go.',
        sampleWordCount: 20,
        category: 'grammar',
        original: 'wanted',
        corrected: 'want',
        action: 'accepted',
        source: 'writing',
      },
      {
        batchId: 'g2',
        sampleText: 'I wanted more.',
        sampleWordCount: 20,
        category: 'grammar',
        original: 'wanted',
        corrected: 'want',
        action: 'accepted',
        source: 'writing',
      },
      {
        batchId: 'w1',
        sampleText: 'A big change.',
        sampleWordCount: 20,
        category: 'wording',
        original: 'big',
        corrected: 'large',
        action: 'accepted',
        source: 'writing',
      },
    ])
    await new Promise((resolve) => setTimeout(resolve, 20))

    const home = await handleMessage({ type: 'GET_PRACTICE_HOME' })
    expect(home && 'recommendation' in home && home.recommendation.state).toBe('ready')
    expect(home && 'recommendation' in home && home.recommendation.focus).toBe('grammar')
  })
})
