import type { ExtensionStatus } from '../messaging/types.ts'

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
        ? humanizeError((response as { error: string }).error)
        : 'Request failed.',
    )
  }
  return response as T
}

function humanizeError(code: string): string {
  switch (code) {
    case 'unknown_message':
      return 'Could not reach the extension background.'
    case 'no_tab':
      return 'Open a page with an editable field first.'
    default:
      return 'Something went wrong. Try again.'
  }
}

export type CorrectionPatch = Partial<{
  enabled: boolean
  mode: 'box' | 'direct'
  highlights: boolean
  consentAccepted: boolean
  groqApiKey: string
}>

export type TranslationPatch = Partial<{
  liveEnabled: boolean
  shortcutEnabled: boolean
  sourceLanguage: string
  targetLanguage: string
}>

export type LayoutPatch = Partial<{
  autoEnabled: boolean
  manualConversionEnabled: boolean
  directShortcutEnabled: boolean
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

export async function patchCorrection(patch: CorrectionPatch): Promise<ExtensionStatus> {
  return sendMessage<ExtensionStatus>({ type: 'SET_CORRECTION', patch })
}

export async function patchTranslation(patch: TranslationPatch): Promise<ExtensionStatus> {
  return sendMessage<ExtensionStatus>({ type: 'SET_TRANSLATION', patch })
}

export async function patchLayout(patch: LayoutPatch): Promise<ExtensionStatus> {
  return sendMessage<ExtensionStatus>({ type: 'SET_LAYOUT', patch })
}

export async function dispatchCommand(operation: 'TRANSLATE' | 'FIX_LAYOUT'): Promise<void> {
  await sendMessage({ type: 'RUN_COMMAND', operation })
}

export async function saveGroqKey(key: string): Promise<ExtensionStatus> {
  return patchCorrection({ groqApiKey: key.trim(), consentAccepted: true })
}

export async function removeGroqKey(): Promise<ExtensionStatus> {
  return patchCorrection({ groqApiKey: '', consentAccepted: false })
}
