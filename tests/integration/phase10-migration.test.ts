import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEYS } from '@flowlary/shared'
import { resetBackgroundStartupForTests } from '../../extension/src/background/index.ts'
import { stateManager, DEFAULT_CORRECTION, DEFAULT_TRANSLATION } from '../../extension/src/core/state/StateManager.ts'
import { FlowlaryStorage, flowlaryStorage } from '../../extension/src/storage/index.ts'
import {
  getCorrectionSettings,
  getEntitlement,
  getLayoutProfile,
  getMigrationState,
  getSettings,
  getTranslationSettings,
} from '../../extension/src/storage/facade.ts'
import { LEGACY_EWA, LEGACY_LAYFIX, LEGACY_LINGO } from '../../extension/src/storage/legacyKeys.ts'
import {
  getMigrationDiagnostics,
  resetMigrationRunnerForTests,
  runStorageMigration,
} from '../../extension/src/storage/migration/runner.ts'
import { hydrateStateFromStorage } from '../../extension/src/storage/hydrate.ts'
import { createMockChromeStorage } from '../helpers/mockChromeStorage.ts'
import { activateTestAccount, clearTestAccountContext } from '../helpers/accountIsolation.ts'

describe('Phase 10 — storage schemas', () => {
  it('isolates namespaces', () => {
    expect(STORAGE_KEYS.correctionGroqKey).toBe('flowlary.correction.groqKey')
    expect(STORAGE_KEYS.layoutProfile).toBe('flowlary.layout.profile')
    expect(STORAGE_KEYS.entitlementLicenseKey).toBe('flowlary.entitlement.licenseKey')
  })
})

describe('Phase 10 — migration scenarios', () => {
  let mockStore: ReturnType<typeof createMockChromeStorage>

  beforeEach(async () => {
    mockStore = createMockChromeStorage()
    mockStore.install()
    resetMigrationRunnerForTests()
    await clearTestAccountContext()
    Object.assign(stateManager.settings, { enabled: true, pausedUntil: null, excludedDomains: [], version: 1 })
    Object.assign(stateManager.correction, DEFAULT_CORRECTION)
    Object.assign(stateManager.translation, DEFAULT_TRANSLATION)
  })

  /** Migration still writes unscoped keys; claim into an account to read via product APIs. */
  async function claimMigratedData() {
    await activateTestAccount()
  }

  afterEach(() => {
    resetMigrationRunnerForTests()
    resetBackgroundStartupForTests()
    vi.stubGlobal('chrome', {
      runtime: {
        onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
        onInstalled: { addListener: vi.fn() },
        sendMessage: vi.fn(),
      },
      commands: { onCommand: { addListener: vi.fn() } },
      tabs: {
        query: vi.fn().mockResolvedValue([]),
        sendMessage: vi.fn().mockResolvedValue(undefined),
      },
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({}),
          set: vi.fn().mockResolvedValue(undefined),
          remove: vi.fn().mockResolvedValue(undefined),
        },
        sync: {
          get: vi.fn().mockResolvedValue({}),
          set: vi.fn().mockResolvedValue(undefined),
          remove: vi.fn().mockResolvedValue(undefined),
        },
      },
    })
  })

  it('A — fresh install completes without legacy data', async () => {
    const result = await runStorageMigration()
    expect(result.state.status).toBe('COMPLETE')
    const migration = await getMigrationState(flowlaryStorage)
    expect(migration.completedSteps.length).toBeGreaterThan(0)
    expect(migration.cleanupEligible).toBe(true)
  })

  it('B — EWA settings migrate into correction namespace', async () => {
    mockStore.sync[LEGACY_EWA.settings] = {
      enabled: false,
      highlights: false,
      correctionMode: 'box',
      consentAccepted: true,
    }
    mockStore.local[LEGACY_EWA.groqApiKey] = 'gsk_secret_key_never_log'

    await runStorageMigration()
    await claimMigratedData()
    const correction = await getCorrectionSettings(flowlaryStorage)
    expect(correction.enabled).toBe(false)
    expect(correction.mode).toBe('box')
    expect(correction.consentAccepted).toBe(true)
    expect(correction).not.toHaveProperty('groqApiKey')
    expect(correction).not.toHaveProperty('aiProvider')

    const report = (await getMigrationDiagnostics()).report
    expect(report).not.toContain('gsk_secret_key_never_log')
    expect(mockStore.local[LEGACY_EWA.groqApiKey]).toBe('gsk_secret_key_never_log')
  })

  it('C — Lingo profile migrates translation settings', async () => {
    mockStore.local[LEGACY_LINGO.profile] = {
      enabled: true,
      shortcutEnabled: true,
      liveEnabled: true,
      sourceLanguage: 'fr',
      targetLanguage: 'en',
      excludedDomains: ['example.com'],
      pausedUntil: 0,
    }

    await runStorageMigration()
    await claimMigratedData()
    const translation = await getTranslationSettings(flowlaryStorage)
    expect(translation.sourceLanguage).toBe('fr')
    expect(translation.targetLanguage).toBe('en')
    expect(translation.liveEnabled).toBe(true)

    const settings = await getSettings(flowlaryStorage)
    expect(settings.excludedDomains).toContain('example.com')
  })

  it('D — Layfix profile migrates layout + exceptions', async () => {
    mockStore.local[LEGACY_LAYFIX.profile] = {
      enabled: true,
      manualConversionEnabled: false,
      directShortcutEnabled: true,
      sourceLayout: 'en-US-qwerty',
      enabledLayouts: ['en-US-qwerty', 'ar-101'],
      personalExceptions: ['GitHub', 'OAuth'],
      excludedDomains: [],
      pausedUntil: 0,
    }

    await runStorageMigration()
    await claimMigratedData()
    const profile = await getLayoutProfile(flowlaryStorage)
    expect(profile.personalExceptions).toEqual(['GitHub', 'OAuth'])
    expect(profile.layoutProfile.sourceLayout).toBe('en-US-qwerty')
  })

  it('E — all three legacy products unify', async () => {
    mockStore.sync[LEGACY_EWA.settings] = { enabled: true, correctionMode: 'direct', consentAccepted: true }
    mockStore.local[LEGACY_EWA.groqApiKey] = 'gsk_combo'
    mockStore.local[LEGACY_LINGO.profile] = { sourceLanguage: 'de', targetLanguage: 'en', liveEnabled: false }
    mockStore.local[LEGACY_LAYFIX.profile] = {
      sourceLayout: 'en-US-qwerty',
      enabledLayouts: ['en-US-qwerty', 'ar-101'],
      personalExceptions: ['npm'],
    }

    await runStorageMigration()
    await claimMigratedData()
    const correction = await getCorrectionSettings(flowlaryStorage)
    const translation = await getTranslationSettings(flowlaryStorage)
    const profile = await getLayoutProfile(flowlaryStorage)
    expect(correction).not.toHaveProperty('groqApiKey')
    expect(correction).not.toHaveProperty('aiProvider')
    expect(translation.sourceLanguage).toBe('de')
    expect(profile.personalExceptions).toContain('npm')
  })

  it('F — partial migration resumes successfully', async () => {
    mockStore.sync[LEGACY_EWA.settings] = { enabled: true, correctionMode: 'direct' }
    mockStore.local[STORAGE_KEYS.migrations] = {
      _v: 1,
      version: 1,
      status: 'PARTIAL',
      startedAt: Date.now(),
      completedAt: null,
      lockAcquiredAt: null,
      completedSteps: ['ewa_correction', 'ewa_groq_key'],
      failedSteps: ['lingo_translation'],
      verifiedSteps: ['ewa_correction', 'ewa_groq_key'],
      cleanupEligible: false,
    }
    mockStore.local[LEGACY_LINGO.profile] = { sourceLanguage: 'es', targetLanguage: 'en' }

    await runStorageMigration()
    await claimMigratedData()
    const translation = await getTranslationSettings(flowlaryStorage)
    expect(translation.sourceLanguage).toBe('es')
    const state = await getMigrationState(flowlaryStorage)
    expect(state.failedSteps).toEqual([])
    expect(state.status).toBe('COMPLETE')
  })

  it('G — existing Flowlary settings win over legacy', async () => {
    mockStore.local[STORAGE_KEYS.translation] = {
      _v: 1,
      liveEnabled: false,
      shortcutEnabled: true,
      sourceLanguage: 'ja',
      targetLanguage: 'en',
    }
    mockStore.local[LEGACY_LINGO.profile] = { sourceLanguage: 'fr', targetLanguage: 'en' }

    await runStorageMigration()
    await claimMigratedData()
    const translation = await getTranslationSettings(flowlaryStorage)
    expect(translation.sourceLanguage).toBe('ja')
  })

  it('H — malformed legacy data does not crash migration', async () => {
    mockStore.sync[LEGACY_EWA.settings] = 'not-an-object'
    mockStore.local[LEGACY_LINGO.profile] = ['bad']
    mockStore.local[LEGACY_LAYFIX.profile] = 42

    const result = await runStorageMigration()
    expect(['COMPLETE', 'PARTIAL', 'VERIFIED']).toContain(result.state.status)
  })

  it('I — Groq key migrates without appearing in diagnostics', async () => {
    mockStore.local[LEGACY_EWA.groqApiKey] = 'gsk_leak_test_key'
    const logs: string[] = []
    const spy = vi.spyOn(console, 'info').mockImplementation((...args) => {
      logs.push(args.join(' '))
    })

    await runStorageMigration()
    const combined = logs.join('\n') + (await getMigrationDiagnostics()).report
    expect(combined).not.toContain('gsk_leak_test_key')
    spy.mockRestore()
  })

  it('J — legacy entitlement maps to unified entitlement', async () => {
    mockStore.local[LEGACY_LINGO.usage] = {
      version: 1,
      firstActivatedAt: Date.now() - 86400000,
      trialEndsAt: Date.now() + 86400000 * 6,
      usageBalanceMs: 120000,
      lastUsageUpdateAt: Date.now() - 86400000,
      lastActivityAt: 0,
      lastRefillAt: Date.now() - 86400000,
    }
    mockStore.local[LEGACY_LINGO.licenseCache] = {
      valid: true,
      status: 'active',
      verifiedAt: Date.now() - 1000,
    }
    mockStore.sync[LEGACY_LINGO.licenseKey] = 'lsq_test_license'

    await runStorageMigration()
    const entitlement = await getEntitlement(flowlaryStorage)
    expect(entitlement.product).toBe('FLOWLARY')
    expect(entitlement.license.migratedFrom).toBe('lingo')
  })

  it('idempotency — running migration twice does not duplicate history', async () => {
    mockStore.local[LEGACY_EWA.history] = [{ id: '1', timestamp: 1, original: 'a', corrected: 'b' }]
    await runStorageMigration()
    await resetMigrationRunnerForTests()
    mockStore.local[STORAGE_KEYS.migrations] = {
      ...(await getMigrationState(flowlaryStorage)),
      status: 'NOT_STARTED',
      lockAcquiredAt: null,
    }
    await runStorageMigration()
    const history = mockStore.local[STORAGE_KEYS.history] as { ewa?: unknown[] }
    expect(history?.ewa?.length).toBe(1)
  })

  it('hydrates state manager after migration', async () => {
    mockStore.local[LEGACY_EWA.groqApiKey] = 'gsk_hydrate'
    mockStore.sync[LEGACY_EWA.settings] = { enabled: true, correctionMode: 'direct', consentAccepted: true }
    await runStorageMigration()
    await claimMigratedData()
    await hydrateStateFromStorage(flowlaryStorage)
    expect(stateManager.correction).not.toHaveProperty('groqApiKey')
    expect(stateManager.correction).not.toHaveProperty('aiProvider')
    expect(stateManager.correction.mode).toBe('direct')
  })

  it('wordCacheV2 remains untouched (Option B)', async () => {
    mockStore.local[LEGACY_LAYFIX.wordCache] = { entries: [{ word: 'test' }] }
    await runStorageMigration()
    expect(mockStore.local[LEGACY_LAYFIX.wordCache]).toEqual({ entries: [{ word: 'test' }] })
    expect(mockStore.local[LEGACY_LAYFIX.wordCache]).toBeDefined()
  })

  it('FlowlaryStorage setPrimitive round-trips strings', async () => {
    const storage = new FlowlaryStorage()
    await storage.setPrimitive(STORAGE_KEYS.correctionGroqKey, 'gsk_roundtrip', 'local')
    const value = await storage.get<string>(STORAGE_KEYS.correctionGroqKey, 'local')
    expect(value).toBe('gsk_roundtrip')
  })
})
