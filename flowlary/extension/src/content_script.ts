import { InputEngine } from './core/input/InputEngine.ts'
import { CommandRouter } from './core/router/CommandRouter.ts'
import { CommandOrchestrator } from './core/router/CommandOrchestrator.ts'
import { createCorrectionFeature } from './features/correction/index.ts'
import { createTranslationFeature } from './features/translation/index.ts'
import { createLayoutFeature } from './features/layout/index.ts'
import { flowlaryStorage, hydrateStateFromStorage, runStorageMigration } from './storage/index.ts'
import { ensureHistoryInitialized } from './storage/history/record.ts'

void (async () => {
  await runStorageMigration()
  await hydrateStateFromStorage(flowlaryStorage)
  await ensureHistoryInitialized()
})()

const engine = new InputEngine()
const router = new CommandRouter()

const correction = createCorrectionFeature({ engine })
router.registerCorrection(correction)

const translation = createTranslationFeature({ engine })
router.registerTranslation(translation)

const layout = createLayoutFeature({ engine })
router.registerLayout(layout)

const orchestrator = new CommandOrchestrator({
  engine,
  router,
  onSpeedBox: () => layout.handleSpeedBox(),
})

engine.start()
correction.start()
layout.start()
translation.start()
orchestrator.start()

export { engine, router, orchestrator, correction, layout, translation }
