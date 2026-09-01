import { beforeEach, describe, expect, it } from 'vitest'
import { STORAGE_KEYS } from '@flowlary/shared'
import { createDefaultLearningProfile } from '@flowlary/shared'
import { createMockChromeStorage } from '../../helpers/mockChromeStorage.ts'
import {
  buildLearningRuntimeView,
  ensureLearningProfile,
  getLearningProfile,
  normalizeLearningProfile,
  patchLearningProfile,
  resetLearningProfile,
  setLearningInstallKind,
  getLearningInstallMeta,
} from '../../../extension/src/storage/learning/index.ts'
import { flowlaryStorage } from '../../../extension/src/storage/index.ts'
import { resetBackgroundStartupForTests, handleMessage } from '../../../extension/src/background/index.ts'

describe('LearningProfile storage', () => {
  const store = createMockChromeStorage()

  beforeEach(async () => {
    store.reset()
    store.install()
    resetBackgroundStartupForTests()
  })

  it('creates defaults for missing storage', async () => {
    const profile = await ensureLearningProfile(flowlaryStorage)
    expect(profile.learningLanguage).toBe('en')
    expect(profile.focusAreas).toEqual(['grammar', 'spelling'])
    expect(profile.onboardingCompleted).toBe(false)
    expect(profile.version).toBe(1)
  })

  it('reads and updates profile', async () => {
    await ensureLearningProfile(flowlaryStorage)
    const updated = await patchLearningProfile(flowlaryStorage, {
      level: 'intermediate',
      focusAreas: ['wording', 'grammar'],
      nativeLanguage: 'ar',
    })
    expect(updated.level).toBe('intermediate')
    expect(updated.focusAreas).toEqual(['wording', 'grammar'])
    expect(updated.nativeLanguage).toBe('ar')

    const loaded = await getLearningProfile(flowlaryStorage)
    expect(loaded.level).toBe('intermediate')
  })

  it('resets profile without touching unrelated namespaces', async () => {
    store.local[STORAGE_KEYS.translation] = { sourceLanguage: 'ar', targetLanguage: 'en', _v: 1 }
    store.local[STORAGE_KEYS.history] = { entries: [], _v: 1 }
    await ensureLearningProfile(flowlaryStorage)
    await patchLearningProfile(flowlaryStorage, { onboardingCompleted: true, level: 'advanced' })

    const reset = await resetLearningProfile(flowlaryStorage)
    expect(reset.onboardingCompleted).toBe(false)
    expect(reset.level).toBeUndefined()
    expect(store.local[STORAGE_KEYS.translation]).toBeTruthy()
    expect(store.local[STORAGE_KEYS.history]).toBeTruthy()
  })

  it('handles malformed profile safely', () => {
    const normalized = normalizeLearningProfile({
      version: 'bad',
      focusAreas: ['grammar', 'invalid', 'spelling'],
      level: 'expert',
      onboardingCompleted: 'yes',
    })
    expect(normalized.focusAreas).toEqual(['grammar', 'spelling'])
    expect(normalized.level).toBeUndefined()
    expect(normalized.onboardingCompleted).toBe(false)
  })

  it('marks fresh installs for full onboarding', async () => {
    await setLearningInstallKind(flowlaryStorage, 'fresh')
    const profile = createDefaultLearningProfile()
    const view = buildLearningRuntimeView(profile, await getLearningInstallMeta(flowlaryStorage))
    expect(view.showFullOnboarding).toBe(true)
    expect(view.showSetupPrompt).toBe(false)
  })

  it('shows setup prompt for existing users without forcing onboarding', async () => {
    store.local[STORAGE_KEYS.correction] = { consentAccepted: true, _v: 1 }
    await setLearningInstallKind(flowlaryStorage, 'existing')
    const profile = await ensureLearningProfile(flowlaryStorage)
    const view = buildLearningRuntimeView(profile, await getLearningInstallMeta(flowlaryStorage))
    expect(view.showFullOnboarding).toBe(false)
    expect(view.showSetupPrompt).toBe(true)
    expect(profile.onboardingStep).toBeNull()
  })

  it('persists onboarding step through background messages', async () => {
    await setLearningInstallKind(flowlaryStorage, 'fresh')
    await ensureLearningProfile(flowlaryStorage)
    const response = await handleMessage({ type: 'SET_ONBOARDING_STEP', step: 'learning' })
    expect(response && 'profile' in response).toBe(true)
    if (response && 'profile' in response) {
      expect(response.profile.onboardingStep).toBe('learning')
    }
  })
})
