import type { Command, CommandResult, LayoutFeature } from '@flowlary/shared'
import { createMemoryCacheCoordinator } from '@flowlary/shared'
import type { InputEngine } from '../../core/input/InputEngine.ts'
import { stateManager } from '../../core/state/StateManager.ts'
import {
  DEFAULT_LAYOUT_PROFILE_STATE,
  normalizeLayoutProfileState,
  toUserLayoutProfile,
  type LayoutProfileState,
} from './profile/index.ts'
import { createLayoutCache } from './cache/LayoutCache.ts'
import {
  defaultRemoteClassifier,
  LayoutClassifier,
} from './classifier/LayoutClassifier.ts'
import { fixCurrentText } from './fixCurrentText.ts'
import { createLayoutMetrics } from './metrics.ts'
import { LayoutScheduler } from './scheduler.ts'
import { createSpeedBox, type SpeedBox } from './speedBox.ts'
import type { UserLayoutProfile } from './layouts/types.ts'

export type LayoutModuleOptions = {
  engine: InputEngine
}

export type LayoutModule = LayoutFeature & {
  start(): void
  stop(): void
  handleSpeedBox(): boolean
  getSpeedBox(): SpeedBox
  getProfile(): UserLayoutProfile
  getProfileState(): LayoutProfileState
  setProfileState(state: LayoutProfileState): void
  metrics: ReturnType<typeof createLayoutMetrics>
}

export function createLayoutFeature(options: LayoutModuleOptions): LayoutModule {
  const cacheCoordinator = createMemoryCacheCoordinator(24 * 60 * 60 * 1000)
  const layoutCache = createLayoutCache(cacheCoordinator)
  const metrics = createLayoutMetrics()
  const classifier = new LayoutClassifier({
    cache: layoutCache,
    metrics,
    classifyRemote: defaultRemoteClassifier,
  })

  let profileState: LayoutProfileState = { ...DEFAULT_LAYOUT_PROFILE_STATE }

  function syncProfileFromState(): UserLayoutProfile {
    return toUserLayoutProfile(
      stateManager.layout.sourceLayout,
      stateManager.layout.targetLayouts,
    )
  }

  function getProfile(): UserLayoutProfile {
    if (stateManager.layout.sourceLayout) {
      return syncProfileFromState()
    }
    return profileState.layoutProfile
  }

  const speedBox = createSpeedBox({
    getProfile: () => ({
      ...getProfile(),
      manualConversionEnabled: stateManager.layout.manualConversionEnabled,
    }),
  })

  const scheduler = new LayoutScheduler({
    engine: options.engine,
    classifier,
    metrics,
    getProfile,
    getExceptions: () => profileState.personalExceptions,
    getSpeedBox: () => speedBox,
  })

  let started = false

  const feature: LayoutModule = {
    metrics,

    getProfile,
    getProfileState: () => profileState,
    setProfileState(state) {
      profileState = normalizeLayoutProfileState(state)
    },
    getSpeedBox: () => speedBox,

    handleSpeedBox() {
      if (!stateManager.layout.manualConversionEnabled) return false
      return speedBox.toggle()
    },

    start() {
      if (started) return
      started = true
      scheduler.start()
    },

    stop() {
      scheduler.stop()
      speedBox.destroy()
      started = false
    },

    async execute(command: Command): Promise<CommandResult> {
      if (!stateManager.layout.directShortcutEnabled) {
        return { ok: false, operation: 'FIX_LAYOUT', error: 'disabled' }
      }

      const element = options.engine.sessions.resolveElement(command.field.id)
      if (!element) {
        return { ok: false, operation: 'FIX_LAYOUT', error: 'no_target' }
      }

      const session = options.engine.sessions.getOrCreate(element)
      const generation = command.generation ?? session.getGeneration()
      const requestId = command.requestId ?? session.getRequestSequence()
      const active = session.getActiveRequest()
      const signal = active?.signal ?? new AbortController().signal

      const result = await fixCurrentText({
        element: element as import('../../core/dom/types.ts').EditableElement,
        session,
        profile: getProfile(),
        personalExceptions: profileState.personalExceptions,
        generation,
        requestId,
        signal,
        classifier,
        metrics,
      })

      if (result.aborted) {
        return { ok: false, operation: 'FIX_LAYOUT', aborted: true }
      }
      if (result.stale) {
        return { ok: false, operation: 'FIX_LAYOUT', stale: true }
      }
      return { ok: result.applied, operation: 'FIX_LAYOUT', data: { applied: result.applied } }
    },
  }

  return feature
}

export type { LayoutFeature }
export { createLayoutFeature as default }
