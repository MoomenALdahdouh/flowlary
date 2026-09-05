import type {
  Command,
  CommandResult,
  HistoryEntry,
  HistoryStats,
  LearningFocus,
  LearningLevel,
  LearningProfile,
  OnboardingStep,
} from '@flowlary/shared'
import { BRAND } from '@flowlary/shared'

export type MessageType =
  | 'GET_STATUS'
  | 'SET_SETTINGS'
  | 'SET_TRANSLATION'
  | 'SET_CORRECTION'
  | 'SET_LAYOUT'
  | 'PAUSE_TEMPORARILY'
  | 'CAN_INTERVENE'
  | 'NOTE_USAGE_ACTIVITY'
  | 'ACTIVATE_LICENSE'
  | 'ACCOUNT_LOGIN'
  | 'ACCOUNT_REGISTER'
  | 'ACCOUNT_LOGOUT'
  | 'ACCOUNT_SYNC'
  | 'ACCOUNT_IMPORT_SESSION'
  | 'OPEN_DASHBOARD'
  | 'DISPATCH_COMMAND'
  | 'COMMAND_RESULT'
  | 'RUN_COMMAND'
  | 'CHECK_WORD'
  | 'RANK_HYPOTHESES'
  | 'CANCEL_RANK_HYPOTHESES'
  | 'REVIEW_WRITING'
  | 'CANCEL_REVIEW_WRITING'
  | 'TRANSLATE_TEXT'
  | 'GET_HISTORY'
  | 'DELETE_HISTORY_ENTRY'
  | 'CLEAR_HISTORY'

export type ExtensionStatus = {
  brand: typeof BRAND
  active: boolean
  features: {
    correction: boolean
    translation: boolean
    layout: boolean
  }
  translation: {
    mode: 'box' | 'direct'
    liveEnabled: boolean
    shortcutEnabled: boolean
    sourceLanguage: string
    targetLanguage: string
  }
  correction: {
    enabled: boolean
    mode: 'box' | 'direct'
    highlights: boolean
    consentAccepted: boolean
    aiReady: boolean
  }
  layout: {
    mode: 'box' | 'direct'
    autoEnabled: boolean
    manualConversionEnabled: boolean
    directShortcutEnabled: boolean
    sourceLayout: string
    targetLayouts: string[]
  }
  writingPolicy?: {
    helpStyle: 'auto' | 'suggestions' | 'shortcuts_only'
    fixWrongTyping: boolean
    improveEnglish: boolean
    arabicToEnglishMode: boolean
    polishAfterTranslate: boolean
    aiAdvisorEnabled: boolean
    aiWritingReviewEnabled: boolean
    operatingState: 'normal' | 'translation' | 'manual'
  }
  excludedDomains?: string[]
  pageHostname?: string | null
  pageExcluded?: boolean
  learning: {
    onboardingCompleted: boolean
    showFullOnboarding: boolean
    showSetupPrompt: boolean
    onboardingStep: 'welcome' | 'learning' | 'tools' | 'ready' | null
    summary: string | null
  }
  entitlement: {
    status: 'trial' | 'free' | 'pro' | 'unknown'
    hasLicenseKey: boolean
    isPro: boolean
    inTrial: boolean
    studentProActive: boolean
    studentProExpiresAt: number | null
    trialEndsAt: number | null
    /** @deprecated Prefer creditsRemaining. */
    remainingMs: number
    creditsRemaining: number
    creditsUsed: number
    dailyLimit: number
    resetAt: number
    monthlyCreditsUsed: number
    monthlySoftCap: number | null
    capabilities: string[]
  }
  account: {
    signedIn: boolean
    accountId: string | null
    email: string | null
    serverPlan: string | null
    billingAvailable: boolean
    subscriptionStatus: string | null
    cancelAtPeriodEnd: boolean
    paymentFailed: boolean
    currentPeriodEnd: number | null
  }
  apiHealth: 'ok' | 'offline' | 'unknown'
  version: string
  firstWin?: {
    completed: boolean
    localSuccess: boolean
    aiSuccess: boolean
  }
}

export type GetStatusMessage = { type: 'GET_STATUS' }
export type SetSettingsMessage = { type: 'SET_SETTINGS'; patch: Record<string, unknown> }
export type SetTranslationMessage = {
  type: 'SET_TRANSLATION'
  patch: Partial<{
    mode: 'box' | 'direct'
    liveEnabled: boolean
    shortcutEnabled: boolean
    sourceLanguage: string
    targetLanguage: string
  }>
}
export type SetCorrectionMessage = {
  type: 'SET_CORRECTION'
  patch: Partial<{
    enabled: boolean
    mode: 'box' | 'direct'
    highlights: boolean
    consentAccepted: boolean
  }>
}
export type SetLayoutMessage = {
  type: 'SET_LAYOUT'
  patch: Partial<{
    mode: 'box' | 'direct'
    autoEnabled: boolean
    manualConversionEnabled: boolean
    directShortcutEnabled: boolean
    sourceLayout: string
    targetLayouts: string[]
  }>
}
export type CorrectTextMessage = {
  type: 'CORRECT_TEXT'
  requestId: string
  text: string
  fieldType?: string
  previousText?: string
  /** Practice checks reuse the correction pipeline with practice entitlement + credit weight. */
  mode?: 'practice'
}
export type LocalizeExplanationMessage = {
  type: 'LOCALIZE_EXPLANATION'
  requestId: string
  locale: import('@flowlary/shared').UiLocaleCode
  explanation: import('@flowlary/shared').RuleExplanation
  ruleVersion?: string
}
export type CancelCorrectMessage = { type: 'CANCEL_CORRECT'; requestId: string }
export type PauseTemporarilyMessage = { type: 'PAUSE_TEMPORARILY'; ms?: number }
export type CanInterveneMessage = { type: 'CAN_INTERVENE' }
export type NoteUsageMessage = { type: 'NOTE_USAGE_ACTIVITY' }
export type ActivateLicenseMessage = { type: 'ACTIVATE_LICENSE'; licenseKey: string }
export type AccountLoginMessage = { type: 'ACCOUNT_LOGIN'; email: string; password: string }
export type AccountRegisterMessage = { type: 'ACCOUNT_REGISTER'; email: string; password: string }
export type AccountLogoutMessage = { type: 'ACCOUNT_LOGOUT' }
export type AccountSyncMessage = { type: 'ACCOUNT_SYNC' }
export type AccountImportSessionMessage = {
  type: 'ACCOUNT_IMPORT_SESSION'
  accessToken: string
  refreshToken: string
  sessionId: string
  accountId: string
  email: string
  expiresAt: number
  account?: Record<string, unknown>
  force?: boolean
}
export type OpenDashboardMessage = {
  type: 'OPEN_DASHBOARD'
  section?: import('../config/dashboard.ts').DashboardSection
  practiceTargetPatternId?: string
}
export type DispatchCommandMessage = { type: 'DISPATCH_COMMAND'; command: Command }
export type CommandResultMessage = { type: 'COMMAND_RESULT'; result: CommandResult }
export type RunCommandMessage = {
  type: 'RUN_COMMAND'
  operation: 'TRANSLATE' | 'FIX_LAYOUT' | 'CORRECT' | 'SPEED_BOX'
}

export type MarkFirstWinMessage = {
  type: 'MARK_FIRST_WIN'
  patch: Partial<{
    completed: boolean
    localSuccess: boolean
    aiSuccess: boolean
  }>
}

export type FeedbackEligibilityMessage = { type: 'FEEDBACK_ELIGIBILITY' }
export type FeedbackDismissMessage = {
  type: 'FEEDBACK_DISMISS'
  promptId: string
  action: 'not_now' | 'dont_ask_again'
}
export type FeedbackSubmitMessage = {
  type: 'FEEDBACK_SUBMIT'
  payload: Record<string, unknown>
}
export type FeedbackPromptShownMessage = {
  type: 'FEEDBACK_PROMPT_SHOWN'
  promptId: string
}
export type CheckWordMessage = {
  type: 'CHECK_WORD'
  word: string
  context?: string
  sourceLayout?: string
  candidateLayouts?: string[]
}
export type RankHypothesesMessage = {
  type: 'RANK_HYPOTHESES'
  packet: import('../core/engine/advisor.ts').AdvisorPacket
}
export type CancelRankHypothesesMessage = {
  type: 'CANCEL_RANK_HYPOTHESES'
  cycleId: string
}
export type ReviewWritingMessage = {
  type: 'REVIEW_WRITING'
  packet: import('@flowlary/shared').WritingReviewPacket
}
export type CancelReviewWritingMessage = {
  type: 'CANCEL_REVIEW_WRITING'
  cycleId: string
}
export type TranslateTextMessage = {
  type: 'TRANSLATE_TEXT'
  text: string
  sourceLanguage: import('../features/translation/types.ts').LanguageCode
  targetLanguage: import('../features/translation/types.ts').LanguageCode
  mode: 'shortcut' | 'live'
  context?: import('@flowlary/shared').TranslationRequestContext
  requestId?: string
}
export type CancelTranslateMessage = { type: 'CANCEL_TRANSLATE'; requestId: string }
export type GetHistoryMessage = { type: 'GET_HISTORY' }
export type DeleteHistoryEntryMessage = { type: 'DELETE_HISTORY_ENTRY'; id: string }
export type ClearHistoryMessage = { type: 'CLEAR_HISTORY' }

export type GetLearningMessage = { type: 'GET_LEARNING' }

export type SetLearningProfileMessage = {
  type: 'SET_LEARNING_PROFILE'
  patch: Partial<{
    learningLanguage: string
    nativeLanguage: string | null
    level: LearningLevel | null
    focusAreas: LearningFocus[]
    onboardingCompleted: boolean
    onboardingVersion: number
    onboardingStep: OnboardingStep | null
    setupPromptDismissed: boolean
  }>
}

export type ResetLearningProfileMessage = { type: 'RESET_LEARNING_PROFILE' }
export type CompleteOnboardingMessage = { type: 'COMPLETE_ONBOARDING' }
export type SetOnboardingStepMessage = {
  type: 'SET_ONBOARDING_STEP'
  step: OnboardingStep | null
}
export type DismissLearningSetupMessage = { type: 'DISMISS_LEARNING_SETUP' }
export type RestartLearningOnboardingMessage = { type: 'RESTART_LEARNING_ONBOARDING' }

export type GetProgressMessage = { type: 'GET_PROGRESS' }
export type GetDailyBriefMessage = { type: 'GET_DAILY_BRIEF' }
export type GetFullLearningReportMessage = { type: 'GET_FULL_LEARNING_REPORT' }
export type AskLearningCoachMessage = {
  type: 'ASK_LEARNING_COACH'
  mode: import('@flowlary/shared').LearningCoachMode
  question?: string
}
export type ClearLearningEventsMessage = { type: 'CLEAR_LEARNING_EVENTS' }

export type GetPracticeHomeMessage = { type: 'GET_PRACTICE_HOME' }

export type SavePracticeSessionMessage = {
  type: 'SAVE_PRACTICE_SESSION'
  session: import('@flowlary/shared').PracticeSessionRecord
}

export type PracticeHomeResponse = {
  recommendation: import('@flowlary/shared').PracticeRecommendation
  eventCount: number
  sessionsCompleted: number
  recurringTargets: import('@flowlary/shared').PracticeTargetPattern[]
  targetProgressions: import('@flowlary/shared').TargetPracticeProgression[]
}

export type GetDataSummaryMessage = { type: 'GET_DATA_SUMMARY' }
export type ExportUserDataMessage = { type: 'EXPORT_USER_DATA' }
export type PreviewDataImportMessage = { type: 'PREVIEW_DATA_IMPORT'; raw: string }
export type ImportUserDataMessage = {
  type: 'IMPORT_USER_DATA'
  raw: string
  replaceProfile: boolean
}
export type ResetFlowlaryLocalMessage = { type: 'RESET_FLOWLARY_LOCAL' }

export type DataSummaryResponse = import('@flowlary/shared').DataSummary

export type ExportUserDataResponse =
  | { ok: true; json: string }
  | { ok: false; error: string }

export type ImportPreviewResponse =
  | { ok: true; preview: import('@flowlary/shared').DataImportPreview }
  | { ok: false; error: string }

export type ImportUserDataResponse =
  | { ok: true; result: import('../storage/data/import.ts').ImportUserDataResult }
  | { ok: false; error: string }

export type ProgressResponse = import('../storage/learning/progress.ts').ProgressMetrics

export type DailyBriefResponse = import('@flowlary/shared').DailyLearningBrief

export type LearningCoachResponsePayload = import('@flowlary/shared').LearningCoachResult

export type LearningProfileResponse = {
  profile: LearningProfile
  showFullOnboarding: boolean
  showSetupPrompt: boolean
}

export type HistoryResponse = {
  entries: HistoryEntry[]
  stats: HistoryStats
}

export type ExtensionRequest =
  | GetStatusMessage
  | SetSettingsMessage
  | SetTranslationMessage
  | SetCorrectionMessage
  | SetLayoutMessage
  | PauseTemporarilyMessage
  | CanInterveneMessage
  | NoteUsageMessage
  | ActivateLicenseMessage
  | AccountLoginMessage
  | AccountRegisterMessage
  | AccountLogoutMessage
  | AccountSyncMessage
  | AccountImportSessionMessage
  | OpenDashboardMessage
  | DispatchCommandMessage
  | RunCommandMessage
  | CheckWordMessage
  | RankHypothesesMessage
  | CancelRankHypothesesMessage
  | ReviewWritingMessage
  | CancelReviewWritingMessage
  | TranslateTextMessage
  | CancelTranslateMessage
  | CorrectTextMessage
  | LocalizeExplanationMessage
  | CancelCorrectMessage
  | GetHistoryMessage
  | DeleteHistoryEntryMessage
  | ClearHistoryMessage
  | GetLearningMessage
  | SetLearningProfileMessage
  | ResetLearningProfileMessage
  | CompleteOnboardingMessage
  | SetOnboardingStepMessage
  | DismissLearningSetupMessage
  | RestartLearningOnboardingMessage
  | GetProgressMessage
  | GetDailyBriefMessage
  | GetFullLearningReportMessage
  | AskLearningCoachMessage
  | ClearLearningEventsMessage
  | GetPracticeHomeMessage
  | SavePracticeSessionMessage
  | GetDataSummaryMessage
  | ExportUserDataMessage
  | PreviewDataImportMessage
  | ImportUserDataMessage
  | ResetFlowlaryLocalMessage
  | MarkFirstWinMessage
  | FeedbackEligibilityMessage
  | FeedbackDismissMessage
  | FeedbackSubmitMessage
  | FeedbackPromptShownMessage

export type FeedbackEligibilityResponse = {
  ok: true
  eligiblePrompts: string[]
}

export type ExtensionResponse =
  | ExtensionStatus
  | CommandResult
  | HistoryResponse
  | LearningProfileResponse
  | ProgressResponse
  | PracticeHomeResponse
  | DataSummaryResponse
  | ExportUserDataResponse
  | ImportPreviewResponse
  | ImportUserDataResponse
  | DailyBriefResponse
  | import('@flowlary/shared').FullLearningReport
  | LearningCoachResponsePayload
  | import('../background/classify.ts').CheckWordResponse
  | FeedbackEligibilityResponse
  | { ok: boolean; error?: string }

export function isExtensionRequest(value: unknown): value is ExtensionRequest {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof (value as { type: unknown }).type === 'string'
  )
}
