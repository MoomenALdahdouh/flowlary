import { beforeEach, describe, expect, it } from 'vitest'
import { STORAGE_KEYS, createDefaultLearningProfile } from '@flowlary/shared'
import { createMockChromeStorage } from '../helpers/mockChromeStorage.ts'

const store = createMockChromeStorage()
store.install()

import {
  TEST_ACCOUNT_A,
  TEST_ACCOUNT_B,
  activateTestAccount,
  clearTestAccountContext,
} from '../helpers/accountIsolation.ts'
import {
  activeAccountContext,
  attachActiveAccount,
  buildAccountScopedKey,
  captureWriteGuard,
  clearHistory,
  detachActiveAccount,
  flowlaryStorage,
  getCorrectionSettings,
  getLearningProfile,
  getUnifiedHistoryStore,
  importUserData,
  maybeClaimLegacyAccountData,
  parseExportJson,
  readIsolationMeta,
  recordLearningEvents,
  resetHistoryServiceForTests,
  resetLearningEventServiceForTests,
  resetPracticeSessionStoreForTests,
  serializeFlowlaryExport,
  setCorrectionSettings,
  setLearningProfile,
  getAccountScopedStorage,
  assertWriteGuard,
} from '../../extension/src/storage/index.ts'
import { getLearningEventService } from '../../extension/src/storage/learning/events/index.ts'
import { getPracticeSessionStore } from '../../extension/src/storage/learning/practice/sessions.ts'
import { getHistoryService } from '../../extension/src/storage/history/service.ts'

describe('Phase 32A — account isolation', () => {
  beforeEach(async () => {
    store.reset()
    store.install()
    resetHistoryServiceForTests()
    resetLearningEventServiceForTests()
    resetPracticeSessionStoreForTests()
    await clearTestAccountContext()
  })

  it('Test 1 — A logout then B sees none of A data', async () => {
    await activateTestAccount(TEST_ACCOUNT_A)
    await setLearningProfile(flowlaryStorage, {
      ...createDefaultLearningProfile(),
      level: 'advanced',
      onboardingCompleted: true,
      focusAreas: ['grammar'],
    })
    await setCorrectionSettings(flowlaryStorage, {
      enabled: true,
      mode: 'box',
      highlights: false,
      consentAccepted: true,
    })
    await recordLearningEvents(flowlaryStorage, [
      {
        batchId: 'a1',
        sampleText: 'I recieve mail',
        sampleWordCount: 3,
        category: 'spelling',
        original: 'recieve',
        corrected: 'receive',
        action: 'accepted',
      },
    ])

    await detachActiveAccount(flowlaryStorage)
    expect(activeAccountContext.getAccountId()).toBeNull()
    expect((await getLearningProfile(flowlaryStorage)).onboardingCompleted).toBe(false)
    expect((await getCorrectionSettings(flowlaryStorage)).consentAccepted).toBe(false)
    expect(await getLearningEventService(flowlaryStorage).getEvents()).toEqual([])

    await activateTestAccount(TEST_ACCOUNT_B)
    const profileB = await getLearningProfile(flowlaryStorage)
    expect(profileB.onboardingCompleted).toBe(false)
    expect(profileB.level).toBeUndefined()
    expect((await getCorrectionSettings(flowlaryStorage)).consentAccepted).toBe(false)
    expect(await getLearningEventService(flowlaryStorage).getEvents()).toEqual([])
  })

  it('Test 2 — B then A restores A only', async () => {
    await activateTestAccount(TEST_ACCOUNT_A)
    await setLearningProfile(flowlaryStorage, {
      ...createDefaultLearningProfile(),
      level: 'intermediate',
      onboardingCompleted: true,
    })
    await detachActiveAccount(flowlaryStorage)

    await activateTestAccount(TEST_ACCOUNT_B)
    await setLearningProfile(flowlaryStorage, {
      ...createDefaultLearningProfile(),
      level: 'beginner',
      onboardingCompleted: true,
    })
    await detachActiveAccount(flowlaryStorage)

    await activateTestAccount(TEST_ACCOUNT_A)
    const profile = await getLearningProfile(flowlaryStorage)
    expect(profile.level).toBe('intermediate')
  })

  it('Test 3 — async write from A discarded after switch to B', async () => {
    await activateTestAccount(TEST_ACCOUNT_A)
    const guardA = captureWriteGuard()
    await detachActiveAccount(flowlaryStorage)
    await activateTestAccount(TEST_ACCOUNT_B)
    expect(assertWriteGuard(guardA)).toBe(false)
    const ok = await getAccountScopedStorage(flowlaryStorage).set(
      'learningProfile',
      { version: 1, poisoned: true } as unknown as Record<string, unknown>,
      guardA,
    )
    expect(ok).toBe(false)
    const raw = store.local[buildAccountScopedKey(TEST_ACCOUNT_B, 'learningProfile')]
    expect(raw).toBeUndefined()
  })

  it('Test 4 — onboarding not inherited', async () => {
    await activateTestAccount(TEST_ACCOUNT_A)
    await setLearningProfile(flowlaryStorage, {
      ...createDefaultLearningProfile(),
      onboardingCompleted: true,
      onboardingStep: null,
      level: 'advanced',
    })
    await detachActiveAccount(flowlaryStorage)
    await activateTestAccount(TEST_ACCOUNT_B)
    const b = await getLearningProfile(flowlaryStorage)
    expect(b.onboardingCompleted).toBe(false)
  })

  it('Test 5 — clear activity only affects active account', async () => {
    await activateTestAccount(TEST_ACCOUNT_A)
    const history = getHistoryService(flowlaryStorage)
    // Seed via scoped storage directly for deterministic entries
    await getAccountScopedStorage(flowlaryStorage).set('history', {
      version: 1,
      entries: [
        {
          id: 'a-entry',
          operation: 'CORRECT',
          timestamp: Date.now(),
          domain: 'example.com',
          fieldKind: 'textarea',
          sourceText: 'teh',
          resultText: 'the',
        },
      ],
      legacyImported: true,
      _v: 1,
    })
    await detachActiveAccount(flowlaryStorage)

    await activateTestAccount(TEST_ACCOUNT_B)
    await getAccountScopedStorage(flowlaryStorage).set('history', {
      version: 1,
      entries: [
        {
          id: 'b-entry',
          operation: 'TRANSLATE',
          timestamp: Date.now(),
          domain: 'example.com',
          fieldKind: 'textarea',
          sourceText: 'hola',
          resultText: 'hello',
        },
      ],
      legacyImported: true,
      _v: 1,
    })
    await clearHistory(flowlaryStorage)
    expect((await getUnifiedHistoryStore(flowlaryStorage)).entries).toEqual([])

    await activateTestAccount(TEST_ACCOUNT_A)
    const aStore = await getUnifiedHistoryStore(flowlaryStorage)
    expect(aStore.entries.some((e) => e.id === 'a-entry')).toBe(true)
  })

  it('Test 6 — learning reset scoped', async () => {
    await activateTestAccount(TEST_ACCOUNT_A)
    await recordLearningEvents(flowlaryStorage, [
      {
        batchId: 'a',
        sampleText: 'I recieve',
        sampleWordCount: 2,
        category: 'spelling',
        original: 'recieve',
        corrected: 'receive',
        action: 'accepted',
      },
    ])
    await detachActiveAccount(flowlaryStorage)

    await activateTestAccount(TEST_ACCOUNT_B)
    await recordLearningEvents(flowlaryStorage, [
      {
        batchId: 'b',
        sampleText: 'I goeed',
        sampleWordCount: 2,
        category: 'grammar',
        original: 'goeed',
        corrected: 'went',
        action: 'accepted',
      },
    ])
    await getLearningEventService(flowlaryStorage).clearEvents()
    expect(await getLearningEventService(flowlaryStorage).getEvents()).toEqual([])

    await activateTestAccount(TEST_ACCOUNT_A)
    expect((await getLearningEventService(flowlaryStorage).getEvents()).length).toBeGreaterThan(0)
  })

  it('Test 7 — export only active account', async () => {
    await activateTestAccount(TEST_ACCOUNT_A)
    await setLearningProfile(flowlaryStorage, {
      ...createDefaultLearningProfile(),
      level: 'advanced',
      onboardingCompleted: true,
    })
    const json = await serializeFlowlaryExport(flowlaryStorage)
    expect(json).toContain('advanced')
    expect(json).not.toContain(TEST_ACCOUNT_A)
    expect(json).not.toContain(STORAGE_KEYS.authAccessToken)
  })

  it('Test 8 — import becomes B-owned only', async () => {
    await activateTestAccount(TEST_ACCOUNT_A)
    await setLearningProfile(flowlaryStorage, {
      ...createDefaultLearningProfile(),
      level: 'advanced',
      onboardingCompleted: true,
    })
    const exported = await serializeFlowlaryExport(flowlaryStorage)
    await detachActiveAccount(flowlaryStorage)

    await activateTestAccount(TEST_ACCOUNT_B)
    const payload = parseExportJson(exported)
    await importUserData(flowlaryStorage, payload, { replaceProfile: true })
    expect((await getLearningProfile(flowlaryStorage)).level).toBe('advanced')

    await activateTestAccount(TEST_ACCOUNT_A)
    // A unchanged by B import
    expect((await getLearningProfile(flowlaryStorage)).level).toBe('advanced')
  })

  it('Test 9 — generation race rejects stale commit', async () => {
    await activateTestAccount(TEST_ACCOUNT_A)
    const guard = captureWriteGuard()
    activeAccountContext.activate(TEST_ACCOUNT_A) // bump generation, same id
    expect(assertWriteGuard(guard)).toBe(false)
  })

  it('Test 10 — no account fail closed', async () => {
    await clearTestAccountContext()
    expect(await getLearningEventService(flowlaryStorage).getEvents()).toEqual([])
    const added = await recordLearningEvents(flowlaryStorage, [
      {
        batchId: 'x',
        sampleText: 'I recieve',
        sampleWordCount: 2,
        category: 'spelling',
        original: 'recieve',
        corrected: 'receive',
        action: 'accepted',
      },
    ])
    expect(added).toBe(0)
    await expect(serializeFlowlaryExport(flowlaryStorage)).rejects.toThrow('account_required')
  })

  it('Test 11 — re-login restores account namespace', async () => {
    await activateTestAccount(TEST_ACCOUNT_A)
    await setCorrectionSettings(flowlaryStorage, {
      enabled: true,
      mode: 'direct',
      highlights: true,
      consentAccepted: true,
    })
    await detachActiveAccount(flowlaryStorage)
    await attachActiveAccount(flowlaryStorage, TEST_ACCOUNT_A)
    expect((await getCorrectionSettings(flowlaryStorage)).consentAccepted).toBe(true)
  })

  it('Test 12 — A→B→A→B isolation', async () => {
    await activateTestAccount(TEST_ACCOUNT_A)
    await setLearningProfile(flowlaryStorage, {
      ...createDefaultLearningProfile(),
      nativeLanguage: 'ar',
      onboardingCompleted: true,
    })
    await activateTestAccount(TEST_ACCOUNT_B)
    await setLearningProfile(flowlaryStorage, {
      ...createDefaultLearningProfile(),
      nativeLanguage: 'tr',
      onboardingCompleted: true,
    })
    await activateTestAccount(TEST_ACCOUNT_A)
    expect((await getLearningProfile(flowlaryStorage)).nativeLanguage).toBe('ar')
    await activateTestAccount(TEST_ACCOUNT_B)
    expect((await getLearningProfile(flowlaryStorage)).nativeLanguage).toBe('tr')
  })

  it('legacy claim-once — second account does not inherit', async () => {
    await flowlaryStorage.set(STORAGE_KEYS.learningProfile, {
      ...createDefaultLearningProfile(),
      level: 'advanced',
      onboardingCompleted: true,
    } as unknown as Record<string, unknown>)

    await activateTestAccount(TEST_ACCOUNT_A)
    expect((await getLearningProfile(flowlaryStorage)).level).toBe('advanced')
    const meta = await readIsolationMeta(flowlaryStorage)
    expect(meta.legacyClaimedByAccountId).toBe(TEST_ACCOUNT_A)

    await activateTestAccount(TEST_ACCOUNT_B)
    expect((await getLearningProfile(flowlaryStorage)).level).toBeUndefined()
    expect(await maybeClaimLegacyAccountData(flowlaryStorage, TEST_ACCOUNT_B)).toBe('already_claimed')
  })

  it('practice sessions isolated', async () => {
    await activateTestAccount(TEST_ACCOUNT_A)
    await getPracticeSessionStore(flowlaryStorage).saveSession({
      id: 'ps-a',
      version: 1,
      startedAt: Date.now(),
      completedAt: Date.now(),
      focus: 'grammar',
      itemsAttempted: 1,
      itemsCompleted: 1,
      correctionsDetected: 0,
      correctionsAccepted: 0,
      correctionsRejected: 0,
      wordsWritten: 5,
      status: 'completed',
    })
    await activateTestAccount(TEST_ACCOUNT_B)
    expect(await getPracticeSessionStore(flowlaryStorage).list()).toEqual([])
    await activateTestAccount(TEST_ACCOUNT_A)
    expect((await getPracticeSessionStore(flowlaryStorage).list())[0]?.id).toBe('ps-a')
  })
})
