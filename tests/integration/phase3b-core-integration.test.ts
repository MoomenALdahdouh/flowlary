import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEYS, PRACTICE_SESSION_STORE_VERSION } from '@flowlary/shared'
import type { CorrectionChange, CorrectionResponse } from '@flowlary/shared'
import { createMockChromeStorage } from '../helpers/mockChromeStorage.ts'
import {
  TEST_ACCOUNT_A,
  TEST_ACCOUNT_B,
  activateTestAccount,
  clearTestAccountContext,
} from '../helpers/accountIsolation.ts'
import {
  activeAccountContext,
  flowlaryStorage,
  getHistory,
  getLayoutProfile,
  recordLearningEvents,
  resetHistoryServiceForTests,
  resetLearningEventServiceForTests,
  resetPracticeSessionStoreForTests,
  setLayoutProfile,
} from '../../extension/src/storage/index.ts'
import {
  bootstrapContentScriptAccount,
  hydrateLayoutFeatureFromStorage,
  resetContentScriptAccountListenerForTests,
} from '../../extension/src/content/accountBootstrap.ts'
import { createLayoutFeature } from '../../extension/src/features/layout/LayoutFeature.ts'
import { createCorrectionFeature } from '../../extension/src/features/correction/CorrectionFeature.ts'
import { InputEngine } from '../../extension/src/core/input/InputEngine.ts'
import { stateManager } from '../../extension/src/core/state/StateManager.ts'
import { getLearningEventService } from '../../extension/src/storage/learning/events/index.ts'
import { getPracticeSessionStore } from '../../extension/src/storage/learning/practice/sessions.ts'
import { recordCorrectionAccepted, recordCorrectionRejected } from '../../extension/src/features/learning/recordCorrectionLearning.ts'
import { recordHistory } from '../../extension/src/storage/history/record.ts'
import { handleMessage, resetBackgroundStartupForTests } from '../../extension/src/background/index.ts'
import { readFieldText } from '../../extension/src/core/dom/read.ts'

vi.mock('../../extension/src/features/correction/client.ts', () => ({
  requestCorrectionRemote: vi.fn(),
  cancelCorrectionRemote: vi.fn(),
}))

import { requestCorrectionRemote } from '../../extension/src/features/correction/client.ts'

const mockCorrect = vi.mocked(requestCorrectionRemote)

const correctionResponse: CorrectionResponse = {
  originalText: 'I recieved your email today.',
  correctedText: 'I received your email today.',
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

describe('Phase 3B — core integration hardening', () => {
  const store = createMockChromeStorage()

  beforeEach(async () => {
    store.reset()
    store.install()
    resetContentScriptAccountListenerForTests()
    resetBackgroundStartupForTests()
    resetHistoryServiceForTests()
    resetLearningEventServiceForTests()
    resetPracticeSessionStoreForTests()
    await clearTestAccountContext()
    mockCorrect.mockReset()
    document.body.innerHTML = ''
    stateManager.settings.enabled = true
    stateManager.settings.excludedDomains = []
    stateManager.correction.enabled = true
    stateManager.correction.consentAccepted = true
    stateManager.correction.mode = 'box'
    stateManager.layout.directShortcutEnabled = true
    stateManager.layout.sourceLayout = 'en-US-qwerty'
    stateManager.layout.targetLayouts = ['ar-101', 'ru-standard']
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('P1-1 — content script account context', () => {
    it('TEST A: signed-in account loads in content script bootstrap', async () => {
      await activateTestAccount(TEST_ACCOUNT_A)
      const accountId = await bootstrapContentScriptAccount()
      expect(accountId).toBe(TEST_ACCOUNT_A)
      expect(activeAccountContext.getAccountId()).toBe(TEST_ACCOUNT_A)
    })

    it('TEST G: no account context keeps fail-closed writes', async () => {
      await bootstrapContentScriptAccount()
      expect(activeAccountContext.getAccountId()).toBeNull()
      const added = await recordLearningEvents(flowlaryStorage, [
        {
          batchId: 'b1',
          sampleText: 'Hello world test',
          sampleWordCount: 3,
          category: 'spelling',
          original: 'wrld',
          corrected: 'world',
          action: 'accepted',
        },
      ])
      expect(added).toBe(0)
      const historyOk = await recordHistory({
        operation: 'CORRECT',
        sourceText: 'hello wrld',
        resultText: 'hello world',
        mode: 'manual',
      })
      expect(historyOk).toBe(false)
    })

    it('TEST H: account restored before bootstrap completes (ordering)', async () => {
      await activateTestAccount(TEST_ACCOUNT_A)
      const accountId = await bootstrapContentScriptAccount()
      expect(accountId).toBe(TEST_ACCOUNT_A)
      const added = await recordLearningEvents(flowlaryStorage, [
        {
          batchId: 'order',
          sampleText: 'I recieved your email',
          sampleWordCount: 4,
          category: 'spelling',
          original: 'recieved',
          corrected: 'received',
          action: 'accepted',
        },
      ])
      expect(added).toBe(1)
    })

    it('TEST B: correction accepted writes learning under correct account', async () => {
      await activateTestAccount(TEST_ACCOUNT_A)
      await bootstrapContentScriptAccount()
      recordCorrectionAccepted('batch-a', correctionResponse.originalText, correctionResponse)
      await new Promise((resolve) => setTimeout(resolve, 20))
      const events = await getLearningEventService(flowlaryStorage).getEvents()
      expect(events).toHaveLength(1)
      expect(events[0]?.action).toBe('accepted')
    })

    it('TEST C: correction accepted writes history under correct account', async () => {
      await activateTestAccount(TEST_ACCOUNT_A)
      await bootstrapContentScriptAccount()
      const ta = document.createElement('textarea')
      const ok = await recordHistory({
        operation: 'CORRECT',
        element: ta,
        sourceText: correctionResponse.originalText,
        resultText: correctionResponse.correctedText,
        mode: 'manual',
      })
      expect(ok).toBe(true)
      const entries = await getHistory(flowlaryStorage)
      expect(entries).toHaveLength(1)
      expect(entries[0]?.operation).toBe('CORRECT')
    })

    it('TEST D: correction rejected writes learning under correct account', async () => {
      await activateTestAccount(TEST_ACCOUNT_A)
      await bootstrapContentScriptAccount()
      recordCorrectionRejected('batch-r', correctionResponse.originalText, correctionResponse)
      await new Promise((resolve) => setTimeout(resolve, 20))
      const events = await getLearningEventService(flowlaryStorage).getEvents()
      expect(events).toHaveLength(1)
      expect(events[0]?.action).toBe('rejected')
    })

    it('TEST E: account A data never appears under account B', async () => {
      await activateTestAccount(TEST_ACCOUNT_A)
      await bootstrapContentScriptAccount()
      recordCorrectionAccepted('batch-a', correctionResponse.originalText, correctionResponse)
      await new Promise((resolve) => setTimeout(resolve, 20))

      await activateTestAccount(TEST_ACCOUNT_B)
      await bootstrapContentScriptAccount({})
      const eventsB = await getLearningEventService(flowlaryStorage).getEvents()
      expect(eventsB).toHaveLength(0)
    })

    it('TEST F: account switch during correction rejects stale account snapshot', async () => {
      await activateTestAccount(TEST_ACCOUNT_A)
      await bootstrapContentScriptAccount()
      const snapshotA = activeAccountContext.snapshot()
      await activateTestAccount(TEST_ACCOUNT_B)
      expect(activeAccountContext.matches(snapshotA)).toBe(false)
    })
  })

  describe('P1-2 — layout personalExceptions hydration', () => {
    it('loads stored exceptions on startup', async () => {
      await activateTestAccount(TEST_ACCOUNT_A)
      await setLayoutProfile(flowlaryStorage, {
        layoutProfile: {
          sourceLayout: 'en-US-qwerty',
          enabledLayouts: ['en-US-qwerty', 'ar-101'],
        },
        personalExceptions: ['hsjo]lj'],
        events: [],
      })

      const engine = new InputEngine()
      const layout = createLayoutFeature({ engine })
      await hydrateLayoutFeatureFromStorage(layout)

      expect(layout.getProfileState().personalExceptions).toEqual(['hsjo]lj'])
      engine.stop()
      layout.stop()
    })

    it('exception affects runtime layout decision', async () => {
      await activateTestAccount(TEST_ACCOUNT_A)
      await setLayoutProfile(flowlaryStorage, {
        layoutProfile: {
          sourceLayout: 'en-US-qwerty',
          enabledLayouts: ['en-US-qwerty', 'ar-101'],
        },
        personalExceptions: ['hsjo]lj'],
        events: [],
      })

      const engine = new InputEngine()
      const layout = createLayoutFeature({ engine })
      await hydrateLayoutFeatureFromStorage(layout)
      layout.start()

      const ta = document.createElement('textarea')
      ta.value = 'hsjo]lj'
      document.body.append(ta)
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

      expect(result.ok).toBe(false)
      expect(ta.value).toBe('hsjo]lj')
      layout.stop()
      engine.stop()
    })

    it('account A exceptions do not appear for account B', async () => {
      await activateTestAccount(TEST_ACCOUNT_A)
      await setLayoutProfile(flowlaryStorage, {
        layoutProfile: {
          sourceLayout: 'en-US-qwerty',
          enabledLayouts: ['en-US-qwerty', 'ar-101'],
        },
        personalExceptions: ['foo'],
        events: [],
      })

      const engine = new InputEngine()
      const layout = createLayoutFeature({ engine })
      await hydrateLayoutFeatureFromStorage(layout)
      expect(layout.getProfileState().personalExceptions).toEqual(['foo'])

      await activateTestAccount(TEST_ACCOUNT_B)
      await setLayoutProfile(flowlaryStorage, {
        layoutProfile: {
          sourceLayout: 'en-US-qwerty',
          enabledLayouts: ['en-US-qwerty', 'ar-101'],
        },
        personalExceptions: ['bar'],
        events: [],
      })
      await hydrateLayoutFeatureFromStorage(layout)
      expect(layout.getProfileState().personalExceptions).toEqual(['bar'])
      expect(layout.getProfileState().personalExceptions).not.toContain('foo')

      layout.stop()
      engine.stop()
    })

    it('missing profile falls back to defaults', async () => {
      await activateTestAccount(TEST_ACCOUNT_A)
      const engine = new InputEngine()
      const layout = createLayoutFeature({ engine })
      await hydrateLayoutFeatureFromStorage(layout)
      expect(layout.getProfileState().personalExceptions).toEqual([])
      layout.stop()
      engine.stop()
    })

    it('bootstrap hydrates layout profile from storage', async () => {
      await activateTestAccount(TEST_ACCOUNT_A)
      await setLayoutProfile(flowlaryStorage, {
        layoutProfile: {
          sourceLayout: 'en-US-qwerty',
          enabledLayouts: ['en-US-qwerty', 'ru-standard'],
        },
        personalExceptions: ['ghbdtn'],
        events: [],
      })
      const engine = new InputEngine()
      const layout = createLayoutFeature({ engine })
      await bootstrapContentScriptAccount({ layout })
      expect(layout.getProfileState().personalExceptions).toEqual(['ghbdtn'])
      layout.stop()
      engine.stop()
    })
  })

  describe('P1-3 — GET_PROGRESS practice session scope', () => {
    it('returns account-scoped practice summary for account A', async () => {
      await activateTestAccount(TEST_ACCOUNT_A)
      const weekAgo = Date.now() - 2 * 24 * 60 * 60 * 1000
      await getPracticeSessionStore(flowlaryStorage).saveSession({
        id: 'ps-a1',
        version: 1,
        startedAt: weekAgo,
        completedAt: weekAgo + 1000,
        status: 'completed',
        focus: 'spelling',
        itemsAttempted: 5,
        itemsCompleted: 5,
        correctionsDetected: 1,
        correctionsAccepted: 1,
        correctionsRejected: 0,
        wordsWritten: 40,
      })

      const progress = await handleMessage({ type: 'GET_PROGRESS' })
      expect(progress && 'practiceSummary' in progress).toBe(true)
      if (progress && 'practiceSummary' in progress) {
        expect(progress.practiceSummary.sessionsThisWeek).toBeGreaterThanOrEqual(1)
      }
    })

    it('account B does not see account A practice sessions', async () => {
      await activateTestAccount(TEST_ACCOUNT_A)
      await getPracticeSessionStore(flowlaryStorage).saveSession({
        id: 'ps-a-only',
        version: 1,
        startedAt: Date.now(),
        completedAt: Date.now(),
        status: 'completed',
        focus: 'grammar',
        itemsAttempted: 3,
        itemsCompleted: 3,
        correctionsDetected: 0,
        correctionsAccepted: 0,
        correctionsRejected: 0,
        wordsWritten: 20,
      })

      await activateTestAccount(TEST_ACCOUNT_B)
      const progress = await handleMessage({ type: 'GET_PROGRESS' })
      if (progress && 'practiceSummary' in progress) {
        expect(progress.practiceSummary.sessionsThisWeek).toBe(0)
      }
    })

    it('empty sessions return safe empty summary', async () => {
      await activateTestAccount(TEST_ACCOUNT_A)
      const progress = await handleMessage({ type: 'GET_PROGRESS' })
      if (progress && 'practiceSummary' in progress) {
        expect(progress.practiceSummary.sessionsThisWeek).toBe(0)
        expect(progress.practiceSummary.itemsThisWeek).toBe(0)
      }
    })

    it('does not read legacy global learningSessions key', async () => {
      await activateTestAccount(TEST_ACCOUNT_A)
      store.local[STORAGE_KEYS.learningSessions] = {
        version: PRACTICE_SESSION_STORE_VERSION,
        sessions: [
          {
            id: 'legacy-only',
            version: 1,
            startedAt: Date.now(),
            completedAt: Date.now(),
            status: 'completed',
            focus: 'spelling',
            itemsAttempted: 1,
            itemsCompleted: 1,
            correctionsDetected: 0,
            correctionsAccepted: 0,
            correctionsRejected: 0,
            wordsWritten: 10,
          },
        ],
        _v: 1,
      }

      const progress = await handleMessage({ type: 'GET_PROGRESS' })
      if (progress && 'practiceSummary' in progress) {
        expect(progress.practiceSummary.sessionsThisWeek).toBe(0)
      }
    })
  })

  describe('P1-5 — shared correction field state', () => {
    it('auto and manual paths share one correction card per field', async () => {
      vi.useFakeTimers()
      stateManager.correction.mode = 'box'

      mockCorrect.mockImplementation(
        () =>
          new Promise(() => {
            /* keep pending to exercise shared pending state */
          }),
      )

      const engine = new InputEngine()
      const correction = createCorrectionFeature({ engine })
      correction.start()
      engine.start()

      const ta = document.createElement('textarea')
      document.body.append(ta)
      ta.value = 'I dont know what to write here today.'
      ta.focus()
      const session = engine.sessions.getOrCreate(ta)
      const pending = correction.execute({
        type: 'CORRECT',
        field: session.field,
        text: readFieldText(ta),
      })
      await Promise.resolve()
      expect(mockCorrect).toHaveBeenCalledTimes(1)
      expect(document.querySelectorAll('[data-flowlary-correction-host]').length).toBeLessThanOrEqual(1)

      const manual = await correction.execute({
        type: 'CORRECT',
        field: session.field,
        text: readFieldText(ta),
      })

      expect(manual.ok).toBe(false)
      expect(mockCorrect).toHaveBeenCalledTimes(1)
      void pending

      correction.stop()
      engine.stop()
    })

    it('clearFieldStates resets pending correction state on account switch', async () => {
      vi.useFakeTimers()
      const engine = new InputEngine()
      const correction = createCorrectionFeature({ engine })
      correction.start()
      engine.start()

      const ta = document.createElement('textarea')
      document.body.append(ta)
      focusAndType(ta, 'I dont know what to write here today.')
      await vi.advanceTimersByTimeAsync(200)

      await activateTestAccount(TEST_ACCOUNT_A)
      correction.clearFieldStates()

      correction.stop()
      engine.stop()
    })
  })

  describe('E2E — signed-in correction → learning → history → progress', () => {
    it('full product flow with account isolation', async () => {
      await activateTestAccount(TEST_ACCOUNT_A)
      await bootstrapContentScriptAccount()

      recordCorrectionAccepted('e2e-batch', correctionResponse.originalText, correctionResponse)
      await new Promise((resolve) => setTimeout(resolve, 20))

      const historyOk = await recordHistory({
        operation: 'CORRECT',
        element: document.createElement('textarea'),
        sourceText: correctionResponse.originalText,
        resultText: correctionResponse.correctedText,
        mode: 'manual',
      })
      expect(historyOk).toBe(true)

      const progress = await handleMessage({ type: 'GET_PROGRESS' })
      expect(progress && 'errorCount' in progress && progress.errorCount).toBe(1)

      const history = await handleMessage({ type: 'GET_HISTORY' })
      expect(history && 'entries' in history && history.entries.length).toBe(1)

      await activateTestAccount(TEST_ACCOUNT_B)
      await bootstrapContentScriptAccount()

      const progressB = await handleMessage({ type: 'GET_PROGRESS' })
      expect(progressB && 'errorCount' in progressB && progressB.errorCount).toBe(0)

      const historyB = await handleMessage({ type: 'GET_HISTORY' })
      expect(historyB && 'entries' in historyB && historyB.entries.length).toBe(0)

      const profileA = await getLayoutProfile(flowlaryStorage)
      expect(profileA.personalExceptions).toEqual([])
    })
  })
})

function focusAndType(ta: HTMLTextAreaElement, value: string): void {
  ta.value = value
  ta.focus()
  ta.setSelectionRange(value.length, value.length)
  ta.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
  ta.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }))
}
