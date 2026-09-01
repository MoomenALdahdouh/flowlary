import { InputEngine } from './core/input/InputEngine.ts'
import { CommandRouter } from './core/router/CommandRouter.ts'
import { CommandOrchestrator } from './core/router/CommandOrchestrator.ts'
import { bootstrapContentScriptAccount } from './content/accountBootstrap.ts'
import { startWritingRuntime } from './content/startWritingRuntime.ts'
import { createCorrectionFeature } from './features/correction/index.ts'
import { createTranslationFeature } from './features/translation/index.ts'
import { createLayoutFeature } from './features/layout/index.ts'
import { runWritingPipeline } from './core/writeGate/pipeline.ts'

const engine = new InputEngine()
const router = new CommandRouter()

const correction = createCorrectionFeature({ engine })
router.registerCorrection(correction)

const translation = createTranslationFeature({ engine })
router.registerTranslation(translation)

const layout = createLayoutFeature({ engine })
router.registerLayout(layout)
router.register('PIPELINE', () => runWritingPipeline(engine))

const orchestrator = new CommandOrchestrator({
  engine,
  router,
  onSpeedBox: () => layout.handleSpeedBox(),
})

void startWritingRuntime({
  engine,
  bootstrap: () => bootstrapContentScriptAccount({ layout, correction }),
  correction,
  layout,
  translation,
  orchestrator,
})

export { engine, router, orchestrator, correction, layout, translation }
