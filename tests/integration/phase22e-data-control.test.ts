import { beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEYS } from '@flowlary/shared'
import { createMockChromeStorage } from '../helpers/mockChromeStorage.ts'
import {
  flowlaryStorage,
  resetLearningEventServiceForTests,
  resetPracticeSessionStoreForTests,
  serializeFlowlaryExport,
  exportContainsSecrets,
  computeDataSummary,
  importUserData,
  parseExportJson,
  resetLocalFlowlaryData,
} from '../../extension/src/storage/index.ts'
import { recordLearningEvents } from '../../extension/src/storage/learning/events/index.ts'
import { getLearningEventService } from '../../extension/src/storage/learning/events/index.ts'
import { getPracticeSessionStore } from '../../extension/src/storage/learning/practice/sessions.ts'
import { getLearningProfile, setLearningProfile } from '../../extension/src/storage/learning/index.ts'
import { createDefaultLearningProfile } from '@flowlary/shared'
import { handleMessage, resetBackgroundStartupForTests } from '../../extension/src/background/index.ts'
import { retireByokIfNeeded } from '../../extension/src/storage/retireByok.ts'
import { getUnifiedHistoryStore } from '../../extension/src/storage/facade.ts'
import { activateTestAccount, clearTestAccountContext, TEST_ACCOUNT_A } from '../helpers/accountIsolation.ts'
import { buildAccountScopedKey } from '../../extension/src/storage/accountScopedStorage.ts'

describe('Phase 22E — data control', () => {
  const store = createMockChromeStorage()

  beforeEach(async () => {
    store.reset()
    store.install()
    resetBackgroundStartupForTests()
    resetLearningEventServiceForTests()
    resetPracticeSessionStoreForTests()
    await clearTestAccountContext()
    await activateTestAccount()
    const handler = vi.fn(async (message: { type: string }) => handleMessage(message))
    const chromeGlobal = globalThis as {
      chrome: { runtime: { sendMessage: typeof handler } }
    }
    chromeGlobal.chrome.runtime.sendMessage = handler
  })

  async function seedDomains() {
    const profile = createDefaultLearningProfile(Date.now())
    profile.onboardingCompleted = true
    profile.level = 'intermediate'
    await setLearningProfile(flowlaryStorage, profile)

    await recordLearningEvents(
      flowlaryStorage,
      Array.from({ length: 20 }, (_, index) => ({
        batchId: `b-${index}`,
        sampleText: `I recieve email number ${index} today.`,
        sampleWordCount: 6,
        category: 'spelling' as const,
        original: 'recieve',
        corrected: 'receive',
        action: 'accepted' as const,
        source: 'writing' as const,
      })),
    )
    await new Promise((resolve) => setTimeout(resolve, 30))

    await handleMessage({
      type: 'SAVE_PRACTICE_SESSION',
      session: {
        id: 'ps-1',
        version: 1,
        startedAt: Date.now() - 1000,
        completedAt: Date.now(),
        focus: 'spelling',
        itemsAttempted: 5,
        itemsCompleted: 5,
        correctionsDetected: 1,
        correctionsAccepted: 1,
        correctionsRejected: 0,
        wordsWritten: 40,
        status: 'completed',
      },
    })

    store.local[buildAccountScopedKey(TEST_ACCOUNT_A, 'history')] = {
      version: 1,
      entries: Array.from({ length: 10 }, (_, index) => ({
        id: `h-${index}`,
        operation: 'CORRECT',
        timestamp: Date.now() - index,
        sourceText: 'hello',
        resultText: 'Hello',
      })),
      _v: 1,
    }
  }

  it('critical: export excludes secrets and legacy groq key', async () => {
    store.local[STORAGE_KEYS.correctionGroqKey] = 'gsk_secret_never_export'
    store.local[STORAGE_KEYS.authAccessToken] = 'access_secret'
    store.local[STORAGE_KEYS.authRefreshToken] = 'refresh_secret'
    store.local[STORAGE_KEYS.authInstallToken] = 'install_secret'

    const json = await serializeFlowlaryExport(flowlaryStorage)
    expect(exportContainsSecrets(json)).toBe(false)
    expect(json).not.toContain('gsk_secret_never_export')
    expect(json).not.toContain('access_secret')
    expect(json).not.toContain('refresh_secret')
    expect(json).not.toContain('install_secret')
    expect(json).not.toContain('flowlary.correction.groqKey')
  })

  it('critical: clear activity preserves learning and profile', async () => {
    await seedDomains()
    await handleMessage({ type: 'CLEAR_HISTORY' })

    const summary = await computeDataSummary(flowlaryStorage)
    expect(summary.activityCount).toBe(0)
    expect(summary.learningEventCount).toBe(20)
    expect(summary.practiceSessionCount).toBe(1)
    expect(summary.profileConfigured).toBe(true)
  })

  it('critical: clear learning preserves activity and profile', async () => {
    await seedDomains()
    await handleMessage({ type: 'CLEAR_LEARNING_EVENTS' })

    const summary = await computeDataSummary(flowlaryStorage)
    expect(summary.activityCount).toBe(10)
    expect(summary.learningEventCount).toBe(0)
    expect(summary.practiceSessionCount).toBe(0)
    expect(summary.profileConfigured).toBe(true)
  })

  it('reset profile preserves learning events', async () => {
    await seedDomains()
    await handleMessage({ type: 'RESET_LEARNING_PROFILE' })

    const profile = await getLearningProfile(flowlaryStorage)
    expect(profile.onboardingCompleted).toBe(false)
    const events = await getLearningEventService(flowlaryStorage).getEvents()
    expect(events.length).toBe(20)
  })

  it('import merges without duplicate ids', async () => {
    await seedDomains()
    const exported = await serializeFlowlaryExport(flowlaryStorage)
    const payload = parseExportJson(exported)
    const result = await importUserData(flowlaryStorage, payload, { replaceProfile: false })
    expect(result.activityAdded).toBe(0)
    expect(result.learningEventsAdded).toBe(0)
    expect(result.practiceSessionsAdded).toBe(0)
  })

  it('full reset removes local product data', async () => {
    await seedDomains()
    await resetLocalFlowlaryData(flowlaryStorage)

    const summary = await computeDataSummary(flowlaryStorage)
    expect(summary.activityCount).toBe(0)
    expect(summary.learningEventCount).toBe(0)
    expect(summary.practiceSessionCount).toBe(0)

    const history = await getUnifiedHistoryStore(flowlaryStorage)
    expect(history.entries).toHaveLength(0)
  })

  it('retireByokIfNeeded removes legacy groq key after export path', async () => {
    store.local[STORAGE_KEYS.correctionGroqKey] = 'gsk_secret_never_log'
    await retireByokIfNeeded(flowlaryStorage)
    expect(store.local[STORAGE_KEYS.correctionGroqKey]).toBeUndefined()
  })

  it('rejects unsupported import version', () => {
    expect(() =>
      parseExportJson(JSON.stringify({ schemaVersion: 99, product: 'flowlary', data: {} })),
    ).toThrow('unsupported_version')
  })
})
