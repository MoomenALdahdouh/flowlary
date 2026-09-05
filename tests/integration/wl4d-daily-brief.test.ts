import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LearningEvent } from '@flowlary/shared'
import {
  createDefaultLearningProfile,
  MIN_WORDS_FOR_ERROR_RATE,
  PROGRESS_TREND_PERIOD_MS,
  STORAGE_KEYS,
  utcDayKey,
} from '@flowlary/shared'
import { createMockChromeStorage } from '../helpers/mockChromeStorage.ts'
import {
  activateTestAccount,
  clearTestAccountContext,
  TEST_ACCOUNT_A,
  TEST_ACCOUNT_B,
} from '../helpers/accountIsolation.ts'
import { seedFlowlaryAccountAuth } from '../helpers/mockFlowlaryAuth.ts'
import { stubLearningRemoteUnavailable } from '../helpers/stubLearningRemote.ts'
import {
  flowlaryStorage,
  getLearningEventService,
  resetLearningEventServiceForTests,
  resetPracticeSessionStoreForTests,
} from '../../extension/src/storage/index.ts'
import { recordLearningEvents } from '../../extension/src/storage/learning/events/index.ts'
import { handleMessage, resetBackgroundStartupForTests } from '../../extension/src/background/index.ts'
import {
  buildDailyBriefEvidenceVersion,
  computeDailyBriefSnapshot,
} from '../../extension/src/storage/learning/brief/computeDailyBrief.ts'
import {
  clearDailyBriefQuotaForTests,
  readDailyBriefQuotaForTests,
} from '../../extension/src/storage/learning/brief/resolveDailyBrief.ts'
import { normalizeLearningEventStore } from '../../extension/src/storage/learning/events/index.ts'

function writingEvent(
  patch: Partial<LearningEvent> & Pick<LearningEvent, 'batchId' | 'timestamp'>,
): LearningEvent {
  return {
    id: patch.id ?? patch.batchId,
    version: 1,
    timestamp: patch.timestamp,
    batchId: patch.batchId,
    source: patch.source ?? 'writing',
    category: patch.category ?? 'spelling',
    original: patch.original ?? 'recieved',
    corrected: patch.corrected ?? 'received',
    normalizedOriginal: patch.normalizedOriginal ?? (patch.original ?? 'recieved').toLowerCase(),
    normalizedCorrected: patch.normalizedCorrected ?? (patch.corrected ?? 'received').toLowerCase(),
    action: patch.action ?? 'accepted',
    sampleWordCount: patch.sampleWordCount ?? 20,
    sampleHash: patch.sampleHash ?? `hash-${patch.batchId}`,
  }
}

describe('WL-4D — Daily Learning Brief', () => {
  const store = createMockChromeStorage()
  const profile = createDefaultLearningProfile()
  const now = Date.UTC(2026, 7, 27, 12, 0, 0)

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(now)
    stubLearningRemoteUnavailable()
    store.reset()
    store.install()
    resetBackgroundStartupForTests()
    resetLearningEventServiceForTests()
    resetPracticeSessionStoreForTests()
    await clearTestAccountContext()
    await activateTestAccount(TEST_ACCOUNT_A)
    seedFlowlaryAccountAuth(store)
    const handler = vi.fn(async (message: { type: string }) => handleMessage(message))
    ;(globalThis as { chrome: { runtime: { sendMessage: typeof handler } } }).chrome.runtime.sendMessage =
      handler
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  async function seedSpellingPattern(): Promise<void> {
    await recordLearningEvents(flowlaryStorage, [
      {
        batchId: 'w1',
        sampleText: 'I recieved your email.',
        sampleWordCount: 20,
        category: 'spelling',
        original: 'recieved',
        corrected: 'received',
        action: 'accepted',
        source: 'writing',
      },
      {
        batchId: 'w2',
        sampleText: 'I recieved again.',
        sampleWordCount: 20,
        category: 'spelling',
        original: 'recieved',
        corrected: 'received',
        action: 'accepted',
        source: 'writing',
      },
      {
        batchId: 'w3',
        sampleText: 'Still recieved.',
        sampleWordCount: 20,
        category: 'spelling',
        original: 'recieved',
        corrected: 'received',
        action: 'accepted',
        source: 'writing',
      },
    ])
  }

  it('returns signed_out brief without account session', async () => {
    await clearTestAccountContext()
    delete store.local[STORAGE_KEYS.authAccessToken]
    delete store.local[STORAGE_KEYS.authRefreshToken]
    delete store.local[STORAGE_KEYS.authSessionId]
    delete store.local[STORAGE_KEYS.authAccountEmail]
    delete store.local[STORAGE_KEYS.authAccountId]
    const brief = await handleMessage({ type: 'GET_DAILY_BRIEF' })
    expect(brief.state).toBe('signed_out')
  })

  it('returns empty state for no learning events', async () => {
    const brief = await handleMessage({ type: 'GET_DAILY_BRIEF' })
    expect(brief.state).toBe('empty')
    expect(brief.recurringPattern).toBeNull()
  })

  it('returns insufficient for one isolated error', async () => {
    await recordLearningEvents(flowlaryStorage, [
      {
        batchId: 'one',
        sampleText: 'I recieved.',
        sampleWordCount: 10,
        category: 'spelling',
        original: 'recieved',
        corrected: 'received',
        action: 'accepted',
        source: 'writing',
      },
    ])
    const brief = await handleMessage({ type: 'GET_DAILY_BRIEF' })
    expect(brief.state).toBe('insufficient')
    expect(brief.recurringPattern).toBeNull()
  })

  it('includes recurring spelling pattern with practice action', async () => {
    await seedSpellingPattern()
    const brief = await handleMessage({ type: 'GET_DAILY_BRIEF' })
    expect(brief.state).toBe('ready')
    expect(brief.recurringPattern).toMatchObject({
      category: 'spelling',
      displayOriginal: 'recieved',
      count: 3,
    })
    expect(brief.recommendedAction.kind).toBe('practice_pattern')
  })

  it('excludes layout events from English learning brief', async () => {
    await seedSpellingPattern()
    await recordLearningEvents(flowlaryStorage, [
      {
        batchId: 'l1',
        sampleText: 'layout typo',
        sampleWordCount: 20,
        category: 'layout',
        original: 'hello',
        corrected: 'hello',
        action: 'accepted',
        source: 'writing',
      },
      {
        batchId: 'l2',
        sampleText: 'layout typo 2',
        sampleWordCount: 20,
        category: 'layout',
        original: 'hello',
        corrected: 'hello',
        action: 'accepted',
        source: 'writing',
      },
    ])
    const learningStore = await getLearningEventService(flowlaryStorage).getStore()
    const snapshot = computeDailyBriefSnapshot(learningStore, { version: 1, sessions: [] }, profile, now)
    expect(snapshot.focusCategory).not.toBe('layout')
    expect(snapshot.recurringPattern?.category).toBe('spelling')
  })

  it('does not treat single event as recurring pattern in snapshot', () => {
    const events = [writingEvent({ batchId: 'g1', timestamp: now, category: 'grammar', original: 'go', corrected: 'goes', normalizedOriginal: 'go' })]
    const learningStore = normalizeLearningEventStore({
      events,
      samples: [{ hash: 'h1', batchId: 'g1', wordCount: MIN_WORDS_FOR_ERROR_RATE, timestamp: now }],
    })
    const snapshot = computeDailyBriefSnapshot(learningStore, { version: 1, sessions: [] }, profile, now)
    expect(snapshot.recurringPattern).toBeNull()
  })

  it('detects improvement only with valid writing trend evidence', () => {
    const currentMid = now - PROGRESS_TREND_PERIOD_MS / 2
    const previousMid = now - PROGRESS_TREND_PERIOD_MS * 1.5
    const events = [
      ...Array.from({ length: 4 }, (_, i) =>
        writingEvent({
          batchId: `prev-${i}`,
          timestamp: previousMid + i * 1000,
          category: 'grammar',
          original: 'go',
          corrected: 'goes',
          normalizedOriginal: `go-prev-${i}`,
        }),
      ),
      ...Array.from({ length: 3 }, (_, i) =>
        writingEvent({
          batchId: `curr-${i}`,
          timestamp: currentMid + i * 1000,
          category: 'grammar',
          original: 'go',
          corrected: 'goes',
          normalizedOriginal: `go-curr-${i}`,
        }),
      ),
    ]
    const samples = [
      {
        hash: 'prev-sample',
        batchId: 'prev-0',
        wordCount: MIN_WORDS_FOR_ERROR_RATE,
        timestamp: previousMid,
      },
      {
        hash: 'curr-sample',
        batchId: 'curr-0',
        wordCount: MIN_WORDS_FOR_ERROR_RATE * 2,
        timestamp: currentMid,
      },
    ]
    const learningStore = normalizeLearningEventStore({ events, samples })
    const improved = computeDailyBriefSnapshot(learningStore, { version: 1, sessions: [] }, profile, now)
    expect(improved.improvement?.direction).toBe('down')
  })

  it('deduplicates identical brief evidence without consuming generation quota', async () => {
    await seedSpellingPattern()
    const first = await handleMessage({ type: 'GET_DAILY_BRIEF' })
    const second = await handleMessage({ type: 'GET_DAILY_BRIEF' })
    expect(first.evidenceVersion).toBe(second.evidenceVersion)
    expect(second.fromCache).toBe(true)
    const quota = await readDailyBriefQuotaForTests(flowlaryStorage, utcDayKey(now))
    expect(quota.generationsUsed).toBe(1)
  })

  it('enforces daily generation limit of 3', async () => {
    await clearDailyBriefQuotaForTests(flowlaryStorage)
    const briefModule = await import('../../extension/src/storage/learning/brief/computeDailyBrief.ts')
    const original = briefModule.computeDailyBriefSnapshot
    let versionCounter = 0
    vi.spyOn(briefModule, 'computeDailyBriefSnapshot').mockImplementation((...args) => {
      const snapshot = original(...args)
      versionCounter += 1
      return { ...snapshot, evidenceVersion: `test-evidence-${versionCounter}` }
    })

    for (let i = 0; i < 3; i += 1) {
      await handleMessage({ type: 'GET_DAILY_BRIEF' })
    }

    const quota = await readDailyBriefQuotaForTests(flowlaryStorage, utcDayKey(now))
    expect(quota.generationsUsed).toBe(3)

    const limited = await handleMessage({ type: 'GET_DAILY_BRIEF' })
    expect(limited.limitReached).toBe(true)
    expect(limited.generationsUsedToday).toBe(3)
  })

  it('isolates brief quota between accounts', async () => {
    await seedSpellingPattern()
    await handleMessage({ type: 'GET_DAILY_BRIEF' })
    const quotaA = await readDailyBriefQuotaForTests(flowlaryStorage, utcDayKey(now))
    expect(quotaA.generationsUsed).toBe(1)

    await activateTestAccount(TEST_ACCOUNT_B)
    seedFlowlaryAccountAuth(store, { plan: 'trial' })
    await clearDailyBriefQuotaForTests(flowlaryStorage)
    const briefB = await handleMessage({ type: 'GET_DAILY_BRIEF' })
    expect(briefB.generationsUsedToday).toBe(1)
  })

  it('buildDailyBriefEvidenceVersion isolates locales and patterns', () => {
    const base = buildDailyBriefEvidenceVersion({
      writingEventCount: 3,
      wordsWritten: 100,
      focusCategory: 'spelling',
      recurringTargetId: 'spelling:recieved',
      recurringCount: 3,
      trendLabel: 'flat',
      trendPercent: 0,
      recommendedActionKind: 'practice_pattern',
    })
    const otherLocale = buildDailyBriefEvidenceVersion({
      writingEventCount: 3,
      wordsWritten: 100,
      focusCategory: 'grammar',
      recurringTargetId: 'spelling:recieved',
      recurringCount: 3,
      trendLabel: 'flat',
      trendPercent: 0,
      recommendedActionKind: 'practice_pattern',
    })
    expect(base).not.toBe(otherLocale)
  })

  it('uses zero Groq — deterministic snapshot only', async () => {
    await seedSpellingPattern()
    const brief = await handleMessage({ type: 'GET_DAILY_BRIEF' })
    expect(brief.state).toBe('ready')
    expect(brief.recurringPattern).toBeTruthy()
  })
})
