import { BRAND } from '@flowlary/shared'
import { CommandRouter } from '../core/router/CommandRouter.ts'
import { stateManager } from '../core/state/StateManager.ts'
import type { ExtensionResponse, ExtensionStatus } from '../messaging/types.ts'
import { isTrustedExtensionSender } from '../messaging/sender.ts'
import { validateExtensionRequest } from '../messaging/validate.ts'
import { commandFromChromeCommand, sendCommandToActiveTab } from './commands.ts'
import { handleCheckWord } from './classify.ts'
import { handleTranslateText } from './translate.ts'
import { cancelCorrectRequest, handleCorrectText } from './correct.ts'
import {
  flowlaryStorage,
  getEntitlementPublicView,
  hydrateStateFromStorage,
  runStorageMigration,
  setCorrectionSettings,
  setLayoutSettings,
  setSettings,
  setTranslationSettings,
  getHistory,
  getHistoryStats,
  removeHistoryEntry,
  clearHistory,
  normalizeSettings,
  normalizeCorrection,
  normalizeTranslation,
  normalizeLayout,
} from '../storage/index.ts'
import { ensureHistoryInitialized } from '../storage/history/record.ts'
import { initializeFlowlaryCache } from '../storage/cache/index.ts'
import { isCorrectionAiReady } from '../features/correction/readiness.ts'

const router = new CommandRouter()

let startupPromise: Promise<void> | null = null

export function resetBackgroundStartupForTests(): void {
  startupPromise = null
}

export async function startupBackground(): Promise<void> {
  if (!startupPromise) {
    startupPromise = (async () => {
      await runStorageMigration()
      await hydrateStateFromStorage(flowlaryStorage)
      await ensureHistoryInitialized()
      await initializeFlowlaryCache(flowlaryStorage)
    })()
  }
  return startupPromise
}

export function getRouter(): CommandRouter {
  return router
}

export async function buildStatus(): Promise<ExtensionStatus> {
  const entitlement = await getEntitlementPublicView(flowlaryStorage)
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
      highlights: stateManager.correction.highlights,
      consentAccepted: stateManager.correction.consentAccepted,
      aiProvider: stateManager.correction.aiProvider,
      hasGroqKey: Boolean(stateManager.correction.groqApiKey.trim()),
      aiReady: isCorrectionAiReady(stateManager.correction),
    },
    layout: {
      autoEnabled: stateManager.layout.autoEnabled,
      manualConversionEnabled: stateManager.layout.manualConversionEnabled,
      directShortcutEnabled: stateManager.layout.directShortcutEnabled,
    },
    entitlement,
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
  await startupBackground()

  const validated = validateExtensionRequest(message)
  if (!validated.ok) {
    return { ok: false, error: validated.error }
  }

  switch (validated.value.type) {
    case 'GET_STATUS':
      return buildStatus()

    case 'SET_SETTINGS': {
      stateManager.settings = normalizeSettings({
        ...stateManager.settings,
        ...validated.value.patch,
      })
      await setSettings(flowlaryStorage, stateManager.settings)
      return buildStatus()
    }

    case 'SET_TRANSLATION': {
      stateManager.translation = normalizeTranslation({
        ...stateManager.translation,
        ...validated.value.patch,
      })
      await setTranslationSettings(flowlaryStorage, stateManager.translation)
      return buildStatus()
    }

    case 'SET_CORRECTION': {
      stateManager.correction = normalizeCorrection(
        { ...stateManager.correction, ...validated.value.patch },
        validated.value.patch.groqApiKey ?? stateManager.correction.groqApiKey,
      )
      await setCorrectionSettings(flowlaryStorage, stateManager.correction)
      return buildStatus()
    }

    case 'SET_LAYOUT': {
      stateManager.layout = normalizeLayout({
        ...stateManager.layout,
        ...validated.value.patch,
      })
      await setLayoutSettings(flowlaryStorage, stateManager.layout)
      return buildStatus()
    }

    case 'CORRECT_TEXT':
      return handleCorrectText(validated.value)

    case 'CANCEL_CORRECT':
      cancelCorrectRequest(validated.value.requestId)
      return { ok: true }

    case 'PAUSE_TEMPORARILY': {
      const ms = validated.value.ms ?? 60 * 60 * 1000
      stateManager.settings.pausedUntil = Date.now() + ms
      await setSettings(flowlaryStorage, stateManager.settings)
      return buildStatus()
    }

    case 'CAN_INTERVENE':
      return buildStatus()

    case 'NOTE_USAGE_ACTIVITY':
      return { ok: true }

    case 'CHECK_WORD':
      return handleCheckWord(validated.value)

    case 'TRANSLATE_TEXT':
      return handleTranslateText(validated.value)

    case 'ACTIVATE_LICENSE':
      return { ok: false, error: 'not_implemented' }

    case 'GET_HISTORY': {
      const [entries, stats] = await Promise.all([
        getHistory(flowlaryStorage),
        getHistoryStats(flowlaryStorage),
      ])
      return { entries, stats }
    }

    case 'DELETE_HISTORY_ENTRY': {
      const removed = await removeHistoryEntry(flowlaryStorage, validated.value.id)
      if (!removed) return { ok: false, error: 'not_found' }
      const [entries, stats] = await Promise.all([
        getHistory(flowlaryStorage),
        getHistoryStats(flowlaryStorage),
      ])
      return { entries, stats }
    }

    case 'CLEAR_HISTORY': {
      await clearHistory(flowlaryStorage)
      return {
        entries: [],
        stats: { total: 0, byOperation: { CORRECT: 0, TRANSLATE: 0, FIX_LAYOUT: 0 } },
      }
    }

    case 'RUN_COMMAND':
    case 'DISPATCH_COMMAND': {
      const operation =
        validated.value.type === 'RUN_COMMAND'
          ? validated.value.operation
          : validated.value.command.type
      const sent = await sendCommandToActiveTab(operation)
      return { ok: sent === 'sent', error: sent === 'noop' ? 'no_tab' : undefined }
    }

    default:
      return { ok: false, error: 'unknown_message' }
  }
}

export function registerBackgroundListeners(): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isTrustedExtensionSender(sender)) {
      sendResponse({ ok: false, error: 'untrusted_sender' } satisfies ExtensionResponse)
      return false
    }
    void handleMessage(message).then((response) => sendResponse(response))
    return true
  })

  chrome.runtime.onInstalled.addListener(() => {
    console.info('[Flowlary] installed', BRAND.version)
    void startupBackground()
  })

  chrome.commands?.onCommand.addListener((command) => {
    const operation = commandFromChromeCommand(command)
    if (!operation) return
    void sendCommandToActiveTab(operation)
  })

  void startupBackground()
}

registerBackgroundListeners()
