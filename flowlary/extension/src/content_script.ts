import { InputEngine } from './core/input/InputEngine.ts'
import { CommandRouter } from './core/router/CommandRouter.ts'
import { CommandOrchestrator } from './core/router/CommandOrchestrator.ts'
import { createCorrectionFeature } from './features/correction/index.ts'
import { createTranslationFeature } from './features/translation/index.ts'
import { createLayoutFeature } from './features/layout/index.ts'

const engine = new InputEngine()
const router = new CommandRouter()

router.registerCorrection(createCorrectionFeature())
router.registerTranslation(createTranslationFeature())
router.registerLayout(createLayoutFeature())

const orchestrator = new CommandOrchestrator({ engine, router })

engine.start()
orchestrator.start()

export { engine, router, orchestrator }
