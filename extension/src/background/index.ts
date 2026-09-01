import {
  BRAND,
  adjustRecommendationPatternForProgression,
  computeAllTargetPracticeProgressions,
  deprioritizeStablePatterns,
} from '@flowlary/shared'
import { listPracticeRecurringTargets } from '../storage/learning/practice/targetSelection.ts'
import { CommandRouter } from '../core/router/CommandRouter.ts'
import { stateManager } from '../core/state/StateManager.ts'
import { isExcludedHost } from '../core/safety/domains.ts'
import {
  applyUserWritingPolicy,
  applyUserPolicyToMemory,
  extractPolicyPatch,
  policyPatchHasKeys,
  resolveWritingPolicy,
} from '../core/policy/writingPolicy.ts'
import type { ExtensionResponse, ExtensionStatus } from '../messaging/types.ts'
import { isTrustedExtensionSender } from '../messaging/sender.ts'
import { validateExtensionRequest } from '../messaging/validate.ts'
import { commandFromChromeCommand, sendCommandToActiveTab } from './commands.ts'
import { handleCheckWord } from './classify.ts'
import { cancelRankHypotheses, handleRankHypotheses } from './rankHypotheses.ts'
import { cancelReviewWriting, handleReviewWriting } from './reviewWriting.ts'
import { handleTranslateText } from './translate.ts'
import { cancelCorrectRequest, handleCorrectText } from './correct.ts'
import { handleLocalizeExplanation } from './explainLocalize.ts'
import {
  flowlaryStorage,
  getEntitlementPublicView,
  hydrateStateFromStorage,
  setCorrectionSettings,
  setLayoutSettings,
  setLayoutProfile,
  getLayoutProfile,
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
  clearLearningEvents,
  ensureLearningEventsInitialized,
  getLearningEventService,
  computeProgressMetrics,
  computePracticeRecommendation,
  attachPersonalizationToProgress,
  getPracticeSessionStore,
  normalizePracticeSessionStore,
  computeDataSummary,
  serializeFlowlaryExport,
  parseExportJson,
  previewImport,
  importUserData,
  resetLocalFlowlaryData,
  restoreActiveAccountFromSession,
} from '../storage/index.ts'
import { runStorageMigration } from '../storage/migration/runner.ts'
import {
  buildLearningRuntimeView,
  completeOnboarding,
  dismissLearningSetupPrompt,
  ensureLearningProfile,
  formatLearningSummary,
  getLearningInstallMeta,
  getLearningProfile,
  patchLearningProfile,
  resetLearningProfile,
  restartLearningOnboarding,
  setLearningInstallKind,
  setOnboardingStep,
} from '../storage/learning/index.ts'
import { toUserLayoutProfile } from '../features/layout/profile/index.ts'
import { ensureHistoryInitialized } from '../storage/history/record.ts'
import { initializeFlowlaryCache } from '../storage/cache/index.ts'
import { readAccountSession, loginAccount, registerAccount, logoutAccount, syncServerEntitlement, maybeSyncServerEntitlement, readServerEntitlementCache, importWebAccountSession } from '../config/accountAuth.ts'
import { markApiHealthOk, onApiHealthRecovered, probeApiHealth } from '../config/apiHealth.ts'
import { isCorrectionAiReady } from '../features/correction/readiness.ts'
import { retireByokIfNeeded } from '../storage/retireByok.ts'
import { readStoredString } from '../storage/schemas.ts'
import { STORAGE_KEYS } from '@flowlary/shared'
import { getFirstWinState, setFirstWinState } from '../storage/ui/firstWin.ts'
import { resolveDailyLearningBrief } from '../storage/learning/brief/resolveDailyBrief.ts'
import { resolveFullLearningReport } from '../storage/learning/report/resolveFullLearningReport.ts'
import { resolveLearningCoach } from '../storage/learning/coach/resolveLearningCoach.ts'
import { pushLocalLearningStateToRemote } from '../storage/learning/events/remoteSync.ts'
import {
  dismissExtensionFeedbackPrompt,
  featureForCommand,
  fetchFeedbackEligibility,
  markExtensionPromptShown,
  markFirstWinCompletedRemote,
  recordFeedbackMeaningfulUse,
  submitExtensionFeedback,
} from '../feedback/remoteApi.ts'

const router = new CommandRouter()

const DASHBOARD_PAGE = 'src/dashboard/index.html'

/** Inlined for the service worker — must not import popup/dashboard bundles (no `document`). */
function buildDashboardUrl(section: string, practiceTargetPatternId?: string): string {
  let hash = section === 'overview' ? 'overview' : section
  if (section === 'practice' && practiceTargetPatternId?.trim()) {
    hash = `practice?target=${encodeURIComponent(practiceTargetPatternId.trim())}`
  }
  return `${chrome.runtime.getURL(DASHBOARD_PAGE)}#${hash}`
}

let startupPromise: Promise<void> | null = null

export function resetBackgroundStartupForTests(): void {
  startupPromise = null
}

export async function startupBackground(): Promise<void> {
  if (!startupPromise) {
    startupPromise = (async () => {
      await runStorageMigration()
      await restoreActiveAccountFromSession(flowlaryStorage)
      await hydrateStateFromStorage(flowlaryStorage)
      await retireByokIfNeeded(flowlaryStorage)
      await hydrateStateFromStorage(flowlaryStorage)
      await ensureLearningProfile(flowlaryStorage)
      await ensureLearningEventsInitialized(flowlaryStorage)
      await ensureHistoryInitialized()
      await initializeFlowlaryCache(flowlaryStorage)
      await maybeSyncServerEntitlement(flowlaryStorage)
    })()
  }
  return startupPromise
}

export function getRouter(): CommandRouter {
  return router
}

async function resolveActivePageHost(): Promise<string | null> {
  if (typeof chrome === 'undefined' || !chrome.tabs?.query) return null
  try {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
    const url = tabs[0]?.url
    if (!url) return null
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.hostname
  } catch {
    return null
  }
}

export async function buildStatus(options?: { forceHealthProbe?: boolean }): Promise<ExtensionStatus> {
  const localEntitlement = await getEntitlementPublicView(flowlaryStorage)
  const accountSession = await readAccountSession(flowlaryStorage)
  const server = accountSession ? await readServerEntitlementCache(flowlaryStorage) : null
  const serverPlan = readStoredString(await flowlaryStorage.get(STORAGE_KEYS.authAccountPlan, 'local'))
  const apiHealth = await probeApiHealth({ force: options?.forceHealthProbe })
  const [learningProfile, learningInstall] = await Promise.all([
    getLearningProfile(flowlaryStorage),
    getLearningInstallMeta(flowlaryStorage),
  ])
  const learningView = buildLearningRuntimeView(learningProfile, learningInstall)
  const pageHostname = await resolveActivePageHost()
  const pageExcluded = pageHostname
    ? isExcludedHost(pageHostname, stateManager.settings.excludedDomains)
    : false
  const firstWin = await getFirstWinState(flowlaryStorage)
  const entitlement = accountSession
    ? {
        status: (server?.isPro || server?.studentProActive
          ? 'pro'
          : server?.inTrial
            ? 'trial'
            : server?.plan === 'free' || server?.plan === 'trial' || server?.plan === 'pro'
              ? server.plan
              : 'unknown') as 'trial' | 'free' | 'pro' | 'unknown',
        hasLicenseKey: false,
        isPro: server?.isPro === true,
        inTrial: server?.inTrial === true && server?.isPro !== true,
        studentProActive: server?.studentProActive === true,
        studentProExpiresAt: server?.studentProExpiresAt ?? null,
        trialEndsAt: server?.trialEndsAt ?? null,
        remainingMs: server?.remainingMs ?? server?.creditsRemaining ?? 0,
        creditsRemaining: server?.creditsRemaining ?? 0,
        creditsUsed: server?.creditsUsed ?? 0,
        dailyLimit: server?.dailyLimit ?? 0,
        resetAt: server?.resetAt ?? 0,
        monthlyCreditsUsed: server?.monthlyCreditsUsed ?? 0,
        monthlySoftCap: server?.monthlySoftCap ?? null,
        capabilities: server?.capabilities ?? [],
      }
    : {
        ...localEntitlement,
        isPro: false,
        studentProActive: false,
        studentProExpiresAt: null,
        status: 'unknown' as const,
        trialEndsAt: null,
        remainingMs: 0,
        creditsRemaining: 0,
        creditsUsed: 0,
        dailyLimit: 0,
        resetAt: 0,
        monthlyCreditsUsed: 0,
        monthlySoftCap: null,
        capabilities: [],
      }
  return {
    brand: BRAND,
    active: stateManager.isActive(),
    features: {
      correction: stateManager.correction.enabled,
      translation: stateManager.translation.shortcutEnabled,
      layout: stateManager.layout.autoEnabled,
    },
    translation: {
      mode: stateManager.translation.mode,
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
      aiReady: isCorrectionAiReady(stateManager.correction),
    },
    layout: {
      mode: stateManager.layout.mode,
      autoEnabled: stateManager.layout.autoEnabled,
      manualConversionEnabled: stateManager.layout.manualConversionEnabled,
      directShortcutEnabled: stateManager.layout.directShortcutEnabled,
      sourceLayout: stateManager.layout.sourceLayout,
      targetLayouts: [...stateManager.layout.targetLayouts],
    },
    writingPolicy: resolveWritingPolicy(),
    excludedDomains: [...stateManager.settings.excludedDomains],
    pageHostname,
    pageExcluded,
    learning: {
      onboardingCompleted: learningProfile.onboardingCompleted,
      showFullOnboarding: learningView.showFullOnboarding,
      showSetupPrompt: learningView.showSetupPrompt,
      onboardingStep: learningProfile.onboardingStep ?? null,
      summary: learningProfile.onboardingCompleted ? formatLearningSummary(learningProfile) : null,
    },
    entitlement,
    account: {
      signedIn: Boolean(accountSession),
      accountId: accountSession?.accountId ?? null,
      email: accountSession?.email ?? null,
      serverPlan: serverPlan || server?.plan || null,
      billingAvailable: server?.billingAvailable === true,
      subscriptionStatus: server?.subscriptionStatus ?? null,
      cancelAtPeriodEnd: server?.cancelAtPeriodEnd === true,
      paymentFailed: server?.paymentFailed === true,
      currentPeriodEnd: server?.currentPeriodEnd ?? null,
    },
    apiHealth,
    version: BRAND.version,
    firstWin: {
      completed: firstWin.completed,
      localSuccess: firstWin.localSuccess,
      aiSuccess: firstWin.aiSuccess,
    },
  }
}

type TabCommand = 'TRANSLATE' | 'FIX_LAYOUT' | 'CORRECT' | 'SPEED_BOX'

/**
 * Shared path for popup DISPATCH_COMMAND and chrome.commands shortcuts.
 * Marks first-win only after the content script reports handlerExecuted.
 */
export async function runCommandOnActiveTab(
  operation: TabCommand,
): Promise<{ ok: boolean; error?: string }> {
  const result = await sendCommandToActiveTab(operation)
  if (!result.sent) {
    return { ok: false, error: result.reason === 'no_tab' ? 'no_tab' : 'command_failed' }
  }
  if (result.handlerExecuted) {
    if (operation === 'FIX_LAYOUT' || operation === 'SPEED_BOX') {
      await setFirstWinState(flowlaryStorage, { localSuccess: true })
    } else if (operation === 'CORRECT' || operation === 'TRANSLATE') {
      await setFirstWinState(flowlaryStorage, { aiSuccess: true })
    }
  }
  return {
    ok: result.handlerExecuted,
    error: result.handlerExecuted ? undefined : (result.reason ?? 'command_failed'),
  }
}

async function persistProjectedWritingState(): Promise<void> {
  await setSettings(flowlaryStorage, stateManager.settings)
  await setCorrectionSettings(flowlaryStorage, stateManager.correction)
  await setTranslationSettings(flowlaryStorage, stateManager.translation)
  await setLayoutSettings(flowlaryStorage, stateManager.layout)
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
      await maybeSyncServerEntitlement(flowlaryStorage)
      return buildStatus({ forceHealthProbe: true })

    case 'SET_SETTINGS': {
      const policyPatch = extractPolicyPatch(validated.value.patch as Record<string, unknown>)
      stateManager.settings = normalizeSettings({
        ...stateManager.settings,
        ...validated.value.patch,
      })
      if (policyPatchHasKeys(policyPatch)) {
        applyUserWritingPolicy(policyPatch)
      } else {
        applyUserPolicyToMemory(resolveWritingPolicy())
      }
      await persistProjectedWritingState()
      return buildStatus()
    }

    case 'SET_TRANSLATION': {
      const patch = validated.value.patch
      if (typeof patch.liveEnabled === 'boolean') {
        applyUserWritingPolicy({ arabicToEnglishMode: patch.liveEnabled })
      }
      if (patch.mode === 'box') applyUserWritingPolicy({ helpStyle: 'suggestions' })
      if (patch.mode === 'direct') applyUserWritingPolicy({ helpStyle: 'auto' })
      stateManager.translation = normalizeTranslation({
        ...stateManager.translation,
        ...patch,
        liveEnabled: stateManager.translation.liveEnabled,
        mode: stateManager.translation.mode,
      })
      await persistProjectedWritingState()
      return buildStatus()
    }

    case 'SET_CORRECTION': {
      const patch = validated.value.patch
      if (typeof patch.enabled === 'boolean') {
        applyUserWritingPolicy({ improveEnglish: patch.enabled })
      }
      if (patch.mode === 'box') applyUserWritingPolicy({ helpStyle: 'suggestions' })
      if (patch.mode === 'direct') applyUserWritingPolicy({ helpStyle: 'auto' })
      stateManager.correction = normalizeCorrection({
        ...stateManager.correction,
        ...patch,
        enabled: stateManager.correction.enabled,
        mode: stateManager.correction.mode,
      })
      await persistProjectedWritingState()
      return buildStatus()
    }

    case 'SET_LAYOUT': {
      const patch = validated.value.patch
      if (typeof patch.autoEnabled === 'boolean') {
        applyUserWritingPolicy({ fixWrongTyping: patch.autoEnabled })
      }
      if (patch.mode === 'box') applyUserWritingPolicy({ helpStyle: 'suggestions' })
      if (patch.mode === 'direct') applyUserWritingPolicy({ helpStyle: 'auto' })
      stateManager.layout = normalizeLayout({
        ...stateManager.layout,
        ...patch,
        autoEnabled: stateManager.layout.autoEnabled,
        mode: stateManager.layout.mode,
      })
      await persistProjectedWritingState()
      if (
        validated.value.patch.sourceLayout != null ||
        validated.value.patch.targetLayouts != null
      ) {
        const layoutProfile = toUserLayoutProfile(
          stateManager.layout.sourceLayout,
          stateManager.layout.targetLayouts,
        )
        const existingProfile = await getLayoutProfile(flowlaryStorage)
        await setLayoutProfile(flowlaryStorage, {
          layoutProfile,
          personalExceptions: existingProfile.personalExceptions,
          events: existingProfile.events,
        })
      }
      return buildStatus()
    }

    case 'CORRECT_TEXT':
      return handleCorrectText(validated.value)

    case 'LOCALIZE_EXPLANATION':
      return handleLocalizeExplanation(validated.value)

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

    case 'RANK_HYPOTHESES':
      return handleRankHypotheses(validated.value.packet)

    case 'CANCEL_RANK_HYPOTHESES':
      cancelRankHypotheses(validated.value.cycleId)
      return { ok: true }

    case 'REVIEW_WRITING':
      return handleReviewWriting(validated.value.packet)

    case 'CANCEL_REVIEW_WRITING':
      cancelReviewWriting(validated.value.cycleId)
      return { ok: true }

    case 'TRANSLATE_TEXT':
      return handleTranslateText(validated.value)

    case 'ACTIVATE_LICENSE':
      return { ok: false, error: 'not_implemented' }

    case 'ACCOUNT_LOGIN': {
      try {
        await loginAccount(flowlaryStorage, validated.value.email, validated.value.password)
        await syncServerEntitlement(flowlaryStorage)
        return buildStatus()
      } catch (err) {
        const code = err instanceof Error ? err.message : 'account_login_failed'
        return { ok: false, error: code }
      }
    }

    case 'ACCOUNT_REGISTER': {
      try {
        await registerAccount(flowlaryStorage, validated.value.email, validated.value.password)
        await syncServerEntitlement(flowlaryStorage)
        return buildStatus()
      } catch (err) {
        const code = err instanceof Error ? err.message : 'account_register_failed'
        return { ok: false, error: code }
      }
    }

    case 'ACCOUNT_LOGOUT': {
      await logoutAccount(flowlaryStorage)
      return buildStatus()
    }

    case 'ACCOUNT_SYNC': {
      await syncServerEntitlement(flowlaryStorage)
      return buildStatus()
    }

    case 'ACCOUNT_IMPORT_SESSION': {
      try {
        await importWebAccountSession(
          flowlaryStorage,
          {
            accessToken: validated.value.accessToken,
            refreshToken: validated.value.refreshToken,
            sessionId: validated.value.sessionId,
            accountId: validated.value.accountId,
            email: validated.value.email,
            expiresAt: validated.value.expiresAt,
          },
          validated.value.account,
          { force: validated.value.force === true },
        )
        await syncServerEntitlement(flowlaryStorage)
        try {
          await ensureLearningEventsInitialized(flowlaryStorage)
        } catch {
          /* best-effort canonical learning pull after web import */
        }
        return buildStatus()
      } catch (err) {
        const code = err instanceof Error ? err.message : 'account_import_failed'
        return { ok: false, error: code }
      }
    }

    case 'OPEN_DASHBOARD': {
      const section = validated.value.section ?? 'practice'
      const url = buildDashboardUrl(section, validated.value.practiceTargetPatternId)
      if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
        await chrome.tabs.create({ url })
      }
      return { ok: true }
    }

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

    case 'GET_LEARNING': {
      const profile = await getLearningProfile(flowlaryStorage)
      const installMeta = await getLearningInstallMeta(flowlaryStorage)
      const view = buildLearningRuntimeView(profile, installMeta)
      return { profile, showFullOnboarding: view.showFullOnboarding, showSetupPrompt: view.showSetupPrompt }
    }

    case 'SET_LEARNING_PROFILE': {
      const profile = await patchLearningProfile(flowlaryStorage, validated.value.patch)
      const installMeta = await getLearningInstallMeta(flowlaryStorage)
      const view = buildLearningRuntimeView(profile, installMeta)
      return { profile, showFullOnboarding: view.showFullOnboarding, showSetupPrompt: view.showSetupPrompt }
    }

    case 'RESET_LEARNING_PROFILE': {
      const profile = await resetLearningProfile(flowlaryStorage)
      const installMeta = await getLearningInstallMeta(flowlaryStorage)
      const view = buildLearningRuntimeView(profile, installMeta)
      return { profile, showFullOnboarding: view.showFullOnboarding, showSetupPrompt: view.showSetupPrompt }
    }

    case 'COMPLETE_ONBOARDING': {
      const profile = await completeOnboarding(flowlaryStorage)
      const installMeta = await getLearningInstallMeta(flowlaryStorage)
      const view = buildLearningRuntimeView(profile, installMeta)
      return { profile, showFullOnboarding: view.showFullOnboarding, showSetupPrompt: view.showSetupPrompt }
    }

    case 'SET_ONBOARDING_STEP': {
      const profile = await setOnboardingStep(flowlaryStorage, validated.value.step)
      const installMeta = await getLearningInstallMeta(flowlaryStorage)
      const view = buildLearningRuntimeView(profile, installMeta)
      return { profile, showFullOnboarding: view.showFullOnboarding, showSetupPrompt: view.showSetupPrompt }
    }

    case 'DISMISS_LEARNING_SETUP': {
      const profile = await dismissLearningSetupPrompt(flowlaryStorage)
      const installMeta = await getLearningInstallMeta(flowlaryStorage)
      const view = buildLearningRuntimeView(profile, installMeta)
      return { profile, showFullOnboarding: view.showFullOnboarding, showSetupPrompt: view.showSetupPrompt }
    }

    case 'RESTART_LEARNING_ONBOARDING': {
      const profile = await restartLearningOnboarding(flowlaryStorage)
      const installMeta = await getLearningInstallMeta(flowlaryStorage)
      const view = buildLearningRuntimeView(profile, installMeta)
      return { profile, showFullOnboarding: view.showFullOnboarding, showSetupPrompt: view.showSetupPrompt }
    }

    case 'GET_PROGRESS': {
      await ensureLearningEventsInitialized(flowlaryStorage)
      const store = await getLearningEventService(flowlaryStorage).getStore()
      const practiceSessions = await getPracticeSessionStore(flowlaryStorage).list()
      const sessionStore = normalizePracticeSessionStore({
        version: 1,
        sessions: practiceSessions,
      })
      const metrics = computeProgressMetrics(store, sessionStore)
      const profile = await getLearningProfile(flowlaryStorage)
      return attachPersonalizationToProgress(metrics, profile, store.events)
    }

    case 'GET_DAILY_BRIEF': {
      return resolveDailyLearningBrief(flowlaryStorage)
    }

    case 'GET_FULL_LEARNING_REPORT': {
      return resolveFullLearningReport(flowlaryStorage)
    }

    case 'ASK_LEARNING_COACH': {
      const coachMessage = validated.value as import('../messaging/types.ts').AskLearningCoachMessage
      return resolveLearningCoach(flowlaryStorage, coachMessage.mode, coachMessage.question ?? null)
    }

    case 'CLEAR_LEARNING_EVENTS': {
      await clearLearningEvents(flowlaryStorage)
      const store = await getLearningEventService(flowlaryStorage).getStore()
      const metrics = computeProgressMetrics(store, { version: 1, sessions: [] })
      const profile = await getLearningProfile(flowlaryStorage)
      return attachPersonalizationToProgress(metrics, profile, store.events)
    }

    case 'GET_PRACTICE_HOME': {
      await ensureLearningEventsInitialized(flowlaryStorage)
      const store = await getLearningEventService(flowlaryStorage).getStore()
      const profile = await getLearningProfile(flowlaryStorage)
      const baseRecommendation = computePracticeRecommendation(store.events, Date.now(), profile.focusAreas)
      const recurringTargets = listPracticeRecurringTargets(store.events)
      const sessions = await getPracticeSessionStore(flowlaryStorage).list()
      const progressions = computeAllTargetPracticeProgressions(recurringTargets, store.events, sessions)
      const filteredTargets = deprioritizeStablePatterns(recurringTargets, progressions)
      const adjusted = adjustRecommendationPatternForProgression(
        baseRecommendation,
        progressions,
        filteredTargets,
      )
      const recommendation =
        baseRecommendation.state === 'ready' && adjusted.pattern
          ? { ...baseRecommendation, focus: adjusted.focus ?? baseRecommendation.focus, pattern: adjusted.pattern }
          : baseRecommendation.state === 'ready' && !adjusted.pattern && adjusted.focus
            ? { ...baseRecommendation, focus: adjusted.focus, pattern: undefined }
            : baseRecommendation
      return {
        recommendation,
        eventCount: store.events.filter((event) => event.source === 'writing').length,
        sessionsCompleted: sessions.filter((session) => session.status === 'completed').length,
        recurringTargets: filteredTargets,
        targetProgressions: progressions,
      }
    }

    case 'SAVE_PRACTICE_SESSION': {
      const session = validated.value.session
      await getPracticeSessionStore(flowlaryStorage).saveSession(session)
      return { ok: true }
    }

    case 'GET_DATA_SUMMARY': {
      return computeDataSummary(flowlaryStorage)
    }

    case 'EXPORT_USER_DATA': {
      try {
        const server = await readServerEntitlementCache(flowlaryStorage)
        const caps = server?.capabilities ?? []
        if (!caps.includes('learning.export')) {
          return { ok: false, error: 'capability_denied' }
        }
        const json = await serializeFlowlaryExport(flowlaryStorage)
        return { ok: true, json }
      } catch {
        return { ok: false, error: 'export_failed' }
      }
    }

    case 'PREVIEW_DATA_IMPORT': {
      try {
        const server = await readServerEntitlementCache(flowlaryStorage)
        const caps = server?.capabilities ?? []
        if (!caps.includes('learning.import')) {
          return { ok: false, error: 'capability_denied' }
        }
        const payload = parseExportJson(validated.value.raw)
        return { ok: true, preview: previewImport(payload) }
      } catch (error) {
        const code = error instanceof Error ? error.message : 'import_invalid'
        return { ok: false, error: code }
      }
    }

    case 'IMPORT_USER_DATA': {
      try {
        const server = await readServerEntitlementCache(flowlaryStorage)
        const caps = server?.capabilities ?? []
        if (!caps.includes('learning.import')) {
          return { ok: false, error: 'capability_denied' }
        }
        const payload = parseExportJson(validated.value.raw)
        const result = await importUserData(flowlaryStorage, payload, {
          replaceProfile: validated.value.replaceProfile,
        })
        void pushLocalLearningStateToRemote(flowlaryStorage)
        return { ok: true, result }
      } catch (error) {
        const code = error instanceof Error ? error.message : 'import_failed'
        return { ok: false, error: code }
      }
    }

    case 'RESET_FLOWLARY_LOCAL': {
      await resetLocalFlowlaryData(flowlaryStorage)
      await hydrateStateFromStorage(flowlaryStorage)
      return buildStatus()
    }

    case 'RUN_COMMAND':
    case 'DISPATCH_COMMAND': {
      const operation =
        validated.value.type === 'RUN_COMMAND'
          ? validated.value.operation
          : validated.value.command.type
      const result = await runCommandOnActiveTab(operation)
      if (result.handlerExecuted) {
        void recordFeedbackMeaningfulUse(flowlaryStorage, featureForCommand(operation))
      }
      return result
    }

    case 'FEEDBACK_ELIGIBILITY': {
      const eligibility = await fetchFeedbackEligibility(flowlaryStorage)
      return { ok: true, eligiblePrompts: eligibility?.eligiblePrompts ?? [] }
    }

    case 'FEEDBACK_DISMISS': {
      const okDismiss = await dismissExtensionFeedbackPrompt(
        flowlaryStorage,
        validated.value.promptId,
        validated.value.action,
      )
      return okDismiss ? { ok: true } : { ok: false, error: 'feedback_dismiss_failed' }
    }

    case 'FEEDBACK_SUBMIT': {
      const okSubmit = await submitExtensionFeedback(flowlaryStorage, validated.value.payload)
      return okSubmit ? { ok: true } : { ok: false, error: 'feedback_submit_failed' }
    }

    case 'FEEDBACK_PROMPT_SHOWN': {
      await markExtensionPromptShown(flowlaryStorage, validated.value.promptId)
      return { ok: true }
    }

    case 'MARK_FIRST_WIN': {
      await setFirstWinState(flowlaryStorage, validated.value.patch)
      void markFirstWinCompletedRemote(flowlaryStorage)
      return buildStatus()
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
    void handleMessage(message)
      .then((response) => sendResponse(response))
      .catch((err) => {
        console.error('[Flowlary] handleMessage failed', err)
        sendResponse({ ok: false, error: 'internal_error' } satisfies ExtensionResponse)
      })
    return true
  })

  chrome.runtime.onInstalled.addListener((details) => {
    console.info('[Flowlary] installed', BRAND.version, details.reason)
    void (async () => {
      await startupBackground()
      if (details.reason === 'install') {
        await setLearningInstallKind(flowlaryStorage, 'fresh')
      } else if (details.reason === 'update') {
        await ensureLearningProfile(flowlaryStorage)
      }
    })()
  })

  chrome.commands?.onCommand.addListener((command) => {
    const operation = commandFromChromeCommand(command)
    if (!operation) return
    void runCommandOnActiveTab(operation)
  })

  void startupBackground()

  onApiHealthRecovered(() => {
    void buildStatus({ forceHealthProbe: true }).catch(() => {
      /* best-effort — popup reloads on focus */
    })
  })
}

registerBackgroundListeners()
