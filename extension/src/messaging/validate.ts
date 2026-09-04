import {
  isBoundedString,
  isLearningCoachMode,
  isLearningFocus,
  isLearningLevel,
  isOnboardingStep,
  isUiLocaleCode,
  validateRuleExplanation,
  SECURITY_LIMITS,
  type OperationType,
} from '@flowlary/shared'
import type {
  AccountImportSessionMessage,
  CancelCorrectMessage,
  CancelRankHypothesesMessage,
  CancelReviewWritingMessage,
  CheckWordMessage,
  RankHypothesesMessage,
  ReviewWritingMessage,
  ClearHistoryMessage,
  CorrectTextMessage,
  DeleteHistoryEntryMessage,
  DispatchCommandMessage,
  ExtensionRequest,
  LocalizeExplanationMessage,
  PauseTemporarilyMessage,
  RunCommandMessage,
  SetCorrectionMessage,
  SetLayoutMessage,
  SetSettingsMessage,
  SetTranslationMessage,
  TranslateTextMessage,
} from './types.ts'
import { normalizeLanguage, isSupportedLanguage } from '../features/translation/languages.ts'
import { isSupportedLayout } from '../features/layout/layouts/registry.ts'
import { normalizeExcludedDomains } from '../core/safety/domains.ts'

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string }

const ALLOWED_MESSAGE_TYPES = new Set<string>([
  'GET_STATUS',
  'SET_SETTINGS',
  'SET_TRANSLATION',
  'SET_CORRECTION',
  'SET_LAYOUT',
  'PAUSE_TEMPORARILY',
  'CAN_INTERVENE',
  'NOTE_USAGE_ACTIVITY',
  'ACTIVATE_LICENSE',
  'ACCOUNT_LOGIN',
  'ACCOUNT_REGISTER',
  'ACCOUNT_LOGOUT',
  'ACCOUNT_SYNC',
  'ACCOUNT_IMPORT_SESSION',
  'OPEN_DASHBOARD',
  'DISPATCH_COMMAND',
  'RUN_COMMAND',
  'CHECK_WORD',
  'RANK_HYPOTHESES',
  'CANCEL_RANK_HYPOTHESES',
  'REVIEW_WRITING',
  'CANCEL_REVIEW_WRITING',
  'TRANSLATE_TEXT',
  'CORRECT_TEXT',
  'LOCALIZE_EXPLANATION',
  'CANCEL_CORRECT',
  'GET_HISTORY',
  'DELETE_HISTORY_ENTRY',
  'CLEAR_HISTORY',
  'GET_LEARNING',
  'SET_LEARNING_PROFILE',
  'RESET_LEARNING_PROFILE',
  'COMPLETE_ONBOARDING',
  'SET_ONBOARDING_STEP',
  'DISMISS_LEARNING_SETUP',
  'RESTART_LEARNING_ONBOARDING',
  'GET_PROGRESS',
  'GET_DAILY_BRIEF',
  'GET_FULL_LEARNING_REPORT',
  'ASK_LEARNING_COACH',
  'CLEAR_LEARNING_EVENTS',
  'GET_PRACTICE_HOME',
  'SAVE_PRACTICE_SESSION',
  'GET_DATA_SUMMARY',
  'EXPORT_USER_DATA',
  'PREVIEW_DATA_IMPORT',
  'IMPORT_USER_DATA',
  'RESET_FLOWLARY_LOCAL',
  'MARK_FIRST_WIN',
  'FEEDBACK_ELIGIBILITY',
  'FEEDBACK_DISMISS',
  'FEEDBACK_SUBMIT',
  'FEEDBACK_PROMPT_SHOWN',
])

const RUN_COMMAND_OPS = new Set<string>(['TRANSLATE', 'FIX_LAYOUT', 'CORRECT', 'SPEED_BOX'])
const TRANSLATION_MODES = new Set<string>(['shortcut', 'live'])
const CORRECTION_MODES = new Set<string>(['box', 'direct'])

function fail(error: string): ValidationResult<never> {
  return { ok: false, error }
}

function ok<T>(value: T): ValidationResult<T> {
  return { ok: true, value }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyBoundedString(value: unknown, maxLength: number): value is string {
  return isBoundedString(value, maxLength) && value.trim().length > 0
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

export function validateExtensionRequest(raw: unknown): ValidationResult<ExtensionRequest> {
  if (!isPlainObject(raw)) return fail('unknown_message')
  const type = raw.type
  if (typeof type !== 'string' || !ALLOWED_MESSAGE_TYPES.has(type)) {
    return fail('unknown_message')
  }

  switch (type) {
    case 'GET_STATUS':
    case 'CAN_INTERVENE':
    case 'NOTE_USAGE_ACTIVITY':
    case 'GET_HISTORY':
    case 'CLEAR_HISTORY':
      return ok({ type } as ExtensionRequest)

    case 'SET_SETTINGS':
      return validateSetSettings(raw)
    case 'SET_TRANSLATION':
      return validateSetTranslation(raw)
    case 'SET_CORRECTION':
      return validateSetCorrection(raw)
    case 'SET_LAYOUT':
      return validateSetLayout(raw)
    case 'PAUSE_TEMPORARILY':
      return validatePause(raw)
    case 'ACTIVATE_LICENSE':
      return validateActivateLicense(raw)
    case 'ACCOUNT_LOGIN':
      return validateAccountCredentials(raw, 'ACCOUNT_LOGIN')
    case 'ACCOUNT_REGISTER':
      return validateAccountCredentials(raw, 'ACCOUNT_REGISTER')
    case 'ACCOUNT_LOGOUT':
      return ok({ type: 'ACCOUNT_LOGOUT' })
    case 'ACCOUNT_SYNC':
      return ok({ type: 'ACCOUNT_SYNC' })
    case 'ACCOUNT_IMPORT_SESSION':
      return validateAccountImportSession(raw)
    case 'OPEN_DASHBOARD':
      return validateOpenDashboard(raw)
    case 'RUN_COMMAND':
      return validateRunCommand(raw)
    case 'DISPATCH_COMMAND':
      return validateDispatchCommand(raw)
    case 'CHECK_WORD':
      return validateCheckWord(raw)
    case 'RANK_HYPOTHESES':
      return validateRankHypotheses(raw)
    case 'CANCEL_RANK_HYPOTHESES':
      return validateCancelRankHypotheses(raw)
    case 'REVIEW_WRITING':
      return validateReviewWriting(raw)
    case 'CANCEL_REVIEW_WRITING':
      return validateCancelReviewWriting(raw)
    case 'TRANSLATE_TEXT':
      return validateTranslateText(raw)
    case 'CORRECT_TEXT':
      return validateCorrectText(raw)
    case 'LOCALIZE_EXPLANATION':
      return validateLocalizeExplanation(raw)
    case 'CANCEL_CORRECT':
      return validateCancelCorrect(raw)
    case 'DELETE_HISTORY_ENTRY':
      return validateDeleteHistoryEntry(raw)
    case 'GET_LEARNING':
      return ok({ type: 'GET_LEARNING' } satisfies GetLearningMessage)
    case 'SET_LEARNING_PROFILE':
      return validateSetLearningProfile(raw)
    case 'RESET_LEARNING_PROFILE':
      return ok({ type: 'RESET_LEARNING_PROFILE' } satisfies ResetLearningProfileMessage)
    case 'COMPLETE_ONBOARDING':
      return ok({ type: 'COMPLETE_ONBOARDING' } satisfies CompleteOnboardingMessage)
    case 'SET_ONBOARDING_STEP':
      return validateSetOnboardingStep(raw)
    case 'DISMISS_LEARNING_SETUP':
      return ok({ type: 'DISMISS_LEARNING_SETUP' } satisfies DismissLearningSetupMessage)
    case 'RESTART_LEARNING_ONBOARDING':
      return ok({ type: 'RESTART_LEARNING_ONBOARDING' } satisfies RestartLearningOnboardingMessage)
    case 'GET_PROGRESS':
      return ok({ type: 'GET_PROGRESS' } satisfies GetProgressMessage)
    case 'GET_DAILY_BRIEF':
      return ok({ type: 'GET_DAILY_BRIEF' } satisfies import('./types.ts').GetDailyBriefMessage)
    case 'GET_FULL_LEARNING_REPORT':
      return ok({ type: 'GET_FULL_LEARNING_REPORT' } satisfies import('./types.ts').GetFullLearningReportMessage)
    case 'ASK_LEARNING_COACH': {
      if (!isLearningCoachMode(raw.mode)) return fail('invalid_coach_mode')
      const question =
        typeof raw.question === 'string' && raw.question.trim()
          ? raw.question.trim().slice(0, 500)
          : undefined
      return ok({
        type: 'ASK_LEARNING_COACH',
        mode: raw.mode,
        question,
      } satisfies import('./types.ts').AskLearningCoachMessage)
    }
    case 'CLEAR_LEARNING_EVENTS':
      return ok({ type: 'CLEAR_LEARNING_EVENTS' } satisfies ClearLearningEventsMessage)
    case 'GET_PRACTICE_HOME':
      return ok({ type: 'GET_PRACTICE_HOME' })
    case 'SAVE_PRACTICE_SESSION':
      return validateSavePracticeSession(raw)
    case 'GET_DATA_SUMMARY':
      return ok({ type: 'GET_DATA_SUMMARY' })
    case 'EXPORT_USER_DATA':
      return ok({ type: 'EXPORT_USER_DATA' })
    case 'PREVIEW_DATA_IMPORT':
      return validatePreviewDataImport(raw)
    case 'IMPORT_USER_DATA':
      return validateImportUserData(raw)
    case 'RESET_FLOWLARY_LOCAL':
      return ok({ type: 'RESET_FLOWLARY_LOCAL' })
    case 'MARK_FIRST_WIN':
      return validateMarkFirstWin(raw)
    case 'FEEDBACK_ELIGIBILITY':
      return ok({ type: 'FEEDBACK_ELIGIBILITY' })
    case 'FEEDBACK_DISMISS': {
      if (!isBoundedString(raw.promptId, 64)) return fail('invalid_prompt')
      if (raw.action !== 'not_now' && raw.action !== 'dont_ask_again') return fail('invalid_action')
      return ok({ type: 'FEEDBACK_DISMISS', promptId: raw.promptId, action: raw.action })
    }
    case 'FEEDBACK_SUBMIT': {
      if (!isPlainObject(raw.payload)) return fail('invalid_payload')
      return ok({ type: 'FEEDBACK_SUBMIT', payload: raw.payload })
    }
    case 'FEEDBACK_PROMPT_SHOWN': {
      if (!isBoundedString(raw.promptId, 64)) return fail('invalid_prompt')
      return ok({ type: 'FEEDBACK_PROMPT_SHOWN', promptId: raw.promptId })
    }
    default:
      return fail('unknown_message')
  }
}

function validateSetSettings(raw: Record<string, unknown>): ValidationResult<SetSettingsMessage> {
  if (!isPlainObject(raw.patch)) return fail('invalid_patch')
  const patch = raw.patch
  const next: SetSettingsMessage['patch'] = {}
  const enabled = readBoolean(patch.enabled)
  if (enabled !== undefined) next.enabled = enabled
  if (patch.pausedUntil === null) next.pausedUntil = null
  if (typeof patch.pausedUntil === 'number' && Number.isFinite(patch.pausedUntil)) {
    next.pausedUntil = patch.pausedUntil
  }
  if (Array.isArray(patch.excludedDomains)) {
    next.excludedDomains = normalizeExcludedDomains(patch.excludedDomains).slice(
      0,
      SECURITY_LIMITS.MAX_SETTINGS_DOMAINS,
    )
  }
  if (
    patch.helpStyle === 'auto' ||
    patch.helpStyle === 'suggestions' ||
    patch.helpStyle === 'shortcuts_only' ||
    patch.helpStyle === null
  ) {
    next.helpStyle = patch.helpStyle
  }
  const fixWrongTyping = readBoolean(patch.fixWrongTyping)
  if (fixWrongTyping !== undefined) next.fixWrongTyping = fixWrongTyping
  const improveEnglish = readBoolean(patch.improveEnglish)
  if (improveEnglish !== undefined) next.improveEnglish = improveEnglish
  const arabicToEnglishMode = readBoolean(patch.arabicToEnglishMode)
  if (arabicToEnglishMode !== undefined) next.arabicToEnglishMode = arabicToEnglishMode
  const polishAfterTranslate = readBoolean(patch.polishAfterTranslate)
  if (polishAfterTranslate !== undefined) next.polishAfterTranslate = polishAfterTranslate
  const improveEnglishAfterTranslate = readBoolean(patch.improveEnglishAfterTranslate)
  if (improveEnglishAfterTranslate !== undefined) {
    next.polishAfterTranslate = improveEnglishAfterTranslate
  }
  const aiAdvisorEnabled = readBoolean(patch.aiAdvisorEnabled)
  if (aiAdvisorEnabled !== undefined) next.aiAdvisorEnabled = aiAdvisorEnabled
  const aiWritingReviewEnabled = readBoolean(patch.aiWritingReviewEnabled)
  if (aiWritingReviewEnabled !== undefined) next.aiWritingReviewEnabled = aiWritingReviewEnabled
  return ok({ type: 'SET_SETTINGS', patch: next })
}

function validateSetTranslation(raw: Record<string, unknown>): ValidationResult<SetTranslationMessage> {
  if (!isPlainObject(raw.patch)) return fail('invalid_patch')
  const patch = raw.patch
  const next: SetTranslationMessage['patch'] = {}
  const liveEnabled = readBoolean(patch.liveEnabled)
  if (liveEnabled !== undefined) next.liveEnabled = liveEnabled
  const shortcutEnabled = readBoolean(patch.shortcutEnabled)
  if (shortcutEnabled !== undefined) next.shortcutEnabled = shortcutEnabled
  if (patch.mode === 'box' || patch.mode === 'direct') next.mode = patch.mode
  if (isBoundedString(patch.sourceLanguage, SECURITY_LIMITS.MAX_LANGUAGE_CODE_LENGTH)) {
    next.sourceLanguage = normalizeLanguage(patch.sourceLanguage, 'en')
  }
  if (isBoundedString(patch.targetLanguage, SECURITY_LIMITS.MAX_LANGUAGE_CODE_LENGTH)) {
    next.targetLanguage = normalizeLanguage(patch.targetLanguage, 'ar')
  }
  return ok({ type: 'SET_TRANSLATION', patch: next })
}

function validateSetCorrection(raw: Record<string, unknown>): ValidationResult<SetCorrectionMessage> {
  if (!isPlainObject(raw.patch)) return fail('invalid_patch')
  const patch = raw.patch
  const next: SetCorrectionMessage['patch'] = {}
  const enabled = readBoolean(patch.enabled)
  if (enabled !== undefined) next.enabled = enabled
  const highlights = readBoolean(patch.highlights)
  if (highlights !== undefined) next.highlights = highlights
  const consentAccepted = readBoolean(patch.consentAccepted)
  if (consentAccepted !== undefined) next.consentAccepted = consentAccepted
  if (patch.mode === 'box' || patch.mode === 'direct') next.mode = patch.mode
  return ok({ type: 'SET_CORRECTION', patch: next })
}

function validateSetLayout(raw: Record<string, unknown>): ValidationResult<SetLayoutMessage> {
  if (!isPlainObject(raw.patch)) return fail('invalid_patch')
  const patch = raw.patch
  const next: SetLayoutMessage['patch'] = {}
  const autoEnabled = readBoolean(patch.autoEnabled)
  if (autoEnabled !== undefined) next.autoEnabled = autoEnabled
  const manualConversionEnabled = readBoolean(patch.manualConversionEnabled)
  if (manualConversionEnabled !== undefined) next.manualConversionEnabled = manualConversionEnabled
  const directShortcutEnabled = readBoolean(patch.directShortcutEnabled)
  if (directShortcutEnabled !== undefined) next.directShortcutEnabled = directShortcutEnabled
  if (patch.mode === 'box' || patch.mode === 'direct') next.mode = patch.mode
  if (typeof patch.sourceLayout === 'string' && isSupportedLayout(patch.sourceLayout)) {
    next.sourceLayout = patch.sourceLayout
  }
  if (Array.isArray(patch.targetLayouts)) {
    next.targetLayouts = patch.targetLayouts.filter(
      (value): value is string => typeof value === 'string' && isSupportedLayout(value),
    )
  }
  return ok({ type: 'SET_LAYOUT', patch: next })
}

function validatePause(raw: Record<string, unknown>): ValidationResult<PauseTemporarilyMessage> {
  if (raw.ms == null) return ok({ type: 'PAUSE_TEMPORARILY' })
  if (typeof raw.ms !== 'number' || !Number.isFinite(raw.ms) || raw.ms <= 0) {
    return fail('invalid_pause')
  }
  return ok({ type: 'PAUSE_TEMPORARILY', ms: Math.min(raw.ms, SECURITY_LIMITS.MAX_PAUSE_MS) })
}

function validateAccountImportSession(
  raw: Record<string, unknown>,
): ValidationResult<AccountImportSessionMessage> {
  if (typeof raw.accessToken !== 'string' || !raw.accessToken.trim()) return fail('invalid_access_token')
  if (typeof raw.refreshToken !== 'string' || !raw.refreshToken.trim()) return fail('invalid_refresh_token')
  if (typeof raw.sessionId !== 'string' || !raw.sessionId.trim()) return fail('invalid_session_id')
  if (typeof raw.accountId !== 'string' || !raw.accountId.trim()) return fail('invalid_account_id')
  if (!isNonEmptyBoundedString(raw.email, 254)) return fail('invalid_email')
  if (typeof raw.expiresAt !== 'number' || !Number.isFinite(raw.expiresAt)) return fail('invalid_expires_at')
  const account = isPlainObject(raw.account) ? (raw.account as Record<string, unknown>) : undefined
  return ok({
    type: 'ACCOUNT_IMPORT_SESSION',
    accessToken: raw.accessToken.trim(),
    refreshToken: raw.refreshToken.trim(),
    sessionId: raw.sessionId.trim(),
    accountId: raw.accountId.trim(),
    email: raw.email.trim(),
    expiresAt: raw.expiresAt,
    account,
    force: raw.force === true,
  })
}

const DASHBOARD_SECTIONS = new Set([
  'overview',
  'progress',
  'practice',
  'report',
  'settings',
  'activity',
  'privacy',
  'account',
])

function validateOpenDashboard(raw: Record<string, unknown>): ValidationResult<import('./types.ts').OpenDashboardMessage> {
  const section =
    typeof raw.section === 'string' && DASHBOARD_SECTIONS.has(raw.section)
      ? (raw.section as import('./types.ts').OpenDashboardMessage['section'])
      : 'practice'
  const practiceTargetPatternId =
    typeof raw.practiceTargetPatternId === 'string' && raw.practiceTargetPatternId.trim()
      ? raw.practiceTargetPatternId.trim().slice(0, 120)
      : undefined
  return ok({ type: 'OPEN_DASHBOARD', section, practiceTargetPatternId })
}

function validateAccountCredentials(
  raw: Record<string, unknown>,
  type: 'ACCOUNT_LOGIN' | 'ACCOUNT_REGISTER',
): ValidationResult<{ type: typeof type; email: string; password: string }> {
  if (!isNonEmptyBoundedString(raw.email, 254)) return fail('invalid_email')
  if (typeof raw.password !== 'string' || raw.password.length < 8 || raw.password.length > 128) {
    return fail('invalid_password')
  }
  return ok({ type, email: raw.email.trim(), password: raw.password })
}

function validateActivateLicense(raw: Record<string, unknown>): ValidationResult<ActivateLicenseMessage> {
  if (!isBoundedString(raw.licenseKey, SECURITY_LIMITS.MAX_LICENSE_KEY_LENGTH)) {
    return fail('invalid_license_key')
  }
  return ok({ type: 'ACTIVATE_LICENSE', licenseKey: raw.licenseKey.trim() })
}

function validateMarkFirstWin(
  raw: Record<string, unknown>,
): ValidationResult<import('./types.ts').MarkFirstWinMessage> {
  if (!isPlainObject(raw.patch)) return fail('invalid_patch')
  const patch = raw.patch
  const next: import('./types.ts').MarkFirstWinMessage['patch'] = {}
  const completed = readBoolean(patch.completed)
  if (completed !== undefined) next.completed = completed
  const localSuccess = readBoolean(patch.localSuccess)
  if (localSuccess !== undefined) next.localSuccess = localSuccess
  const aiSuccess = readBoolean(patch.aiSuccess)
  if (aiSuccess !== undefined) next.aiSuccess = aiSuccess
  return ok({ type: 'MARK_FIRST_WIN', patch: next })
}

function validateRunCommand(raw: Record<string, unknown>): ValidationResult<RunCommandMessage> {
  if (typeof raw.operation !== 'string' || !RUN_COMMAND_OPS.has(raw.operation)) {
    return fail('unsupported_operation')
  }
  return ok({ type: 'RUN_COMMAND', operation: raw.operation as RunCommandMessage['operation'] })
}

function validateDispatchCommand(
  raw: Record<string, unknown>,
): ValidationResult<DispatchCommandMessage> {
  if (!isPlainObject(raw.command)) return fail('invalid_command')
  const commandType = raw.command.type
  if (typeof commandType !== 'string') return fail('invalid_command')
  if (commandType === 'PIPELINE') return fail('pipeline_not_implemented')
  if (!RUN_COMMAND_OPS.has(commandType)) return fail('unsupported_operation')
  return ok({
    type: 'DISPATCH_COMMAND',
    command: {
      type: commandType as OperationType,
      field: { id: 'invalid', tag: 'UNKNOWN' },
      text: '',
    },
  })
}

function validateRankHypotheses(raw: Record<string, unknown>): ValidationResult<RankHypothesesMessage> {
  const packet = raw.packet
  if (!packet || typeof packet !== 'object') return fail('invalid_packet')
  const value = packet as RankHypothesesMessage['packet']
  if (typeof value.cycleId !== 'string' || value.cycleId.length > 128) return fail('invalid_packet')
  if (!Array.isArray(value.hypotheses) || value.hypotheses.length === 0 || value.hypotheses.length > 24) {
    return fail('invalid_packet')
  }
  if (typeof value.snippet === 'string' && value.snippet.length > 200) return fail('invalid_packet')
  return ok({ type: 'RANK_HYPOTHESES', packet: value })
}

function validateCancelRankHypotheses(
  raw: Record<string, unknown>,
): ValidationResult<CancelRankHypothesesMessage> {
  if (!isNonEmptyBoundedString(raw.cycleId, 128)) return fail('invalid_cycle_id')
  return ok({ type: 'CANCEL_RANK_HYPOTHESES', cycleId: raw.cycleId })
}

function validateReviewWriting(raw: Record<string, unknown>): ValidationResult<ReviewWritingMessage> {
  const packet = raw.packet
  if (!packet || typeof packet !== 'object') return fail('invalid_packet')
  const value = packet as ReviewWritingMessage['packet']
  if (typeof value.cycleId !== 'string' || value.cycleId.length > 128) return fail('invalid_packet')
  if (typeof value.snippet !== 'string' || value.snippet.length === 0 || value.snippet.length > 400) {
    return fail('invalid_packet')
  }
  return ok({ type: 'REVIEW_WRITING', packet: value })
}

function validateCancelReviewWriting(
  raw: Record<string, unknown>,
): ValidationResult<CancelReviewWritingMessage> {
  if (!isNonEmptyBoundedString(raw.cycleId, 128)) return fail('invalid_cycle_id')
  return ok({ type: 'CANCEL_REVIEW_WRITING', cycleId: raw.cycleId })
}

function validateCheckWord(raw: Record<string, unknown>): ValidationResult<CheckWordMessage> {
  if (!isBoundedString(raw.word, SECURITY_LIMITS.MAX_LAYOUT_TOKEN_LENGTH)) {
    return fail('invalid_word')
  }
  const message: CheckWordMessage = {
    type: 'CHECK_WORD',
    word: raw.word.trim(),
  }
  if (isBoundedString(raw.context, SECURITY_LIMITS.MAX_CONTEXT_LENGTH)) {
    message.context = raw.context
  }
  if (typeof raw.sourceLayout === 'string' && isSupportedLayout(raw.sourceLayout)) {
    message.sourceLayout = raw.sourceLayout
  }
  if (Array.isArray(raw.candidateLayouts)) {
    message.candidateLayouts = raw.candidateLayouts.filter(
      (value): value is string => typeof value === 'string' && isSupportedLayout(value),
    )
  }
  return ok(message)
}

function validateTranslateText(raw: Record<string, unknown>): ValidationResult<TranslateTextMessage> {
  if (!isNonEmptyBoundedString(raw.text, SECURITY_LIMITS.MAX_TRANSLATION_TEXT_LENGTH)) {
    return fail('invalid_text')
  }
  if (!isBoundedString(raw.sourceLanguage, SECURITY_LIMITS.MAX_LANGUAGE_CODE_LENGTH)) {
    return fail('invalid_language')
  }
  if (!isBoundedString(raw.targetLanguage, SECURITY_LIMITS.MAX_LANGUAGE_CODE_LENGTH)) {
    return fail('invalid_language')
  }
  if (!isSupportedLanguage(raw.sourceLanguage) || !isSupportedLanguage(raw.targetLanguage)) {
    return fail('invalid_language')
  }
  if (typeof raw.mode !== 'string' || !TRANSLATION_MODES.has(raw.mode)) {
    return fail('invalid_mode')
  }
  const message: TranslateTextMessage = {
    type: 'TRANSLATE_TEXT',
    text: raw.text,
    sourceLanguage: normalizeLanguage(raw.sourceLanguage, 'en'),
    targetLanguage: normalizeLanguage(raw.targetLanguage, 'ar'),
    mode: raw.mode as TranslateTextMessage['mode'],
  }
  if (raw.context && typeof raw.context === 'object' && raw.context !== null) {
    const ctx = raw.context as Record<string, unknown>
    const next: NonNullable<TranslateTextMessage['context']> = {
      mode: raw.mode as TranslateTextMessage['mode'],
    }
    if (ctx.segment_complete === true) next.segment_complete = true
    if (ctx.focus_out_completion === true) next.focus_out_completion = true
    if (next.segment_complete || next.focus_out_completion || next.mode) {
      message.context = next
    }
  }
  return ok(message)
}

function validateCorrectText(raw: Record<string, unknown>): ValidationResult<CorrectTextMessage> {
  if (!isNonEmptyBoundedString(raw.requestId, SECURITY_LIMITS.MAX_REQUEST_ID_LENGTH)) {
    return fail('invalid_request_id')
  }
  if (!isNonEmptyBoundedString(raw.text, SECURITY_LIMITS.MAX_CORRECTION_TEXT_LENGTH)) {
    return fail('invalid_text')
  }
  const message: CorrectTextMessage = {
    type: 'CORRECT_TEXT',
    requestId: raw.requestId.trim(),
    text: raw.text,
  }
  if (isBoundedString(raw.fieldType, SECURITY_LIMITS.MAX_FIELD_TYPE_LENGTH)) {
    message.fieldType = raw.fieldType
  }
  if (isBoundedString(raw.previousText, SECURITY_LIMITS.MAX_CORRECTION_TEXT_LENGTH)) {
    message.previousText = raw.previousText
  }
  if (raw.mode === 'practice') {
    message.mode = 'practice'
  }
  return ok(message)
}

function validateLocalizeExplanation(
  raw: Record<string, unknown>,
): ValidationResult<LocalizeExplanationMessage> {
  if (!isNonEmptyBoundedString(raw.requestId, SECURITY_LIMITS.MAX_REQUEST_ID_LENGTH)) {
    return fail('invalid_request_id')
  }
  if (!isUiLocaleCode(raw.locale)) {
    return fail('invalid_locale')
  }
  if (!validateRuleExplanation(raw.explanation)) {
    return fail('invalid_explanation')
  }
  const message: LocalizeExplanationMessage = {
    type: 'LOCALIZE_EXPLANATION',
    requestId: raw.requestId.trim(),
    locale: raw.locale,
    explanation: raw.explanation,
  }
  if (isBoundedString(raw.ruleVersion, 32)) {
    message.ruleVersion = raw.ruleVersion.trim()
  }
  return ok(message)
}

function validateCancelCorrect(raw: Record<string, unknown>): ValidationResult<CancelCorrectMessage> {
  if (!isBoundedString(raw.requestId, SECURITY_LIMITS.MAX_REQUEST_ID_LENGTH)) {
    return fail('invalid_request_id')
  }
  return ok({ type: 'CANCEL_CORRECT', requestId: raw.requestId.trim() })
}

function validateDeleteHistoryEntry(
  raw: Record<string, unknown>,
): ValidationResult<DeleteHistoryEntryMessage> {
  if (!isBoundedString(raw.id, SECURITY_LIMITS.MAX_HISTORY_ID_LENGTH)) {
    return fail('invalid_history_id')
  }
  return ok({ type: 'DELETE_HISTORY_ENTRY', id: raw.id.trim() })
}

function validateSetLearningProfile(
  raw: Record<string, unknown>,
): ValidationResult<SetLearningProfileMessage> {
  if (!isPlainObject(raw.patch)) return fail('invalid_patch')
  const patch = raw.patch
  const next: SetLearningProfileMessage['patch'] = {}
  if (isBoundedString(patch.learningLanguage, SECURITY_LIMITS.MAX_LANGUAGE_CODE_LENGTH)) {
    next.learningLanguage = patch.learningLanguage.trim()
  }
  if (patch.nativeLanguage === null) {
    next.nativeLanguage = null
  } else if (isBoundedString(patch.nativeLanguage, SECURITY_LIMITS.MAX_LANGUAGE_CODE_LENGTH)) {
    next.nativeLanguage = patch.nativeLanguage.trim()
  }
  if (patch.level === null) {
    next.level = null
  } else if (isLearningLevel(patch.level)) {
    next.level = patch.level
  }
  if (Array.isArray(patch.focusAreas)) {
    next.focusAreas = patch.focusAreas.filter(isLearningFocus)
  }
  const onboardingCompleted = readBoolean(patch.onboardingCompleted)
  if (onboardingCompleted !== undefined) next.onboardingCompleted = onboardingCompleted
  if (typeof patch.onboardingVersion === 'number' && Number.isFinite(patch.onboardingVersion)) {
    next.onboardingVersion = patch.onboardingVersion
  }
  if (patch.onboardingStep === null) {
    next.onboardingStep = null
  } else if (isOnboardingStep(patch.onboardingStep)) {
    next.onboardingStep = patch.onboardingStep
  }
  const setupPromptDismissed = readBoolean(patch.setupPromptDismissed)
  if (setupPromptDismissed !== undefined) next.setupPromptDismissed = setupPromptDismissed
  return ok({ type: 'SET_LEARNING_PROFILE', patch: next })
}

function validateSetOnboardingStep(
  raw: Record<string, unknown>,
): ValidationResult<import('./types.ts').SetOnboardingStepMessage> {
  if (raw.step === null) return ok({ type: 'SET_ONBOARDING_STEP', step: null })
  if (!isOnboardingStep(raw.step)) return fail('invalid_onboarding_step')
  return ok({ type: 'SET_ONBOARDING_STEP', step: raw.step })
}

function validateSavePracticeSession(
  raw: Record<string, unknown>,
): ValidationResult<import('./types.ts').SavePracticeSessionMessage> {
  if (!isPlainObject(raw.session)) return fail('invalid_session')
  const session = raw.session
  if (typeof session.id !== 'string' || typeof session.startedAt !== 'number') {
    return fail('invalid_session')
  }
  return ok({ type: 'SAVE_PRACTICE_SESSION', session: session as import('./types.ts').SavePracticeSessionMessage['session'] })
}

function validatePreviewDataImport(
  raw: Record<string, unknown>,
): ValidationResult<import('./types.ts').PreviewDataImportMessage> {
  if (typeof raw.raw !== 'string' || raw.raw.length === 0) return fail('invalid_import')
  if (raw.raw.length > 5_000_000) return fail('import_too_large')
  return ok({ type: 'PREVIEW_DATA_IMPORT', raw: raw.raw })
}

function validateImportUserData(
  raw: Record<string, unknown>,
): ValidationResult<import('./types.ts').ImportUserDataMessage> {
  if (typeof raw.raw !== 'string' || raw.raw.length === 0) return fail('invalid_import')
  if (raw.raw.length > 5_000_000) return fail('import_too_large')
  return ok({
    type: 'IMPORT_USER_DATA',
    raw: raw.raw,
    replaceProfile: raw.replaceProfile === true,
  })
}

export function validateRunCommandPayload(raw: unknown): ValidationResult<RunCommandMessage['operation']> {
  if (!isPlainObject(raw)) return fail('unknown_message')
  if (raw.type !== 'RUN_COMMAND') return fail('unknown_message')
  const validated = validateRunCommand(raw)
  if (!validated.ok) return validated
  return ok(validated.value.operation)
}

export function validateContentCommandType(raw: unknown): ValidationResult<OperationType> {
  if (!isPlainObject(raw)) return fail('unknown_message')
  const type = raw.type
  if (type === 'RUN_COMMAND') {
    const op = validateRunCommandPayload(raw)
    return op
  }
  if (type === 'DISPATCH_COMMAND') {
    if (!isPlainObject(raw.command)) return fail('invalid_command')
    const commandType = raw.command.type
    if (commandType === 'PIPELINE') return fail('pipeline_not_implemented')
    if (typeof commandType !== 'string' || !RUN_COMMAND_OPS.has(commandType)) {
      return fail('unsupported_operation')
    }
    return ok(commandType as OperationType)
  }
  return fail('unknown_message')
}

export { CORRECTION_MODES, RUN_COMMAND_OPS, TRANSLATION_MODES }
