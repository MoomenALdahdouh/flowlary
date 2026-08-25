import {
  isBoundedString,
  SECURITY_LIMITS,
  type OperationType,
} from '@flowlary/shared'
import type {
  ActivateLicenseMessage,
  CancelCorrectMessage,
  CheckWordMessage,
  ClearHistoryMessage,
  CorrectTextMessage,
  DeleteHistoryEntryMessage,
  DispatchCommandMessage,
  ExtensionRequest,
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
  'DISPATCH_COMMAND',
  'RUN_COMMAND',
  'CHECK_WORD',
  'TRANSLATE_TEXT',
  'CORRECT_TEXT',
  'CANCEL_CORRECT',
  'GET_HISTORY',
  'DELETE_HISTORY_ENTRY',
  'CLEAR_HISTORY',
])

const RUN_COMMAND_OPS = new Set<string>(['TRANSLATE', 'FIX_LAYOUT', 'CORRECT'])
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
    case 'RUN_COMMAND':
      return validateRunCommand(raw)
    case 'DISPATCH_COMMAND':
      return validateDispatchCommand(raw)
    case 'CHECK_WORD':
      return validateCheckWord(raw)
    case 'TRANSLATE_TEXT':
      return validateTranslateText(raw)
    case 'CORRECT_TEXT':
      return validateCorrectText(raw)
    case 'CANCEL_CORRECT':
      return validateCancelCorrect(raw)
    case 'DELETE_HISTORY_ENTRY':
      return validateDeleteHistoryEntry(raw)
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
  if (typeof patch.groqApiKey === 'string' && patch.groqApiKey.length <= SECURITY_LIMITS.MAX_GROQ_KEY_LENGTH) {
    next.groqApiKey = patch.groqApiKey.trim()
  }
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

function validateActivateLicense(raw: Record<string, unknown>): ValidationResult<ActivateLicenseMessage> {
  if (!isBoundedString(raw.licenseKey, SECURITY_LIMITS.MAX_LICENSE_KEY_LENGTH)) {
    return fail('invalid_license_key')
  }
  return ok({ type: 'ACTIVATE_LICENSE', licenseKey: raw.licenseKey.trim() })
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
  return ok({
    type: 'TRANSLATE_TEXT',
    text: raw.text,
    sourceLanguage: normalizeLanguage(raw.sourceLanguage, 'en'),
    targetLanguage: normalizeLanguage(raw.targetLanguage, 'ar'),
    mode: raw.mode as TranslateTextMessage['mode'],
  })
}

function validateCorrectText(raw: Record<string, unknown>): ValidationResult<CorrectTextMessage> {
  if (!isNonEmptyBoundedString(raw.requestId, SECURITY_LIMITS.MAX_REQUEST_ID_LENGTH)) {
    return fail('invalid_request_id')
  }
  if (!isNonEmptyBoundedString(raw.text, SECURITY_LIMITS.MAX_CORRECTION_TEXT_LENGTH)) {
    return fail('invalid_text')
  }
  if (!isNonEmptyBoundedString(raw.groqApiKey, SECURITY_LIMITS.MAX_GROQ_KEY_LENGTH)) {
    return fail('missing_api_key')
  }
  const message: CorrectTextMessage = {
    type: 'CORRECT_TEXT',
    requestId: raw.requestId.trim(),
    text: raw.text,
    groqApiKey: raw.groqApiKey.trim(),
  }
  if (isBoundedString(raw.fieldType, SECURITY_LIMITS.MAX_FIELD_TYPE_LENGTH)) {
    message.fieldType = raw.fieldType
  }
  if (isBoundedString(raw.previousText, SECURITY_LIMITS.MAX_CORRECTION_TEXT_LENGTH)) {
    message.previousText = raw.previousText
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
