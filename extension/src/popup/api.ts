import type { LearningFocus, LearningLevel, OnboardingStep } from '@flowlary/shared'
import type { ExtensionStatus, HistoryResponse, LearningProfileResponse } from '../messaging/types.ts'

export class PopupApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PopupApiError'
  }
}

async function sendMessage<T>(message: unknown): Promise<T> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    throw new PopupApiError('Extension messaging is unavailable.')
  }
  const response = await chrome.runtime.sendMessage(message)
  if (response && typeof response === 'object' && 'ok' in response && response.ok === false) {
    throw new PopupApiError(
      typeof (response as { error?: string }).error === 'string'
        ? humanizePopupError((response as { error: string }).error)
        : 'Request failed.',
    )
  }
  return response as T
}

export function humanizePopupError(code: string): string {
  switch (code) {
    case 'unknown_message':
      return 'Could not reach the extension background.'
    case 'no_tab':
      return 'Open a page with an editable field first.'
    case 'account_credentials':
    case 'account_login_invalid':
      return 'Incorrect email or password.'
    case 'account_login_failed':
      return 'Could not sign in. Use flowlary.com or check your connection.'
    case 'auth_failed':
      return 'Please sign in again.'
    case 'account_register_failed':
    case 'account_register_invalid':
      return 'Could not create the account. Try a different email or try again.'
    case 'account_duplicate':
      return 'That email is already registered. Sign in instead.'
    case 'invalid_email':
      return 'Enter a valid email address.'
    case 'invalid_password':
      return 'Password must be at least 8 characters.'
    case 'account_import_failed':
      return 'Could not connect the website session. Sign in on the extension with the same email.'
    case 'usage_exhausted':
      return "You've used today's AI writing checks. Local tools and Google translation are still available."
    case 'account_required':
      return 'Sign in to use Flowlary AI. Your local tools remain available without an account.'
    case 'rate_limited':
    case 'AI_RATE_LIMITED':
      return "You're sending requests too quickly. Try again shortly."
    case 'entitlement_denied':
    case 'AI_ENTITLEMENT_DENIED':
      return "You've used today's AI writing checks. Local tools and Google translation are still available."
    case 'capability_denied':
      return 'This feature needs Trial or Pro.'
    case 'AI_UNAVAILABLE':
    case 'AI_PROVIDER_ERROR':
    case 'AI_TIMEOUT':
      return 'AI is temporarily unavailable. Try again — local tools still work.'
    case 'AI_AUTH_FAILED':
      return 'Please sign in again.'
    case 'AI_INVALID_RESPONSE':
    case 'invalid_response':
      return 'Flowlary AI could not complete that request. Try again in a moment.'
    case 'auth_register_failed':
    case 'auth_register_invalid':
      return "You're offline. Check your connection and try again."
    case 'account_changed':
      return 'Your account changed during that request. Try again.'
    case 'network':
      return "You're offline. Local tools are still available."
    default:
      return 'Something went wrong. Try again.'
  }
}

export type CorrectionPatch = Partial<{
  enabled: boolean
  mode: 'box' | 'direct'
  highlights: boolean
  consentAccepted: boolean
}>

export type TranslationPatch = Partial<{
  mode: 'box' | 'direct'
  liveEnabled: boolean
  shortcutEnabled: boolean
  sourceLanguage: string
  targetLanguage: string
}>

export type LayoutPatch = Partial<{
  mode: 'box' | 'direct'
  autoEnabled: boolean
  manualConversionEnabled: boolean
  directShortcutEnabled: boolean
  sourceLayout: string
  targetLayouts: string[]
}>

export type LearningProfilePatch = Partial<{
  learningLanguage: string
  nativeLanguage: string | null
  level: LearningLevel | null
  focusAreas: LearningFocus[]
  onboardingCompleted: boolean
  onboardingVersion: number
  onboardingStep: OnboardingStep | null
  setupPromptDismissed: boolean
}>

export async function fetchStatus(): Promise<ExtensionStatus> {
  return sendMessage<ExtensionStatus>({ type: 'GET_STATUS' })
}

export async function setGlobalActive(active: boolean): Promise<ExtensionStatus> {
  return sendMessage<ExtensionStatus>({
    type: 'SET_SETTINGS',
    patch: active ? { enabled: true, pausedUntil: null } : { enabled: false },
  })
}

export async function patchSettings(patch: Record<string, unknown>): Promise<ExtensionStatus> {
  return sendMessage<ExtensionStatus>({ type: 'SET_SETTINGS', patch })
}

export async function patchWritingPolicy(patch: {
  helpStyle?: 'auto' | 'suggestions' | 'shortcuts_only' | null
  fixWrongTyping?: boolean
  improveEnglish?: boolean
  arabicToEnglishMode?: boolean
  polishAfterTranslate?: boolean
  aiAdvisorEnabled?: boolean
  aiWritingReviewEnabled?: boolean
}): Promise<ExtensionStatus> {
  return sendMessage<ExtensionStatus>({ type: 'SET_SETTINGS', patch })
}

export async function patchCorrection(patch: CorrectionPatch): Promise<ExtensionStatus> {
  return sendMessage<ExtensionStatus>({ type: 'SET_CORRECTION', patch })
}

export async function patchTranslation(patch: TranslationPatch): Promise<ExtensionStatus> {
  return sendMessage<ExtensionStatus>({ type: 'SET_TRANSLATION', patch })
}

export async function patchLayout(patch: LayoutPatch): Promise<ExtensionStatus> {
  return sendMessage<ExtensionStatus>({ type: 'SET_LAYOUT', patch })
}

export async function dispatchCommand(
  operation: 'TRANSLATE' | 'FIX_LAYOUT' | 'CORRECT' | 'SPEED_BOX',
): Promise<void> {
  await sendMessage({ type: 'RUN_COMMAND', operation })
}

export type FirstWinPatch = Partial<{
  completed: boolean
  localSuccess: boolean
  aiSuccess: boolean
}>

export async function markFirstWin(patch: FirstWinPatch): Promise<ExtensionStatus> {
  return sendMessage<ExtensionStatus>({ type: 'MARK_FIRST_WIN', patch })
}

export async function acceptFlowlaryAi(): Promise<ExtensionStatus> {
  return patchCorrection({ consentAccepted: true })
}

export async function fetchHistory(): Promise<HistoryResponse> {
  return sendMessage<HistoryResponse>({ type: 'GET_HISTORY' })
}

export async function deleteHistoryEntry(id: string): Promise<HistoryResponse> {
  return sendMessage<HistoryResponse>({ type: 'DELETE_HISTORY_ENTRY', id })
}

export async function clearAllHistory(): Promise<HistoryResponse> {
  return sendMessage<HistoryResponse>({ type: 'CLEAR_HISTORY' })
}

export async function accountLogin(email: string, password: string): Promise<ExtensionStatus> {
  return sendMessage<ExtensionStatus>({ type: 'ACCOUNT_LOGIN', email, password })
}

export async function accountRegister(email: string, password: string): Promise<ExtensionStatus> {
  return sendMessage<ExtensionStatus>({ type: 'ACCOUNT_REGISTER', email, password })
}

export async function accountLogout(): Promise<ExtensionStatus> {
  return sendMessage<ExtensionStatus>({ type: 'ACCOUNT_LOGOUT' })
}

export async function accountSync(): Promise<ExtensionStatus> {
  return sendMessage<ExtensionStatus>({ type: 'ACCOUNT_SYNC' })
}

export async function fetchLearning(): Promise<LearningProfileResponse> {
  return sendMessage<LearningProfileResponse>({ type: 'GET_LEARNING' })
}

export async function patchLearningProfile(patch: LearningProfilePatch): Promise<LearningProfileResponse> {
  return sendMessage<LearningProfileResponse>({ type: 'SET_LEARNING_PROFILE', patch })
}

export async function resetLearningProfile(): Promise<LearningProfileResponse> {
  return sendMessage<LearningProfileResponse>({ type: 'RESET_LEARNING_PROFILE' })
}

export async function completeOnboarding(): Promise<LearningProfileResponse> {
  return sendMessage<LearningProfileResponse>({ type: 'COMPLETE_ONBOARDING' })
}

export async function setOnboardingStep(step: OnboardingStep | null): Promise<LearningProfileResponse> {
  return sendMessage<LearningProfileResponse>({ type: 'SET_ONBOARDING_STEP', step })
}

export async function dismissLearningSetup(): Promise<LearningProfileResponse> {
  return sendMessage<LearningProfileResponse>({ type: 'DISMISS_LEARNING_SETUP' })
}

export async function restartLearningOnboarding(): Promise<LearningProfileResponse> {
  return sendMessage<LearningProfileResponse>({ type: 'RESTART_LEARNING_ONBOARDING' })
}

export async function fetchProgress(): Promise<import('../storage/learning/progress.ts').ProgressMetrics> {
  return sendMessage({ type: 'GET_PROGRESS' })
}

export async function fetchDailyBrief(): Promise<import('@flowlary/shared').DailyLearningBrief> {
  return sendMessage({ type: 'GET_DAILY_BRIEF' })
}

export async function fetchFullLearningReport(): Promise<import('@flowlary/shared').FullLearningReport> {
  return sendMessage({ type: 'GET_FULL_LEARNING_REPORT' })
}

export async function askLearningCoach(
  mode: import('@flowlary/shared').LearningCoachMode,
  question?: string,
): Promise<import('@flowlary/shared').LearningCoachResult> {
  return sendMessage({ type: 'ASK_LEARNING_COACH', mode, question })
}

export async function clearLearningHistory(): Promise<import('../storage/learning/progress.ts').ProgressMetrics> {
  return sendMessage({ type: 'CLEAR_LEARNING_EVENTS' })
}

export async function fetchPracticeHome(): Promise<import('../messaging/types.ts').PracticeHomeResponse> {
  return sendMessage({ type: 'GET_PRACTICE_HOME' })
}

export async function savePracticeSession(
  session: import('@flowlary/shared').PracticeSessionRecord,
): Promise<{ ok: boolean }> {
  return sendMessage({ type: 'SAVE_PRACTICE_SESSION', session })
}

export async function requestPracticeCorrection(
  text: string,
  signal?: AbortSignal,
): Promise<import('../features/correction/client.ts').CorrectTextResponse> {
  const { requestCorrectionRemote } = await import('../features/correction/client.ts')
  const requestId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `practice-${Date.now()}`
  return requestCorrectionRemote(requestId, text, 'textarea', undefined, signal, 'practice')
}

export async function fetchDataSummary(): Promise<import('../messaging/types.ts').DataSummaryResponse> {
  return sendMessage({ type: 'GET_DATA_SUMMARY' })
}

export async function exportUserData(): Promise<import('../messaging/types.ts').ExportUserDataResponse> {
  return sendMessage({ type: 'EXPORT_USER_DATA' })
}

export async function previewDataImport(raw: string): Promise<import('../messaging/types.ts').ImportPreviewResponse> {
  return sendMessage({ type: 'PREVIEW_DATA_IMPORT', raw })
}

export async function importUserData(
  raw: string,
  replaceProfile: boolean,
): Promise<import('../messaging/types.ts').ImportUserDataResponse> {
  return sendMessage({ type: 'IMPORT_USER_DATA', raw, replaceProfile })
}

export async function resetFlowlaryLocal(): Promise<ExtensionStatus> {
  return sendMessage<ExtensionStatus>({ type: 'RESET_FLOWLARY_LOCAL' })
}

export async function fetchFeedbackEligibilityPopup(): Promise<{ eligiblePrompts: string[] } | null> {
  const response = await sendMessage<{ ok: boolean; eligiblePrompts?: string[] }>({ type: 'FEEDBACK_ELIGIBILITY' })
  if (!response?.ok) return null
  return { eligiblePrompts: response.eligiblePrompts ?? [] }
}

export async function dismissFeedbackPrompt(promptId: string, action: 'not_now' | 'dont_ask_again'): Promise<void> {
  await sendMessage({ type: 'FEEDBACK_DISMISS', promptId, action })
}

export async function markFeedbackPromptShown(promptId: string): Promise<void> {
  await sendMessage({ type: 'FEEDBACK_PROMPT_SHOWN', promptId })
}

export async function submitFeedbackMessage(payload: Record<string, unknown>): Promise<void> {
  await sendMessage({ type: 'FEEDBACK_SUBMIT', payload })
}
