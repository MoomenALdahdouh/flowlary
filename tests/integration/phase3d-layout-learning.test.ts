import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InputEngine } from '../../extension/src/core/input/InputEngine.ts'
import { createLayoutFeature } from '../../extension/src/features/layout/LayoutFeature.ts'
import { applyLayoutFix } from '../../extension/src/features/layout/fixCurrentText.ts'
import { LayoutScheduler } from '../../extension/src/features/layout/scheduler.ts'
import { createLayoutCache } from '../../extension/src/features/layout/cache/LayoutCache.ts'
import { LayoutClassifier } from '../../extension/src/features/layout/classifier/LayoutClassifier.ts'
import { createLayoutMetrics } from '../../extension/src/features/layout/metrics.ts'
import { stateManager } from '../../extension/src/core/state/StateManager.ts'
import {
  activateTestAccount,
  clearTestAccountContext,
  TEST_ACCOUNT_A,
  TEST_ACCOUNT_B,
} from '../helpers/accountIsolation.ts'
import { createMockChromeStorage } from '../helpers/mockChromeStorage.ts'
import {
  bootstrapContentScriptAccount,
  resetContentScriptAccountListenerForTests,
} from '../../extension/src/content/accountBootstrap.ts'
import {
  flowlaryStorage,
  getHistory,
  resetHistoryServiceForTests,
  resetLearningEventServiceForTests,
  serializeFlowlaryExport,
} from '../../extension/src/storage/index.ts'
import { getLearningEventService } from '../../extension/src/storage/learning/events/index.ts'
import { sanitizeLearningEvent } from '../../extension/src/storage/learning/events/validation.ts'
import { computePracticeRecommendation } from '../../extension/src/storage/learning/practice/recommendation.ts'
import { computeProgressMetrics, countErrorsByType } from '../../extension/src/storage/learning/progress.ts'
import { recordLayoutLearningAccepted } from '../../extension/src/features/learning/recordLayoutLearning.ts'
import { recordCorrectionAccepted } from '../../extension/src/features/learning/recordCorrectionLearning.ts'
import { handleMessage, resetBackgroundStartupForTests } from '../../extension/src/background/index.ts'
import { createMemoryCacheCoordinator } from '@flowlary/shared'
import type { FieldFix } from '../../extension/src/features/layout/layouts/index.ts'

describe('Phase 3D — layout learning', () => {
  const store = createMockChromeStorage()

  beforeEach(async () => {
    store.reset()
    store.install()
    resetContentScriptAccountListenerForTests()
    resetBackgroundStartupForTests()
    resetHistoryServiceForTests()
    resetLearningEventServiceForTests()
    await clearTestAccountContext()
    document.body.innerHTML = ''

    stateManager.settings.enabled = true
    stateManager.settings.excludedDomains = []
    stateManager.layout.autoEnabled = true
    stateManager.layout.directShortcutEnabled = true
    stateManager.layout.sourceLayout = 'en-US-qwerty'
    stateManager.layout.targetLayouts = ['ar-101', 'ru-standard']
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  async function withAccount(accountId = TEST_ACCOUNT_A): Promise<void> {
    await activateTestAccount(accountId)
    await bootstrapContentScriptAccount()
  }

  it('TEST 1: manual FIX_LAYOUT creates history and layout learning event', async () => {
    await withAccount()
    const engine = new InputEngine()
    const layout = createLayoutFeature({ engine })
    layout.start()

    const ta = document.createElement('textarea')
    ta.value = 'lvpfh'
    document.body.append(ta)
    ta.focus()
    const session = engine.sessions.getOrCreate(ta)
    const acquire = session.tryAcquireWrite('FIX_LAYOUT')
    expect(acquire.ok).toBe(true)
    if (!acquire.ok) return

    const result = await layout.execute({
      type: 'FIX_LAYOUT',
      field: session.field,
      text: ta.value,
      generation: acquire.generation,
      requestId: acquire.requestId,
    })

    expect(result.ok).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 20))

    const events = await getLearningEventService(flowlaryStorage).getEvents()
    expect(events).toHaveLength(1)
    expect(events[0]?.category).toBe('layout')
    expect(events[0]?.action).toBe('accepted')
    expect(events[0]?.original).toBe('lvpfh')
    expect(events[0]?.corrected).toBe('مرحبا')

    const history = await getHistory(flowlaryStorage)
    expect(history.some((entry) => entry.operation === 'FIX_LAYOUT')).toBe(true)

    layout.stop()
    engine.stop()
  })

  it('TEST 2: retired scheduler does not auto-write', async () => {
    await withAccount()
    const engine = new InputEngine()
    const metrics = createLayoutMetrics()
    const cache = createLayoutCache(createMemoryCacheCoordinator())
    const classifier = new LayoutClassifier({ cache, metrics })
    const layout = createLayoutFeature({ engine })
    const scheduler = new LayoutScheduler({
      engine,
      classifier,
      metrics,
      getProfile: () => layout.getProfile(),
      getExceptions: () => layout.getProfileState().personalExceptions,
      getSpeedBox: () => layout.getSpeedBox(),
    })

    engine.start()
    scheduler.start()

    const ta = document.createElement('textarea')
    ta.value = 'lvpfh '
    document.body.append(ta)
    ta.focus()
    ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    ta.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }))

    await new Promise((resolve) => setTimeout(resolve, 20))

    const events = await getLearningEventService(flowlaryStorage).getEvents()
    expect(events).toHaveLength(0)

    const history = await getHistory(flowlaryStorage)
    expect(history.some((entry) => entry.operation === 'FIX_LAYOUT')).toBe(false)

    scheduler.stop()
    layout.stop()
    engine.stop()
  })

  it('TEST 3: applyLayoutFix automatic path does not emit learning', async () => {
    await withAccount()
    const engine = new InputEngine()
    engine.start()
    const ta = document.createElement('textarea')
    ta.value = 'hello lvpfh world'
    document.body.append(ta)
    const session = engine.sessions.getOrCreate(ta)
    const fix: FieldFix = {
      start: 6,
      end: 11,
      word: 'lvpfh',
      corrected: 'مرحبا',
      sourceLayout: 'en-US-qwerty',
      targetLayout: 'ar-101',
    }

    const applied = applyLayoutFix(ta, session, fix, session.getGeneration(), 1, {
      historyMode: 'automatic',
      sampleText: ta.value,
      learningBatchId: 'layout-manual-should-not-fire',
    })

    expect(applied).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 20))
    const events = await getLearningEventService(flowlaryStorage).getEvents()
    expect(events).toHaveLength(0)
    engine.stop()
  })

  it('TEST 4: learning event stores correct original/corrected tokens', async () => {
    await withAccount()
    recordLayoutLearningAccepted('batch-layout-1', 'typing ghbdtn here', 'ghbdtn', 'привет')
    await new Promise((resolve) => setTimeout(resolve, 20))
    const events = await getLearningEventService(flowlaryStorage).getEvents()
    expect(events[0]?.original).toBe('ghbdtn')
    expect(events[0]?.corrected).toBe('привет')
  })

  it('TEST 7: failed layout write does not emit learning', async () => {
    await withAccount()
    const engine = new InputEngine()
    engine.start()
    const ta = document.createElement('textarea')
    ta.value = 'hello'
    document.body.append(ta)
    const session = engine.sessions.getOrCreate(ta)
    const fix: FieldFix = {
      start: 0,
      end: 5,
      word: 'hello',
      corrected: 'world',
      sourceLayout: 'en-US-qwerty',
      targetLayout: 'ar-101',
    }

    const applied = applyLayoutFix(ta, session, fix, 999, 1, {
      historyMode: 'manual',
      sampleText: 'hello',
      learningBatchId: 'layout-manual-stale',
    })

    expect(applied).toBe(false)
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(await getLearningEventService(flowlaryStorage).getEvents()).toHaveLength(0)
    engine.stop()
  })

  it('TEST 8/9: account isolation for layout learning', async () => {
    await withAccount(TEST_ACCOUNT_A)
    recordLayoutLearningAccepted('batch-a', 'hello lvpfh', 'lvpfh', 'مرحبا')
    await new Promise((resolve) => setTimeout(resolve, 20))

    await activateTestAccount(TEST_ACCOUNT_B)
    await bootstrapContentScriptAccount()
    const eventsB = await getLearningEventService(flowlaryStorage).getEvents()
    expect(eventsB).toHaveLength(0)

    await activateTestAccount(TEST_ACCOUNT_A)
    const eventsA = await getLearningEventService(flowlaryStorage).getEvents()
    expect(eventsA).toHaveLength(1)
  })

  it('TEST 11: repeated layout token increments recurring pattern count', async () => {
    await withAccount()
    recordLayoutLearningAccepted('batch-1', 'hello lvpfh', 'lvpfh', 'مرحبا')
    recordLayoutLearningAccepted('batch-2', 'again lvpfh', 'lvpfh', 'مرحبا')
    await new Promise((resolve) => setTimeout(resolve, 20))

    const eventStore = await getLearningEventService(flowlaryStorage).getStore()
    const metrics = computeProgressMetrics(eventStore)
    const layoutPattern = metrics.recurringPatterns.find((item) => item.category === 'layout')
    expect(layoutPattern?.count).toBeGreaterThanOrEqual(2)
  })

  it('TEST 12/13: progress byType includes layout counts', async () => {
    await withAccount()
    recordLayoutLearningAccepted('batch-layout', 'hello lvpfh', 'lvpfh', 'مرحبا')
    recordCorrectionAccepted('spell-1', 'I recieved mail today', {
      originalText: 'I recieved mail today',
      correctedText: 'I received mail today',
      changes: [
        {
          type: 'spelling',
          original: 'recieved',
          corrected: 'received',
          start: 2,
          end: 10,
        },
      ],
    })
    await new Promise((resolve) => setTimeout(resolve, 20))

    const eventStore = await getLearningEventService(flowlaryStorage).getStore()
    const byType = countErrorsByType(eventStore.events)
    expect(byType.layout).toBe(1)
    expect(byType.spelling).toBe(1)

    const progress = await handleMessage({ type: 'GET_PROGRESS' })
    if (progress && 'byType' in progress) {
      expect(progress.byType.layout).toBe(1)
      expect(progress.errorCount).toBe(2)
    }
  })

  it('TEST 16: practice recommendation ignores layout events', async () => {
    await withAccount()
    recordLayoutLearningAccepted('batch-layout', 'hello lvpfh', 'lvpfh', 'مرحبا')
    recordLayoutLearningAccepted('batch-layout-2', 'again lvpfh', 'lvpfh', 'مرحبا')
    recordLayoutLearningAccepted('batch-layout-3', 'more lvpfh', 'lvpfh', 'مرحبا')
    await new Promise((resolve) => setTimeout(resolve, 20))

    const events = await getLearningEventService(flowlaryStorage).getEvents()
    const recommendation = computePracticeRecommendation(events)
    expect(recommendation.focus).not.toBe('layout')
  })

  it('TEST 18/19: import/export accepts layout and rejects unknown categories', async () => {
    await withAccount()
    recordLayoutLearningAccepted('batch-layout', 'hello lvpfh', 'lvpfh', 'مرحبا')
    await new Promise((resolve) => setTimeout(resolve, 20))

    const json = await serializeFlowlaryExport(flowlaryStorage)
    const parsed = JSON.parse(json) as {
      data?: { learningEvents?: { events?: Array<{ category?: string }> } }
    }
    expect(parsed.data?.learningEvents?.events?.[0]?.category).toBe('layout')

    const accepted = sanitizeLearningEvent({
      id: 'evt-layout',
      batchId: 'b1',
      category: 'layout',
      original: 'lvpfh',
      corrected: 'مرحبا',
      action: 'accepted',
      sampleHash: 'abc',
      sampleWordCount: 2,
      normalizedOriginal: 'lvpfh',
      normalizedCorrected: 'مرحبا',
      source: 'writing',
      timestamp: Date.now(),
      version: 1,
    })
    expect(accepted?.category).toBe('layout')

    expect(
      sanitizeLearningEvent({
        id: 'evt-bad',
        batchId: 'b1',
        category: 'keyboard',
        original: 'a',
        corrected: 'b',
        action: 'accepted',
        sampleHash: 'abc',
        sampleWordCount: 1,
        normalizedOriginal: 'a',
        normalizedCorrected: 'b',
        source: 'writing',
        timestamp: Date.now(),
        version: 1,
      }),
    ).toBeNull()
  })
})
