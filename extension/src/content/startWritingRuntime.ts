import type { InputEngine } from '../core/input/InputEngine.ts'
import { establishEngineMode, startShadowEngine } from '../core/engine/index.ts'
import { registerProductionHypothesisAdvisor } from '../core/engine/hypothesisAdvisorClient.ts'
import { registerProductionWritingReview } from '../core/engine/writingReviewClient.ts'
import { startEnforceCoordinator } from '../core/writeGate/enforceCoordinator.ts'
import { startTranslationSessionChip } from '../features/translation/sessionChip.ts'
import type { EngineMode } from '../core/engine/flag.ts'

export type WritingRuntimeModules = {
  engine: InputEngine
  bootstrap: () => Promise<unknown>
  correction: { start(): void }
  layout: { start(): void }
  translation: { start(): void }
  orchestrator: { start(): void }
  startChip?: boolean
}

/**
 * Authoritative content-script boot order:
 * account/settings hydrate → engine mode → input + enforce + orchestrator.
 * Feature modules start for shortcut/Speed Box fulfillment only — they are not EventBus writers.
 */
export async function startWritingRuntime(modules: WritingRuntimeModules): Promise<EngineMode> {
  await modules.bootstrap()
  registerProductionHypothesisAdvisor()
  registerProductionWritingReview()
  const mode = await establishEngineMode()
  modules.engine.start()
  startShadowEngine(modules.engine)
  startEnforceCoordinator(modules.engine)
  modules.correction.start()
  modules.layout.start()
  modules.translation.start()
  modules.orchestrator.start()
  if (modules.startChip !== false) {
    startTranslationSessionChip(modules.engine)
  }
  return mode
}
