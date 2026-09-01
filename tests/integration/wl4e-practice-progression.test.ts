import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LearningEvent } from '@flowlary/shared'
import { createDefaultLearningProfile, practiceTargetPatternId } from '@flowlary/shared'
import { createMockChromeStorage } from '../helpers/mockChromeStorage.ts'
import {
  activateTestAccount,
  clearTestAccountContext,
  TEST_ACCOUNT_A,
  TEST_ACCOUNT_B,
} from '../helpers/accountIsolation.ts'
import {
  flowlaryStorage,
  getLearningEventService,
  getPracticeSessionStore,
  resetLearningEventServiceForTests,
  resetPracticeSessionStoreForTests,
} from '../../extension/src/storage/index.ts'
import { recordLearningEvents } from '../../extension/src/storage/learning/events/index.ts'
import { handleMessage, resetBackgroundStartupForTests } from '../../extension/src/background/index.ts'
import { computeDailyBriefSnapshot } from '../../extension/src/storage/learning/brief/computeDailyBrief.ts'
import { computeLearningAnalysisSnapshot } from '../../extension/src/storage/learning/report/computeLearningAnalysisSnapshot.ts'
import { buildDeterministicFullReportNarrative } from '../../extension/src/storage/learning/report/buildDeterministicReport.ts'

const TARGET_PATTERN = {
  category: 'spelling' as const,
  normalizedOriginal: 'recieved',
  displayOriginal: 'recieved',
  displayCorrected: 'received',
  count: 3,
}

async function seedWritingPattern(): Promise<void> {
  await recordLearningEvents(
    flowlaryStorage,
    Array.from({ length: 3 }, (_, index) => ({
      batchId: `w-${index}`,
      sampleText: 'I recieved your email.',
      sampleWordCount: 20,
      category: 'spelling' as const,
      original: 'recieved',
      corrected: 'received',
      action: 'accepted' as const,
      source: 'writing' as const,
    })),
  )
}

async function saveTargetedPracticeSession(
  sessionId: string,
  itemsCompleted: number,
  practiceEvents: Array<Partial<LearningEvent> & { batchId: string }> = [],
): Promise<void> {
  await recordLearningEvents(
    flowlaryStorage,
    practiceEvents.map((event) => ({
      sampleText: 'Practice attempt.',
      sampleWordCount: 10,
      category: TARGET_PATTERN.category,
      original: TARGET_PATTERN.displayOriginal,
      corrected: TARGET_PATTERN.displayCorrected,
      normalizedOriginal: TARGET_PATTERN.normalizedOriginal,
      action: 'detected' as const,
      source: 'practice' as const,
      ...event,
    })),
  )
  await handleMessage({
    type: 'SAVE_PRACTICE_SESSION',
    session: {
      id: sessionId,
      version: 1,
      startedAt: Date.now() - 60_000,
      completedAt: Date.now(),
      focus: 'recommended',
      targetPattern: TARGET_PATTERN,
      itemsAttempted: itemsCompleted,
      itemsCompleted,
      correctionsDetected: practiceEvents.length,
      correctionsAccepted: 0,
      correctionsRejected: 0,
      wordsWritten: itemsCompleted * 8,
      status: 'completed',
    },
  })
}

describe('WL-4E — practice scoring & progression', () => {
  const store = createMockChromeStorage()
  const profile = createDefaultLearningProfile()
  const now = Date.UTC(2026, 7, 27, 12, 0, 0)

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
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

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('GET_PRACTICE_HOME includes targetProgressions', async () => {
    await seedWritingPattern()
    await saveTargetedPracticeSession('s1', 2)
    const home = await handleMessage({ type: 'GET_PRACTICE_HOME' })
    expect(home.targetProgressions.length).toBeGreaterThan(0)
    expect(home.targetProgressions[0]?.targetPatternId).toBe(
      practiceTargetPatternId(TARGET_PATTERN),
    )
    expect(home.recommendation.state).toBe('ready')
  })

  it('deprioritizes stable target when another recurring target exists', async () => {
    await recordLearningEvents(flowlaryStorage, [
      ...Array.from({ length: 3 }, (_, index) => ({
        batchId: `spell-${index}`,
        sampleText: 'I recieved your email.',
        sampleWordCount: 20,
        category: 'spelling' as const,
        original: 'recieved',
        corrected: 'received',
        action: 'accepted' as const,
        source: 'writing' as const,
      })),
      ...Array.from({ length: 2 }, (_, index) => ({
        batchId: `grammar-${index}`,
        sampleText: 'He go to school.',
        sampleWordCount: 20,
        category: 'grammar' as const,
        original: 'He go',
        corrected: 'He goes',
        action: 'accepted' as const,
        source: 'writing' as const,
      })),
    ])
    await saveTargetedPracticeSession('stable-1', 3)
    await saveTargetedPracticeSession('stable-2', 3)
    await saveTargetedPracticeSession('stable-3', 3)
    const home = await handleMessage({ type: 'GET_PRACTICE_HOME' })
    const progression = home.targetProgressions.find(
      (item) => item.targetPatternId === practiceTargetPatternId(TARGET_PATTERN),
    )
    expect(progression?.state).toBe('stable')
    expect(
      home.recurringTargets.some(
        (pattern) => pattern.normalizedOriginal === TARGET_PATTERN.normalizedOriginal,
      ),
    ).toBe(false)
    expect(home.recurringTargets.some((pattern) => pattern.category === 'grammar')).toBe(true)
  })

  it('daily brief attaches targetProgression only for improving or stable evidence', async () => {
    await seedWritingPattern()
    await saveTargetedPracticeSession('brief-1', 3)
    await saveTargetedPracticeSession('brief-2', 3)
    const learningStore = await getLearningEventService(flowlaryStorage).getStore()
    const sessions = await getPracticeSessionStore(flowlaryStorage).list()
    const snapshot = computeDailyBriefSnapshot(
      learningStore,
      { version: 1, sessions },
      profile,
      now,
    )
    expect(snapshot.targetProgression?.state).toBe('stable')
  })

  it('full learning report snapshot includes practiceProgressions', async () => {
    await seedWritingPattern()
    await saveTargetedPracticeSession('report-1', 3)
    await saveTargetedPracticeSession('report-2', 3)
    const learningStore = await getLearningEventService(flowlaryStorage).getStore()
    const sessions = await getPracticeSessionStore(flowlaryStorage).list()
    const snapshot = computeLearningAnalysisSnapshot(learningStore, { version: 1, sessions }, profile, now)
    expect(snapshot.practiceProgressions.length).toBeGreaterThan(0)
    const stable = snapshot.practiceProgressions.find((item) => item.state === 'stable')
    expect(stable).toBeTruthy()
    const narrative = buildDeterministicFullReportNarrative(snapshot, 'en')
    expect(
      narrative.recommendations.some(
        (line) => line.includes('In practice') || line.includes('stable'),
      ),
    ).toBe(true)
  })

  it('account isolation: account B does not inherit account A practice progression', async () => {
    await seedWritingPattern()
    await saveTargetedPracticeSession('iso-a-1', 3)
    const homeA = await handleMessage({ type: 'GET_PRACTICE_HOME' })
    expect(homeA.targetProgressions[0]?.practiceAttempts).toBeGreaterThan(0)

    await activateTestAccount(TEST_ACCOUNT_B)
    resetLearningEventServiceForTests()
    resetPracticeSessionStoreForTests()
    await seedWritingPattern()
    const homeB = await handleMessage({ type: 'GET_PRACTICE_HOME' })
    const progressionB = homeB.targetProgressions.find(
      (item) => item.targetPatternId === practiceTargetPatternId(TARGET_PATTERN),
    )
    expect(progressionB?.practiceAttempts ?? 0).toBe(0)
  })

  it('layout events do not affect English practice progression', async () => {
    await seedWritingPattern()
    await recordLearningEvents(flowlaryStorage, [
      {
        batchId: 'layout-practice-1',
        sampleText: 'hello',
        sampleWordCount: 5,
        category: 'layout',
        original: 'hello',
        corrected: 'hello',
        action: 'accepted',
        source: 'practice',
      },
    ])
    await saveTargetedPracticeSession('layout-safe', 2)
    const home = await handleMessage({ type: 'GET_PRACTICE_HOME' })
    expect(home.targetProgressions.every((item) => item.category !== 'layout')).toBe(true)
  })
})
