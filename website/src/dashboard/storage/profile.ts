import {
  createDefaultLearningProfile,
  DEFAULT_FOCUS_AREAS,
  DEFAULT_LEARNING_LANGUAGE,
  isLearningFocus,
  isLearningLevel,
  isOnboardingStep,
  LEARNING_PROFILE_VERSION,
  ONBOARDING_VERSION,
  type LearningProfile,
} from '@flowlary/shared'

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
