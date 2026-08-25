import type { Command, CommandResult, HistoryEntry, HistoryStats } from '@flowlary/shared'
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
  | 'DISPATCH_COMMAND'
  | 'COMMAND_RESULT'
  | 'RUN_COMMAND'
  | 'CHECK_WORD'
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
    hasGroqKey: boolean
  }
  layout: {
    autoEnabled: boolean
    manualConversionEnabled: boolean
    directShortcutEnabled: boolean
  }
  entitlement: {
    status: 'trial' | 'free' | 'pro' | 'unknown'
    hasLicenseKey: boolean
    isPro: boolean
    inTrial: boolean
    remainingMs: number
  }
  version: string
}

export type GetStatusMessage = { type: 'GET_STATUS' }
export type SetSettingsMessage = { type: 'SET_SETTINGS'; patch: Record<string, unknown> }
export type SetTranslationMessage = {
  type: 'SET_TRANSLATION'
  patch: Partial<{
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
    groqApiKey: string
  }>
}
export type SetLayoutMessage = {
  type: 'SET_LAYOUT'
  patch: Partial<{
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
  groqApiKey: string
}
export type CancelCorrectMessage = { type: 'CANCEL_CORRECT'; requestId: string }
export type PauseTemporarilyMessage = { type: 'PAUSE_TEMPORARILY'; ms?: number }
export type CanInterveneMessage = { type: 'CAN_INTERVENE' }
export type NoteUsageMessage = { type: 'NOTE_USAGE_ACTIVITY' }
export type ActivateLicenseMessage = { type: 'ACTIVATE_LICENSE'; licenseKey: string }
export type DispatchCommandMessage = { type: 'DISPATCH_COMMAND'; command: Command }
export type CommandResultMessage = { type: 'COMMAND_RESULT'; result: CommandResult }
export type RunCommandMessage = {
  type: 'RUN_COMMAND'
  operation: 'TRANSLATE' | 'FIX_LAYOUT' | 'CORRECT'
}
export type CheckWordMessage = {
  type: 'CHECK_WORD'
  word: string
  context?: string
  sourceLayout?: string
  candidateLayouts?: string[]
}
export type TranslateTextMessage = {
  type: 'TRANSLATE_TEXT'
  text: string
  sourceLanguage: string
  targetLanguage: string
  mode: 'shortcut' | 'live'
}
export type GetHistoryMessage = { type: 'GET_HISTORY' }
export type DeleteHistoryEntryMessage = { type: 'DELETE_HISTORY_ENTRY'; id: string }
export type ClearHistoryMessage = { type: 'CLEAR_HISTORY' }

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
  | DispatchCommandMessage
  | RunCommandMessage
  | CheckWordMessage
  | TranslateTextMessage
  | CorrectTextMessage
  | CancelCorrectMessage
  | GetHistoryMessage
  | DeleteHistoryEntryMessage
  | ClearHistoryMessage

export type ExtensionResponse =
  | ExtensionStatus
  | CommandResult
  | HistoryResponse
  | { ok: boolean; error?: string }

export function isExtensionRequest(value: unknown): value is ExtensionRequest {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof (value as { type: unknown }).type === 'string'
  )
}
