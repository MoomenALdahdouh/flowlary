import { InputEngine } from './core/input/InputEngine.ts'
import { CommandRouter } from './core/router/CommandRouter.ts'
import { createCorrectionFeature } from './features/correction/index.ts'
import { createTranslationFeature } from './features/translation/index.ts'
import { createLayoutFeature } from './features/layout/index.ts'

const engine = new InputEngine()
const router = new CommandRouter()

router.registerCorrection(createCorrectionFeature())
router.registerTranslation(createTranslationFeature())
router.registerLayout(createLayoutFeature())

engine.start()

// Phase 3+ will connect normalized events → CommandRouter.dispatch()
void engine
void router

export { engine, router }
