import type { Command, CommandResult } from '@flowlary/shared'
import { BRAND } from '@flowlary/shared'

export type MessageType =
  | 'GET_STATUS'
  | 'SET_SETTINGS'
  | 'SET_TRANSLATION'
  | 'PAUSE_TEMPORARILY'
  | 'CAN_INTERVENE'
  | 'NOTE_USAGE_ACTIVITY'
  | 'ACTIVATE_LICENSE'
  | 'DISPATCH_COMMAND'
  | 'COMMAND_RESULT'
  | 'RUN_COMMAND'
  | 'CHECK_WORD'
  | 'TRANSLATE_TEXT'

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

export type ExtensionRequest =
  | GetStatusMessage
  | SetSettingsMessage
  | SetTranslationMessage
  | PauseTemporarilyMessage
  | CanInterveneMessage
  | NoteUsageMessage
  | ActivateLicenseMessage
  | DispatchCommandMessage
  | RunCommandMessage
  | CheckWordMessage
  | TranslateTextMessage

export type ExtensionResponse = ExtensionStatus | CommandResult | { ok: boolean; error?: string }

export function isExtensionRequest(value: unknown): value is ExtensionRequest {
  return (
    typeof value === 'object' &&
    value !== null &&
    'type' in value &&
    typeof (value as { type: unknown }).type === 'string'
  )
}
