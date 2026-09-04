import type { Command, CommandResult, LayoutFeature } from '@flowlary/shared'
import { getFlowlaryCache } from '../../storage/cache/index.ts'
import type { InputEngine } from '../../core/input/InputEngine.ts'
import { stateManager } from '../../core/state/StateManager.ts'
import {
  DEFAULT_LAYOUT_PROFILE_STATE,
  normalizeLayoutProfileState,
  applyLayoutProfileToMemory,
  toUserLayoutProfile,
  type LayoutProfileState,
} from './profile/index.ts'
import { createLayoutCache } from './cache/LayoutCache.ts'
import {
  defaultRemoteClassifier,
  LayoutClassifier,
} from './classifier/LayoutClassifier.ts'
import { fixCurrentText } from './fixCurrentText.ts'
import { resolveFixTarget } from './fixCurrentText.ts'
import { readFieldText, readSelectionRange } from '../../core/dom/read.ts'
import { commitWriteTransaction } from '../../core/writeGate/writeGate.ts'
import {
  convertManualText,
  defaultConverterPair,
} from './layouts/convert.ts'
import { InlineSuggestionCard } from '../shared/InlineSuggestionCard.ts'
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
  const cacheCoordinator = getFlowlaryCache()
  void cacheCoordinator.initialize()
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
    getSession: (element) => options.engine.sessions.getOrCreate(element),
    getProfile: () => ({
      ...getProfile(),
      manualConversionEnabled: stateManager.layout.manualConversionEnabled,
      sourceLanguage: stateManager.translation.sourceLanguage,
      targetLanguage: stateManager.translation.targetLanguage,
      correctionEnabled: stateManager.correction.enabled,
      correctionConsentAccepted: stateManager.correction.consentAccepted,
      correctionHighlights: stateManager.correction.highlights,
      correctionMode: stateManager.correction.mode,
      translationMode: stateManager.translation.mode,
      layoutMode: stateManager.layout.mode,
      translationEnabled: stateManager.translation.shortcutEnabled,
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
  const cards = new WeakMap<import('../../core/dom/types.ts').EditableElement, InlineSuggestionCard>()

  function ensureCard(element: import('../../core/dom/types.ts').EditableElement): InlineSuggestionCard {
    let card = cards.get(element)
    if (!card) {
      card = new InlineSuggestionCard({
        label: 'Layout',
        onApply: (binding) => {
          const session = options.engine.sessions.getOrCreate(binding.element)
          const acquired = session.tryAcquireWrite('FIX_LAYOUT')
          if (!acquired.ok) {
            card?.hide()
            return
          }
          commitWriteTransaction(
            binding.element as import('../../core/dom/types.ts').EditableElement,
            binding.start,
            binding.end,
            binding.suggestion,
            {
              origin: 'FIX_LAYOUT',
              session,
              requestId: acquired.requestId,
              expectedGeneration: acquired.generation,
              cycleGeneration: acquired.generation,
              placeCaretAfter: true,
              capability: 'layout',
              trigger: 'suggestion_accept',
            },
          )
          session.releaseWrite('FIX_LAYOUT', acquired.requestId)
          card?.hide()
        },
        onDismiss: () => {},
      })
      cards.set(element, card)
    }
    card.attach(element)
    return card
  }

  const feature: LayoutModule = {
    metrics,

    getProfile,
    getProfileState: () => profileState,
    setProfileState(state) {
      profileState = normalizeLayoutProfileState(state)
      applyLayoutProfileToMemory(profileState)
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

      const editable = element as import('../../core/dom/types.ts').EditableElement
      const session = options.engine.sessions.getOrCreate(element)
      const generation = command.generation ?? session.getGeneration()
      const requestId = command.requestId ?? session.getRequestSequence()
      const active = session.getActiveRequest()
      const signal = active?.signal ?? new AbortController().signal

      if (stateManager.layout.mode === 'box') {
        const text = readFieldText(editable)
        const selection = command.rangeStart != null && command.rangeEnd != null
          ? { start: command.rangeStart, end: command.rangeEnd }
          : readSelectionRange(editable)
        if (!selection) {
          return { ok: false, operation: 'FIX_LAYOUT', error: 'no_target' }
        }
        const target = resolveFixTarget(text, selection.start, selection.end)
        if (!target) {
          return { ok: false, operation: 'FIX_LAYOUT', error: 'empty_text' }
        }
        const profile = getProfile()
        const pair = defaultConverterPair(profile)
        const converted = convertManualText(target.text, pair.sourceLayout, pair.targetLayout)
        if (!converted.ok || converted.text === target.text) {
          return { ok: false, operation: 'FIX_LAYOUT', error: 'noop' }
        }
        ensureCard(editable).show({
          element: editable,
          start: target.start,
          end: target.end,
          suggestion: converted.text,
        })
        return { ok: true, operation: 'FIX_LAYOUT', data: { applied: false, mode: 'box' } }
      }

      const result = await fixCurrentText({
        element: editable,
        session,
        profile: getProfile(),
        personalExceptions: profileState.personalExceptions,
        generation,
        requestId,
        signal,
        classifier,
        metrics,
        rangeStart: command.rangeStart,
        rangeEnd: command.rangeEnd,
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
