import {
  createDefaultLearningProfile,
  DEFAULT_FOCUS_AREAS,
  DEFAULT_LEARNING_LANGUAGE,
  isLearningFocus,
  isLearningLevel,
  isOnboardingStep,
  LEARNING_PROFILE_VERSION,
  ONBOARDING_VERSION,
  type LearningFocus,
  type LearningInstallKind,
  type LearningInstallMeta,
  type LearningLevel,
  type LearningProfile,
  type OnboardingStep,
} from '@flowlary/shared'
import { STORAGE_KEYS } from '@flowlary/shared'
import type { FlowlaryStorage } from '../index.ts'
import { getAccountScopedStorage } from '../accountScopedStorage.ts'
import { activeAccountContext } from '../activeAccountContext.ts'
import { pushRemoteLearningProfile } from './events/remoteSync.ts'

export function normalizeLearningProfile(raw: unknown, now = Date.now()): LearningProfile {
  const defaults = createDefaultLearningProfile(now)
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return defaults
  }

  const value = raw as Partial<LearningProfile>
  const focusAreas = Array.isArray(value.focusAreas)
    ? value.focusAreas.filter(isLearningFocus)
    : defaults.focusAreas

  const level = isLearningLevel(value.level) ? value.level : undefined
  const nativeLanguage =
    typeof value.nativeLanguage === 'string' && value.nativeLanguage.trim()
      ? value.nativeLanguage.trim()
      : undefined

  const onboardingStep =
    value.onboardingStep === null
      ? null
      : isOnboardingStep(value.onboardingStep)
        ? value.onboardingStep
        : defaults.onboardingStep

  return {
    version: typeof value.version === 'number' ? value.version : LEARNING_PROFILE_VERSION,
    learningLanguage:
      typeof value.learningLanguage === 'string' && value.learningLanguage.trim()
        ? value.learningLanguage.trim()
        : DEFAULT_LEARNING_LANGUAGE,
    nativeLanguage,
    level,
    focusAreas: focusAreas.length > 0 ? focusAreas : [...DEFAULT_FOCUS_AREAS],
    onboardingCompleted: value.onboardingCompleted === true,
    onboardingVersion:
      typeof value.onboardingVersion === 'number' ? value.onboardingVersion : ONBOARDING_VERSION,
    onboardingStep,
    setupPromptDismissed: value.setupPromptDismissed === true,
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : now,
  }
}

export function normalizeLearningInstallMeta(raw: unknown, now = Date.now()): LearningInstallMeta | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const value = raw as Partial<LearningInstallMeta>
  const kind = value.kind === 'fresh' || value.kind === 'existing' ? value.kind : null
  if (!kind) return null
  return {
    kind,
    createdAt: typeof value.createdAt === 'number' ? value.createdAt : now,
  }
}

export async function getLearningProfile(storage: FlowlaryStorage): Promise<LearningProfile> {
  const accountId = activeAccountContext.getAccountId()
  if (!accountId) {
    // Install-only / signed-out: persist under the legacy unscoped key so setup can complete.
    // First sign-in claims this via maybeClaimLegacyAccountData.
    const raw = await storage.get(STORAGE_KEYS.learningProfile, 'local')
    return normalizeLearningProfile(raw)
  }
  const raw = await getAccountScopedStorage(storage).get('learningProfile')
  return normalizeLearningProfile(raw)
}

export async function setLearningProfile(
  storage: FlowlaryStorage,
  profile: LearningProfile,
): Promise<void> {
  const accountId = activeAccountContext.getAccountId()
  if (!accountId) {
    await storage.set(
      STORAGE_KEYS.learningProfile,
      profile as unknown as Record<string, unknown>,
      'local',
    )
    return
  }
  await getAccountScopedStorage(storage).set(
    'learningProfile',
    profile as unknown as Record<string, unknown>,
  )
  void pushRemoteLearningProfile(storage, profile)
}

export async function patchLearningProfile(
  storage: FlowlaryStorage,
  patch: Partial<
    Pick<
      LearningProfile,
      | 'learningLanguage'
      | 'nativeLanguage'
      | 'level'
      | 'focusAreas'
      | 'onboardingCompleted'
      | 'onboardingVersion'
      | 'onboardingStep'
      | 'setupPromptDismissed'
    >
  > & { level?: LearningLevel | null },
): Promise<LearningProfile> {
  const current = await getLearningProfile(storage)
  const now = Date.now()
  const next: LearningProfile = {
    ...current,
    ...patch,
    level: patch.level === null ? undefined : (patch.level ?? current.level),
    nativeLanguage:
      patch.nativeLanguage === null || patch.nativeLanguage === ''
        ? undefined
        : (patch.nativeLanguage ?? current.nativeLanguage),
    updatedAt: now,
  }
  if (patch.focusAreas) {
    const filtered = patch.focusAreas.filter(isLearningFocus)
    next.focusAreas = filtered.length > 0 ? filtered : [...DEFAULT_FOCUS_AREAS]
  }
  await setLearningProfile(storage, next)
  return next
}

export async function resetLearningProfile(storage: FlowlaryStorage): Promise<LearningProfile> {
  const now = Date.now()
  const next = createDefaultLearningProfile(now)
  next.onboardingCompleted = false
  next.onboardingStep = 'welcome'
  next.setupPromptDismissed = false
  await setLearningProfile(storage, next)
  return next
}

export async function getLearningInstallMeta(storage: FlowlaryStorage): Promise<LearningInstallMeta | null> {
  const raw = await storage.get(storage.keys.learningInstall, 'local')
  return normalizeLearningInstallMeta(raw)
}

export async function setLearningInstallKind(
  storage: FlowlaryStorage,
  kind: LearningInstallKind,
): Promise<void> {
  const meta: LearningInstallMeta = { kind, createdAt: Date.now() }
  await storage.set(storage.keys.learningInstall, meta as unknown as Record<string, unknown>, 'local')
}

async function hasExistingProductSettings(storage: FlowlaryStorage): Promise<boolean> {
  const keys = [
    storage.keys.settings,
    storage.keys.correction,
    storage.keys.translation,
    storage.keys.layout,
    storage.keys.layoutProfile,
  ] as const
  const values = await Promise.all(keys.map((key) => storage.get(key, 'local')))
  return values.some((value) => value != null)
}

export async function ensureLearningProfile(storage: FlowlaryStorage): Promise<LearningProfile> {
  const accountId = activeAccountContext.getAccountId()
  if (!accountId) {
    const raw = await storage.get(STORAGE_KEYS.learningProfile, 'local')
    if (raw != null) {
      return normalizeLearningProfile(raw)
    }
    const installMeta = await getLearningInstallMeta(storage)
    const profile = createDefaultLearningProfile()
    if (installMeta?.kind === 'existing') {
      profile.onboardingStep = null
    }
    await storage.set(
      STORAGE_KEYS.learningProfile,
      profile as unknown as Record<string, unknown>,
      'local',
    )
    return profile
  }

  const raw = await getAccountScopedStorage(storage).get('learningProfile')
  if (raw != null) {
    const profile = normalizeLearningProfile(raw)
    await setLearningProfile(storage, profile)
    return profile
  }

  const installMeta = await getLearningInstallMeta(storage)
  let isExisting: boolean
  if (installMeta?.kind === 'fresh') {
    isExisting = false
  } else if (installMeta?.kind === 'existing') {
    isExisting = true
  } else {
    isExisting = await hasExistingProductSettings(storage)
    await setLearningInstallKind(storage, isExisting ? 'existing' : 'fresh')
  }

  const profile = createDefaultLearningProfile()
  if (isExisting) {
    profile.onboardingStep = null
  }
  await setLearningProfile(storage, profile)
  return profile
}

export type LearningRuntimeView = {
  profile: LearningProfile
  showFullOnboarding: boolean
  showSetupPrompt: boolean
}

export function buildLearningRuntimeView(
  profile: LearningProfile,
  installMeta: LearningInstallMeta | null,
): LearningRuntimeView {
  const isFresh = installMeta?.kind === 'fresh'
  const showFullOnboarding = isFresh && !profile.onboardingCompleted
  const showSetupPrompt =
    !showFullOnboarding &&
    !profile.onboardingCompleted &&
    !profile.setupPromptDismissed &&
    installMeta?.kind === 'existing'

  return { profile, showFullOnboarding, showSetupPrompt }
}

export function formatLearningSummary(profile: LearningProfile): string {
  const language = profile.learningLanguage === 'en' ? 'English' : profile.learningLanguage.toUpperCase()
  const parts: string[] = [language]

  if (profile.level) {
    parts.push(profile.level.replace(/_/g, ' '))
  }

  if (profile.focusAreas.length > 0) {
    const focus = profile.focusAreas
      .map((area) => area.charAt(0).toUpperCase() + area.slice(1))
      .join(' + ')
    parts.push(focus)
  }

  return parts.join(' · ')
}

export async function completeOnboarding(
  storage: FlowlaryStorage,
): Promise<LearningProfile> {
  return patchLearningProfile(storage, {
    onboardingCompleted: true,
    onboardingVersion: ONBOARDING_VERSION,
    onboardingStep: null,
  })
}

export async function setOnboardingStep(
  storage: FlowlaryStorage,
  step: OnboardingStep | null,
): Promise<LearningProfile> {
  return patchLearningProfile(storage, { onboardingStep: step })
}

export async function dismissLearningSetupPrompt(storage: FlowlaryStorage): Promise<LearningProfile> {
  return patchLearningProfile(storage, { setupPromptDismissed: true })
}

export async function restartLearningOnboarding(storage: FlowlaryStorage): Promise<LearningProfile> {
  return patchLearningProfile(storage, {
    onboardingCompleted: false,
    onboardingStep: 'welcome',
    setupPromptDismissed: false,
  })
}

/** Apply safe defaults when the user skips a learning configuration step. */
export function learningSkipDefaults(): Pick<LearningProfile, 'learningLanguage' | 'level' | 'focusAreas'> {
  return {
    learningLanguage: DEFAULT_LEARNING_LANGUAGE,
    level: undefined,
    focusAreas: [...DEFAULT_FOCUS_AREAS],
  }
}

export { STORAGE_KEYS }
