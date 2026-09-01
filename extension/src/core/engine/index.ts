/**
 * Unified Writing Decision Engine — Phase 2 shadow mode (observe only).
 *
 * This module MUST NOT import writeReplacement, commitReplacement,
 * applyLayoutFix, or any suggestion/card UI.
 */
import type { InputEngine } from '../input/InputEngine.ts'
import {
  applyProductionEngineModeDefault,
  getEngineMode,
  hydrateEngineModeFromStorage,
  installEngineModeGlobalWatch,
  installEngineModeStorageListener,
} from './flag.ts'
import { startShadowCoordinator, stopShadowCoordinator } from './coordinator.ts'
import { syncInternalDebugHook } from './diagnostics.ts'

export { ENGINE_FLAG_KEY, ENGINE_VERSION } from './types.ts'
export {
  applyProductionEngineModeDefault,
  getEngineMode,
  hasExplicitEngineModeOverride,
  hydrateEngineModeFromStorage,
  installEngineModeGlobalWatch,
  isEnforceEngineEnabled,
  isShadowEngineEnabled,
  setInternalEngineMode,
  setStoredEngineMode,
  resetEngineModeForTests,
} from './flag.ts'
export { getShadowDecisionSnapshot, clearShadowDecisions } from './telemetry.ts'
export {
  DEBUG_GLOBAL_KEY,
  clearDebugSnapshots,
  getEffectiveWritingPolicy,
  getInternalDebugHookForTests,
  syncInternalDebugHook,
} from './diagnostics.ts'
export { runShadowDecisionForTests, stopShadowCoordinator } from './coordinator.ts'
export { decideWriting } from './decide.ts'
export { analyzeFieldText } from './chunks.ts'
export { collectShadowCandidates, candidatesFromHypotheses } from './candidates.ts'
export { collectHypotheses, resetHypothesisIdsForTests } from './hypotheses.ts'
export {
  inferLayoutSpans,
  applyLayoutSpansToText,
  repairKeyboardLayoutText,
  openTokenRange,
} from './layoutSequence.ts'
export {
  layoutSpanConflictsWithMixedIntent,
  layoutSpanUnsafeForAutoWrite,
} from './mixedLayoutSafety.ts'
export { recordWritingFeedback, getWritingFeedbackSnapshot } from './writingFeedback.ts'
export {
  consultAdvisor,
  shouldConsultAdvisor,
  validateAdvisorVote,
  setHypothesisAdvisor,
  setAdvisorApplyMode,
  getAdvisorApplyMode,
  buildAdvisorPacket,
  maskAdvisorSnippet,
} from './advisor.ts'
export { buildFieldContext } from './context.ts'
export { registerProductionHypothesisAdvisor } from './hypothesisAdvisorClient.ts'
export { registerProductionWritingReview } from './writingReviewClient.ts'
export { extractReviewIsland } from './reviewIsland.ts'
export { ingestReviewEdits, pickReviewEdit } from './ingestReviewEdits.ts'
export {
  shouldScheduleWritingReview,
  setWritingReview,
  getWritingReview,
  resetWritingReviewForTests,
} from './writingReview.ts'

/**
 * Hydrate debug overrides and apply the production default (`enforce`)
 * when no explicit mode is set. Await this before feature schedulers start.
 */
export async function establishEngineMode(): Promise<ReturnType<typeof getEngineMode>> {
  installEngineModeGlobalWatch()
  installEngineModeStorageListener()
  await hydrateEngineModeFromStorage()
  applyProductionEngineModeDefault()
  syncInternalDebugHook()
  return getEngineMode()
}

/** Observe-only coordinator. Mode must already be established. */
export function startShadowEngine(engine: InputEngine): void {
  installEngineModeGlobalWatch()
  installEngineModeStorageListener()
  syncInternalDebugHook()
  startShadowCoordinator(engine)
}

export function stopShadowEngine(): void {
  stopShadowCoordinator()
}
