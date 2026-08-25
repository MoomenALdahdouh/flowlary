import { BRAND } from '@flowlary/shared'
import { CommandRouter } from '../core/router/CommandRouter.ts'
import { stateManager } from '../core/state/StateManager.ts'
import { flowlaryStorage } from '../storage/index.ts'
import type {
  ExtensionRequest,
  ExtensionResponse,
  ExtensionStatus,
} from '../messaging/types.ts'
import { isExtensionRequest } from '../messaging/types.ts'
import { commandFromChromeCommand, sendCommandToActiveTab } from './commands.ts'
import { handleCheckWord } from './classify.ts'
import { handleTranslateText } from './translate.ts'
import { cancelCorrectRequest, handleCorrectText } from './correct.ts'

const router = new CommandRouter()

export function getRouter(): CommandRouter {
  return router
}

export function buildStatus(): ExtensionStatus {
  return {
    brand: BRAND,
    active: stateManager.isActive(),
    features: {
      correction: stateManager.correction.enabled,
      translation: stateManager.translation.shortcutEnabled,
      layout: stateManager.layout.autoEnabled,
    },
    translation: {
      liveEnabled: stateManager.translation.liveEnabled,
      shortcutEnabled: stateManager.translation.shortcutEnabled,
      sourceLanguage: stateManager.translation.sourceLanguage,
      targetLanguage: stateManager.translation.targetLanguage,
    },
    correction: {
      enabled: stateManager.correction.enabled,
      mode: stateManager.correction.mode,
      consentAccepted: stateManager.correction.consentAccepted,
      hasGroqKey: Boolean(stateManager.correction.groqApiKey.trim()),
    },
    version: BRAND.version,
  }
}

/**
 * Canonical command path:
 * chrome.commands / popup DISPATCH_COMMAND
 *   → service worker
 *   → tabs.sendMessage(RUN_COMMAND)
 *   → content CommandOrchestrator
 *   → CommandRouter
 *
 * The service worker never reads field text and never calls feature handlers.
 */
export async function handleMessage(
  message: unknown,
): Promise<ExtensionResponse | undefined> {
  if (!isExtensionRequest(message)) {
    return { ok: false, error: 'unknown_message' }
  }

  switch (message.type) {
    case 'GET_STATUS':
      return buildStatus()

    case 'SET_SETTINGS': {
      Object.assign(stateManager.settings, message.patch)
      await flowlaryStorage.set(flowlaryStorage.keys.settings, stateManager.settings)
      return buildStatus()
    }

    case 'SET_TRANSLATION': {
      Object.assign(stateManager.translation, message.patch)
      await flowlaryStorage.set(flowlaryStorage.keys.translation, stateManager.translation)
      return buildStatus()
    }

    case 'SET_CORRECTION': {
      Object.assign(stateManager.correction, message.patch)
      await flowlaryStorage.set(flowlaryStorage.keys.correction, {
        enabled: stateManager.correction.enabled,
        mode: stateManager.correction.mode,
        highlights: stateManager.correction.highlights,
        consentAccepted: stateManager.correction.consentAccepted,
      })
      if (message.patch.groqApiKey !== undefined) {
        await flowlaryStorage.set(`${flowlaryStorage.keys.correction}.groqKey`, message.patch.groqApiKey, 'local')
      }
      return buildStatus()
    }

    case 'CORRECT_TEXT':
      return handleCorrectText(message)

    case 'CANCEL_CORRECT':
      cancelCorrectRequest(message.requestId)
      return { ok: true }

    case 'PAUSE_TEMPORARILY': {
      const ms = message.ms ?? 60 * 60 * 1000
      stateManager.settings.pausedUntil = Date.now() + ms
      await flowlaryStorage.set(flowlaryStorage.keys.settings, stateManager.settings)
      return buildStatus()
    }

    case 'CAN_INTERVENE':
      return buildStatus()

    case 'NOTE_USAGE_ACTIVITY':
      return { ok: true }

    case 'CHECK_WORD':
      return handleCheckWord(message)

    case 'TRANSLATE_TEXT':
      return handleTranslateText(message)

    case 'ACTIVATE_LICENSE':
      return { ok: false, error: 'not_implemented' }

    case 'RUN_COMMAND':
    case 'DISPATCH_COMMAND': {
      const operation =
        message.type === 'RUN_COMMAND'
          ? message.operation
          : message.command.type
      if (operation !== 'TRANSLATE' && operation !== 'FIX_LAYOUT' && operation !== 'CORRECT') {
        return { ok: false, error: 'unsupported_operation' }
      }
      const sent = await sendCommandToActiveTab(operation)
      return { ok: sent === 'sent', error: sent === 'noop' ? 'no_tab' : undefined }
    }

    default:
      return { ok: false, error: 'unknown_message' }
  }
}

export function registerBackgroundListeners(): void {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    void handleMessage(message).then((response) => sendResponse(response))
    return true
  })

  chrome.runtime.onInstalled.addListener(() => {
    console.info('[Flowlary] installed', BRAND.version)
  })

  chrome.commands?.onCommand.addListener((command) => {
    const operation = commandFromChromeCommand(command)
    if (!operation) return
    void sendCommandToActiveTab(operation)
  })
}

registerBackgroundListeners()
