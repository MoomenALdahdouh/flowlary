import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEYS } from '@flowlary/shared'
import { FieldSession } from '../../extension/src/core/session/FieldSession.ts'
import {
  DEFAULT_CORRECTION,
  DEFAULT_LAYOUT,
  DEFAULT_SETTINGS,
  DEFAULT_TRANSLATION,
  stateManager,
} from '../../extension/src/core/state/StateManager.ts'
import { applyUserWritingPolicy } from '../../extension/src/core/policy/writingPolicy.ts'
import { probeTranslationPipeline } from '../../extension/src/core/writeGate/probeTranslationPipeline.ts'
import { setPipelineTranslateFnForTests } from '../../extension/src/core/writeGate/pipelineTranslate.ts'
import { runFieldCycle } from '../../extension/src/core/writeGate/pipeline.ts'
import {
  bootstrapContentScriptAccount,
  resetContentScriptAccountListenerForTests,
} from '../../extension/src/content/accountBootstrap.ts'
import {
  flowlaryStorage,
  getCorrectionSettings,
  getSettings,
  getTranslationSettings,
  setSettings,
} from '../../extension/src/storage/index.ts'
import {
  clearTestAccountContext,
  TEST_ACCOUNT_A,
  activateTestAccount,
} from '../helpers/accountIsolation.ts'
import {
  createMockChromeStorageWithListeners,
  simulateAuthAccountAttach,
} from '../helpers/mockChromeStorageWithListeners.ts'
import { handleMessage, resetBackgroundStartupForTests } from '../../extension/src/background/index.ts'

const ARABIC = 'الرجاء إرسال الفاتورة اليوم. '

function textarea(value: string) {
  const ta = document.createElement('textarea')
  ta.value = value
  document.body.append(ta)
  return ta
}

async function persistPolicyArabicOn() {
  applyUserWritingPolicy({
    helpStyle: 'auto',
    fixWrongTyping: true,
    improveEnglish: true,
    arabicToEnglishMode: true,
    polishAfterTranslate: false,
  })
  await setSettings(flowlaryStorage, stateManager.settings)
}

async function flushStorageListeners() {
  await new Promise((resolve) => setTimeout(resolve, 0))
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('translation content-script lifecycle', () => {
  const store = createMockChromeStorageWithListeners()

  beforeEach(async () => {
    store.reset()
    store.install()
    resetContentScriptAccountListenerForTests()
    resetBackgroundStartupForTests()
    document.body.innerHTML = ''
    setPipelineTranslateFnForTests(async (text) => ({ ok: true, translation: `EN:${text.trim()}` }))
    stateManager.settings = { ...DEFAULT_SETTINGS, enabled: true, pausedUntil: null, excludedDomains: [] }
    stateManager.correction = { ...DEFAULT_CORRECTION, consentAccepted: true }
    stateManager.translation = { ...DEFAULT_TRANSLATION }
    stateManager.layout = { ...DEFAULT_LAYOUT, autoEnabled: true }
    await clearTestAccountContext()
  })

  afterEach(() => {
    setPipelineTranslateFnForTests(null)
    vi.unstubAllGlobals()
  })

  it('CASE B: bootstrap after auth + policy in storage enables translation probe', async () => {
    await persistPolicyArabicOn()
    await simulateAuthAccountAttach(store, TEST_ACCOUNT_A)
    await bootstrapContentScriptAccount()

    const ta = textarea(ARABIC)
    const session = new FieldSession(ta)
    const probe = probeTranslationPipeline(ta, session)

    expect(probe.policy.arabicToEnglishMode).toBe(true)
    expect(probe.context.arabicToEnglishMode).toBe(true)
    expect(probe.context.translationSessionId).toBeTruthy()
    expect(probe.hypotheses.some((item) => item.intent === 'translate')).toBe(true)
    expect(probe.decision.action).toBe('translation')

    const outcome = await runFieldCycle(ta, session)
    expect(outcome).toBe('applied')
    expect(ta.value).toMatch(/EN:/)
  })

  it('CASE A: anonymous bootstrap then auth attach propagates translation policy without reload', async () => {
    await bootstrapContentScriptAccount()
    const ta = textarea(ARABIC)
    const session = new FieldSession(ta)

    let probe = probeTranslationPipeline(ta, session)
    expect(probe.policy.arabicToEnglishMode).toBe(false)
    expect(probe.decision.action).not.toBe('translation')

    await persistPolicyArabicOn()
    await simulateAuthAccountAttach(store, TEST_ACCOUNT_A)
    await flushStorageListeners()

    probe = probeTranslationPipeline(ta, session)
    expect(probe.policy.arabicToEnglishMode).toBe(true)
    expect(probe.context.arabicToEnglishMode).toBe(true)
    expect(probe.context.translationSessionId).toBeTruthy()
    expect(probe.hypotheses.some((item) => item.intent === 'translate')).toBe(true)
    expect(probe.decision.action).toBe('translation')

    const outcome = await runFieldCycle(ta, session)
    expect(outcome).toBe('applied')
    expect(ta.value).toMatch(/EN:/)
  })

  it('settings change after anonymous bootstrap propagates without auth change', async () => {
    await bootstrapContentScriptAccount()
    const ta = textarea(ARABIC)
    const session = new FieldSession(ta)

    expect(probeTranslationPipeline(ta, session).policy.arabicToEnglishMode).toBe(false)

    await persistPolicyArabicOn()
    await store.setLocal({
      [STORAGE_KEYS.settings]: {
        ...stateManager.settings,
        arabicToEnglishMode: true,
        helpStyle: 'auto',
        _v: 1,
      },
    })
    await flushStorageListeners()

    const probe = probeTranslationPipeline(ta, session)
    expect(probe.policy.arabicToEnglishMode).toBe(true)
    expect(probe.decision.action).toBe('translation')
  })

  it('CASE B reload: fresh bootstrap after auth + policy already in storage', async () => {
    await handleMessage({
      type: 'SET_SETTINGS',
      patch: { enabled: true, arabicToEnglishMode: true, helpStyle: 'auto', fixWrongTyping: true },
    })
    await handleMessage({
      type: 'SET_TRANSLATION',
      patch: { liveEnabled: true, mode: 'direct', sourceLanguage: 'ar', targetLanguage: 'en' },
    })
    await activateTestAccount(TEST_ACCOUNT_A)

    resetContentScriptAccountListenerForTests()
    await bootstrapContentScriptAccount()

    const ta = textarea(ARABIC)
    const session = new FieldSession(ta)
    const probe = probeTranslationPipeline(ta, session)
    expect(probe.policy.arabicToEnglishMode).toBe(true)
    expect(probe.decision.action).toBe('translation')
  })

  it('production verify order: pre-auth SET_SETTINGS then register hydrates translation in content script', async () => {
    await handleMessage({
      type: 'SET_CORRECTION',
      patch: { consentAccepted: true },
    })
    await handleMessage({
      type: 'SET_SETTINGS',
      patch: { enabled: true, arabicToEnglishMode: true, helpStyle: 'auto', fixWrongTyping: true },
    })
    await handleMessage({
      type: 'SET_TRANSLATION',
      patch: {
        liveEnabled: true,
        shortcutEnabled: true,
        mode: 'direct',
        sourceLanguage: 'ar',
        targetLanguage: 'en',
      },
    })

    const globalSettings = await getSettings(flowlaryStorage)
    expect(globalSettings.arabicToEnglishMode).toBe(true)
    expect(globalSettings.helpStyle).toBe('auto')
    expect(stateManager.correction.consentAccepted).toBe(true)
    expect(stateManager.translation.liveEnabled).toBe(true)

    await activateTestAccount(TEST_ACCOUNT_A)

    const accountTranslation = await getTranslationSettings(flowlaryStorage)
    const accountCorrection = await getCorrectionSettings(flowlaryStorage)
    expect(accountTranslation.liveEnabled).toBe(true)
    expect(accountCorrection.consentAccepted).toBe(true)

    resetContentScriptAccountListenerForTests()
    await bootstrapContentScriptAccount()

    const ta = textarea(ARABIC)
    const session = new FieldSession(ta)
    const probe = probeTranslationPipeline(ta, session)
    expect(probe.policy.arabicToEnglishMode).toBe(true)
    expect(probe.policy.helpStyle).toBe('auto')
    expect(probe.policy.fixWrongTyping).toBe(true)
    expect(probe.context.arabicToEnglishMode).toBe(true)
    expect(probe.context.translationSessionId).toBeTruthy()
    expect(probe.hypotheses.some((item) => item.intent === 'translate')).toBe(true)
    expect(probe.decision.action).toBe('translation')
  })

  it('anonymous user stays fail-closed for translation', async () => {
    await bootstrapContentScriptAccount()
    const ta = textarea(ARABIC)
    const session = new FieldSession(ta)
    const probe = probeTranslationPipeline(ta, session)
    expect(probe.policy.arabicToEnglishMode).toBe(false)
    expect(probe.hypotheses.some((item) => item.intent === 'translate')).toBe(false)
    expect(probe.decision.action).not.toBe('translation')
  })
})
