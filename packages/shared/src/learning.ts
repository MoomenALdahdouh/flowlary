/** Current learning profile schema version. */
export const LEARNING_PROFILE_VERSION = 1

/** Onboarding flow version — bump when steps or consent copy change materially. */
export const ONBOARDING_VERSION = 1

/** V1 learning language scope. Architecture allows future expansion. */
export const DEFAULT_LEARNING_LANGUAGE = 'en'

export const LEARNING_LEVELS = [
  'beginner',
  'elementary',
  'intermediate',
  'upper_intermediate',
  'advanced',
] as const

export type LearningLevel = (typeof LEARNING_LEVELS)[number]

export const LEARNING_FOCUS_AREAS = ['spelling', 'grammar', 'wording'] as const

export type LearningFocus = (typeof LEARNING_FOCUS_AREAS)[number]

export type OnboardingStep = 'welcome' | 'learning' | 'tools' | 'ready'

export type LearningProfile = {
  version: number
  learningLanguage: string
  nativeLanguage?: string
  level?: LearningLevel
  focusAreas: LearningFocus[]
  onboardingCompleted: boolean
  onboardingVersion: number
  /** In-progress onboarding step; null when not in a flow. */
  onboardingStep?: OnboardingStep | null
  /** Existing users may dismiss the lightweight setup prompt. */
  setupPromptDismissed?: boolean
  createdAt: number
  updatedAt: number
}

export type LearningInstallKind = 'fresh' | 'existing'

export type LearningInstallMeta = {
  kind: LearningInstallKind
  createdAt: number
}

export const DEFAULT_FOCUS_AREAS: LearningFocus[] = ['grammar', 'spelling']

export function createDefaultLearningProfile(now = Date.now()): LearningProfile {
  return {
    version: LEARNING_PROFILE_VERSION,
    learningLanguage: DEFAULT_LEARNING_LANGUAGE,
    focusAreas: [...DEFAULT_FOCUS_AREAS],
    onboardingCompleted: false,
    onboardingVersion: ONBOARDING_VERSION,
    onboardingStep: 'welcome',
    setupPromptDismissed: false,
    createdAt: now,
    updatedAt: now,
  }
}

export function isLearningLevel(value: unknown): value is LearningLevel {
  return typeof value === 'string' && (LEARNING_LEVELS as readonly string[]).includes(value)
}

export function isLearningFocus(value: unknown): value is LearningFocus {
  return typeof value === 'string' && (LEARNING_FOCUS_AREAS as readonly string[]).includes(value)
}

/** Minimum writing learning events before personalization activates (matches practice emerging threshold). */
export const MIN_WRITING_EVENTS_FOR_PERSONALIZATION = 3

export type PersonalizationState = 'no_data' | 'insufficient' | 'ready'

export type PersonalizationInsightId =
  | 'building_profile'
  | 'user_focus'
  | 'system_focus'
  | 'recurring_pattern'
  | 'trend_improved'
  | 'trend_increased'
  | 'input_layout_focus'

export type PersonalizationInsight = {
  id: PersonalizationInsightId
  params?: Record<string, string>
}

export type LearningPersonalization = {
  state: PersonalizationState
  /** User-selected focus areas from LearningProfile — never overwritten by the system. */
  userFocusAreas: LearningFocus[]
  /** Evidence-based writing focus suggestion (spelling/grammar/wording only). */
  systemRecommendedFocus: LearningFocus | null
  /** Input-mechanics focus when layout errors recur; not English Practice. */
  inputFocusCategory: 'layout' | null
  /** Writing categories ordered by evidence score (recurrence + recency + user tie-break). */
  prioritizedCategories: LearningFocus[]
  insights: PersonalizationInsight[]
}

export function isOnboardingStep(value: unknown): value is OnboardingStep {
  return (
    value === 'welcome' ||
    value === 'learning' ||
    value === 'tools' ||
    value === 'ready'
  )
}
