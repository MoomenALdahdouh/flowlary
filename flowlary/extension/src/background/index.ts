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
    version: BRAND.version,
  }
}

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

    case 'ACTIVATE_LICENSE':
      return { ok: false, error: 'not_implemented' }

    case 'DISPATCH_COMMAND':
      return router.dispatch(message.command)

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
}

registerBackgroundListeners()
