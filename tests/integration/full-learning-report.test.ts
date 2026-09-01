import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LearningEvent } from '@flowlary/shared'
import {
  createDefaultLearningProfile,
  FULL_REPORT_MAX_GENERATIONS_PER_DAY,
  MIN_WORDS_FOR_ERROR_RATE,
  STORAGE_KEYS,
  validateLearningReportNarration,
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
import {
  flowlaryStorage,
  getLearningEventService,
  resetLearningEventServiceForTests,
  resetPracticeSessionStoreForTests,
} from '../../extension/src/storage/index.ts'
import { recordLearningEvents } from '../../extension/src/storage/learning/events/index.ts'
import { handleMessage, resetBackgroundStartupForTests } from '../../extension/src/background/index.ts'
import { computeLearningAnalysisSnapshot } from '../../extension/src/storage/learning/report/computeLearningAnalysisSnapshot.ts'
import { buildDeterministicFullReportNarrative } from '../../extension/src/storage/learning/report/buildDeterministicReport.ts'
import {
  clearFullReportQuotaForTests,
  readFullReportQuotaForTests,
} from '../../extension/src/storage/learning/report/resolveFullLearningReport.ts'
import { normalizeLearningEventStore } from '../../extension/src/storage/learning/events/index.ts'
import { getLearningProfile } from '../../extension/src/storage/learning/index.ts'

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

async function seedRichHistory(now: number): Promise<void> {
  const batches = []
  for (let i = 0; i < 8; i++) {
    const original = i % 2 === 0 ? 'recieved' : 'he go'
    const corrected = i % 2 === 0 ? 'received' : 'he goes'
    batches.push({
      batchId: `w-${i}`,
      sampleText: `Sample ${i}: ${original} in context.`,
      sampleWordCount: MIN_WORDS_FOR_ERROR_RATE + 5,
      category: i % 3 === 0 ? 'grammar' : i % 3 === 1 ? 'spelling' : 'wording',
      original,
      corrected,
      action: 'accepted' as const,
      source: 'writing' as const,
      timestamp: now - i * 60_000,
    })
  }
  await recordLearningEvents(flowlaryStorage, batches)
  await recordLearningEvents(flowlaryStorage, [
    {
      batchId: 'layout-1',
      sampleText: 'layout typo',
      sampleWordCount: 20,
      category: 'layout',
      original: 'hello',
      corrected: 'hello',
      action: 'accepted',
      source: 'writing',
    },
    {
      batchId: 'translation-1',
      sampleText: 'translation sample',
      sampleWordCount: 20,
      category: 'wording',
      original: 'hello',
      corrected: 'hi',
      action: 'accepted',
      source: 'translation',
    },
  ])
}

describe('Full Learning Report', () => {
  const store = createMockChromeStorage()
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
    seedFlowlaryAccountAuth(store)
    await clearFullReportQuotaForTests(flowlaryStorage)
    const handler = vi.fn(async (message: { type: string }) => handleMessage(message))
    ;(globalThis as { chrome: { runtime: { sendMessage: typeof handler } } }).chrome.runtime.sendMessage =
      handler
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('signed-out users receive no personalized report', async () => {
    await clearTestAccountContext()
    const report = await handleMessage({ type: 'GET_FULL_LEARNING_REPORT' })
    expect(report.state).toBe('signed_out')
    expect(report.snapshot).toBeNull()
  })

  it('empty learner has no_data evidence quality', async () => {
    const report = await handleMessage({ type: 'GET_FULL_LEARNING_REPORT' })
    expect(report.state).toBe('no_data')
    expect(report.snapshot?.evidenceQuality).toBe('no_data')
    expect(report.narrative?.source).toBe('deterministic')
  })

  it('ready report includes writing metrics and recurring patterns', async () => {
    await seedRichHistory(now)
    const report = await handleMessage({ type: 'GET_FULL_LEARNING_REPORT' })
    expect(['partial', 'ready']).toContain(report.state)
    expect(report.snapshot?.activity.writingEventCount).toBeGreaterThan(0)
    expect(report.snapshot?.recurringPatterns.length).toBeGreaterThan(0)
    expect(report.narrative?.overview).toBeTruthy()
  })

  it('excludes layout and translation from English learning analysis', async () => {
    await seedRichHistory(now)
    const eventStore = await getLearningEventService(flowlaryStorage).getStore()
    const profile = await getLearningProfile(flowlaryStorage)
    const snapshot = computeLearningAnalysisSnapshot(eventStore, { version: 1, sessions: [] }, profile, now)
    expect(snapshot.recurringPatterns.every((p) => p.category !== 'layout')).toBe(true)
    expect(snapshot.categoryMetrics).not.toHaveProperty('layout')
  })

  it('cache hit does not increment daily quota', async () => {
    await seedRichHistory(now)
    const first = await handleMessage({ type: 'GET_FULL_LEARNING_REPORT' })
    const second = await handleMessage({ type: 'GET_FULL_LEARNING_REPORT' })
    expect(first.fromCache).toBe(false)
    expect(second.fromCache).toBe(true)
    const quota = await readFullReportQuotaForTests(flowlaryStorage, utcDayKey(now))
    expect(quota.generationsUsed).toBe(1)
  })

  it('enforces max one generation per day when evidence changes', async () => {
    await seedRichHistory(now)
    await handleMessage({ type: 'GET_FULL_LEARNING_REPORT' })
    await recordLearningEvents(flowlaryStorage, [
      {
        batchId: 'new-evidence',
        sampleText: 'she go today',
        sampleWordCount: 20,
        category: 'grammar',
        original: 'she go',
        corrected: 'she goes',
        action: 'accepted',
        source: 'writing',
      },
    ])
    const limited = await handleMessage({ type: 'GET_FULL_LEARNING_REPORT' })
    expect(limited.limitReached).toBe(true)
    const quota = await readFullReportQuotaForTests(flowlaryStorage, utcDayKey(now))
    expect(quota.generationsUsed).toBe(FULL_REPORT_MAX_GENERATIONS_PER_DAY)
  })

  it('account B cannot see account A cached report', async () => {
    await seedRichHistory(now)
    const reportA = await handleMessage({ type: 'GET_FULL_LEARNING_REPORT' })
    expect(reportA.snapshot?.activity.writingEventCount).toBeGreaterThan(0)

    await activateTestAccount(TEST_ACCOUNT_B)
    store.local[STORAGE_KEYS.authAccountId] = { value: TEST_ACCOUNT_B, _v: 1 }
    await clearFullReportQuotaForTests(flowlaryStorage)
    const reportB = await handleMessage({ type: 'GET_FULL_LEARNING_REPORT' })
    expect(reportB.state).toBe('no_data')
    expect(reportB.fromCache).toBe(false)
    expect(reportB.snapshot?.evidenceVersion).not.toBe(reportA.snapshot?.evidenceVersion)
  })

  it('deterministic narrative includes focus and practice recommendations', async () => {
    await seedRichHistory(now)
    const eventStore = await getLearningEventService(flowlaryStorage).getStore()
    const profile = await getLearningProfile(flowlaryStorage)
    const snapshot = computeLearningAnalysisSnapshot(eventStore, { version: 1, sessions: [] }, profile, now)
    const narrative = buildDeterministicFullReportNarrative(snapshot, 'en')
    expect(narrative.recommendations.length).toBeGreaterThan(0)
    expect(narrative.nextSteps.length).toBeGreaterThan(0)
  })

  it('rejects unsupported AI claims during validation', () => {
    const snapshot = computeLearningAnalysisSnapshot(
      normalizeLearningEventStore({ version: 1, events: [], samples: [] }),
      { version: 1, sessions: [] },
      createDefaultLearningProfile(),
      now,
    )
    const invalid = validateLearningReportNarration(
      {
        overview: 'You are CEFR B1 and weak at everything.',
        strengths: [],
        focusAreas: [],
        improvements: [],
        recommendations: [],
        nextSteps: [],
      },
      snapshot,
    )
    expect(invalid).toBeNull()
  })

  it('does not claim improvement without trend evidence', async () => {
    await seedRichHistory(now)
    const eventStore = await getLearningEventService(flowlaryStorage).getStore()
    const profile = await getLearningProfile(flowlaryStorage)
    const snapshot = computeLearningAnalysisSnapshot(eventStore, { version: 1, sessions: [] }, profile, now)
    const narrative = buildDeterministicFullReportNarrative(snapshot, 'en')
    if (snapshot.trend.label !== 'improved') {
      expect(narrative.improvements).toHaveLength(0)
    }
  })

  it('localizes deterministic narrative for Arabic locale', async () => {
    await seedRichHistory(now)
    const eventStore = await getLearningEventService(flowlaryStorage).getStore()
    const profile = await getLearningProfile(flowlaryStorage)
    const snapshot = computeLearningAnalysisSnapshot(eventStore, { version: 1, sessions: [] }, profile, now)
    const arNarrative = buildDeterministicFullReportNarrative(snapshot, 'ar')
    expect(arNarrative.overview).not.toBe(buildDeterministicFullReportNarrative(snapshot, 'en').overview)
  })

  it('Groq failure falls back to deterministic report', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 503 })),
    )
    await seedRichHistory(now)
    const report = await handleMessage({ type: 'GET_FULL_LEARNING_REPORT' })
    expect(report.narrative?.source).toBe('deterministic')
  })
})

describe('Full Learning Report — validation', () => {
  const now = Date.UTC(2026, 7, 27, 12, 0, 0)

  it('accepts AI output aligned with snapshot evidence', () => {
    const events = [
      writingEvent({
        batchId: 'a',
        timestamp: now,
        category: 'spelling',
        original: 'recieved',
        corrected: 'received',
      }),
      writingEvent({
        batchId: 'b',
        timestamp: now - 1000,
        category: 'spelling',
        original: 'recieved',
        corrected: 'received',
      }),
    ]
    const snapshot = computeLearningAnalysisSnapshot(
      normalizeLearningEventStore({ version: 1, events, samples: [] }),
      { version: 1, sessions: [] },
      createDefaultLearningProfile(),
      now,
    )
    const valid = validateLearningReportNarration(
      {
        overview: 'A recurring recieved → received spelling pattern appears in your writing.',
        strengths: ['No recurring wording pattern has been observed yet.'],
        focusAreas: ['Spelling appears among priority areas.'],
        improvements: [],
        recommendations: ['Review recieved → received.'],
        nextSteps: ['Keep writing naturally.'],
      },
      snapshot,
    )
    expect(valid).not.toBeNull()
  })
})
