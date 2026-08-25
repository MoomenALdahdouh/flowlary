import type { Command, CommandResult, TranslationFeature } from '@flowlary/shared'
import { getFlowlaryCache } from '../../storage/cache/index.ts'
import type { InputEngine } from '../../core/input/InputEngine.ts'
import { readFieldText, readSelectionRange } from '../../core/dom/read.ts'
import { writeReplacement } from '../../core/dom/editor.ts'
import type { EditableElement } from '../../core/dom/types.ts'
import { stateManager } from '../../core/state/StateManager.ts'
import { TranslationEngine } from './engine.ts'
import { requestTranslationRemote } from './client.ts'
import { createTranslationCache } from './cache.ts'
import { resolveTranslateTarget, targetLooksProtected } from './selection.ts'
import { isStaleTicket } from './stale.ts'
import type { TranslationOutcome, TranslationRequest, TranslationTicket } from './types.ts'
import { DEFAULT_SOURCE_LANGUAGE, DEFAULT_TARGET_LANGUAGE, normalizeLanguage } from './languages.ts'
import { createTranslationMetrics, type TranslationMetrics } from './metrics.ts'
import { TranslationScheduler } from './scheduler.ts'
import { recordHistory } from '../../storage/history/record.ts'

export type TranslationProviderFn = (
  request: TranslationRequest,
  signal?: AbortSignal,
) => Promise<TranslationOutcome>

export type TranslationModuleOptions = {
  engine: InputEngine
  provider?: TranslationProviderFn
}

export type TranslationModule = TranslationFeature & {
  start(): void
  stop(): void
  /** Reserved alias — subscribes to EventBus only, no document listeners. */
  prepareLiveScheduler(): void
  metrics: TranslationMetrics
  setLiveEnabled(enabled: boolean): void
}

export function createTranslationFeature(options: TranslationModuleOptions): TranslationModule {
  const cacheCoordinator = getFlowlaryCache()
  void cacheCoordinator.initialize()
  const translationCache = createTranslationCache(cacheCoordinator)
  const metrics = createTranslationMetrics()

  const engine = new TranslationEngine({
    async translate(request, signal) {
      const cached = translationCache.get(
        request.sourceLanguage,
        request.targetLanguage,
        request.text,
      )
      if (cached) {
        if (request.mode === 'live') metrics.translation_live_cache_hits += 1
        return { ok: true, translation: cached }
      }

      const cacheKey = cacheCoordinator.buildKey({
        operation: 'TRANSLATE',
        text: request.text,
        sourceLanguage: request.sourceLanguage,
        targetLanguage: request.targetLanguage,
      })
      const persisted = await cacheCoordinator.getWithL2<string>(cacheKey)
      if (persisted) {
        if (request.mode === 'live') metrics.translation_live_cache_hits += 1
        return { ok: true, translation: persisted }
      }

      const remote = options.provider
        ? await options.provider(request, signal)
        : await requestTranslationRemote(
            request.text,
            request.sourceLanguage,
            request.targetLanguage,
            signal,
            request.mode,
          )

      if (remote.ok) {
        translationCache.set(
          request.sourceLanguage,
          request.targetLanguage,
          request.text,
          remote.translation,
        )
      }
      return remote
    },
  })

  const scheduler = new TranslationScheduler({
    engine: options.engine,
    translationEngine: engine,
    metrics,
  })

  let started = false

  function setLiveEnabled(enabled: boolean): void {
    stateManager.translation.liveEnabled = enabled
    if (!enabled) scheduler.onLiveDisabled()
  }

  return {
    metrics,

    start() {
      if (started) return
      started = true
      scheduler.start()
    },

    stop() {
      if (!started) return
      started = false
      scheduler.stop()
    },

    prepareLiveScheduler() {
      scheduler.prepareLiveScheduler()
    },

    setLiveEnabled,

    async execute(command: Command): Promise<CommandResult> {
      if (!stateManager.translation.shortcutEnabled) {
        return { ok: false, operation: 'TRANSLATE', error: 'disabled' }
      }

      const sourceLanguage = normalizeLanguage(
        command.sourceLanguage ?? stateManager.translation.sourceLanguage,
        DEFAULT_SOURCE_LANGUAGE,
      )
      const targetLanguage = normalizeLanguage(
        command.targetLanguage ?? stateManager.translation.targetLanguage,
        DEFAULT_TARGET_LANGUAGE,
      )

      if (sourceLanguage === targetLanguage) {
        return { ok: false, operation: 'TRANSLATE', error: 'same-language' }
      }

      const element = options.engine.sessions.resolveElement(command.field.id)
      if (!element) {
        return { ok: false, operation: 'TRANSLATE', error: 'no_target' }
      }

      const editable = element as EditableElement
      const session = options.engine.sessions.getOrCreate(element)
      const generation = command.generation ?? session.getGeneration()
      const requestId = command.requestId ?? session.getRequestSequence()
      const signal = session.getActiveRequest()?.signal

      if (session.isComposing()) {
        return { ok: false, operation: 'TRANSLATE', error: 'composing' }
      }

      const text = readFieldText(editable)
      const selection = readSelectionRange(editable)
      if (!selection) {
        return { ok: false, operation: 'TRANSLATE', error: 'no_target' }
      }

      const target = resolveTranslateTarget(text, selection.start, selection.end)
      if (!target) {
        return { ok: false, operation: 'TRANSLATE', error: 'empty_text' }
      }

      if (targetLooksProtected(target.text)) {
        return { ok: false, operation: 'TRANSLATE', error: 'protected' }
      }

      const ticket: TranslationTicket = {
        elementGeneration: generation,
        originalText: target.text,
        start: target.start,
        end: target.end,
        sourceLanguage,
        targetLanguage,
        mode: 'shortcut',
      }

      const outcome = await engine.translate(
        {
          text: target.text,
          sourceLanguage,
          targetLanguage,
          mode: 'shortcut',
        },
        signal,
      )

      if (signal?.aborted) {
        return { ok: false, operation: 'TRANSLATE', aborted: true }
      }

      if (!outcome.ok) {
        return { ok: false, operation: 'TRANSLATE', error: outcome.code }
      }

      if (outcome.translation === target.text) {
        return { ok: false, operation: 'TRANSLATE', error: 'noop' }
      }

      const liveText = readFieldText(editable)
      if (
        isStaleTicket(ticket, {
          generation: session.getGeneration(),
          text: liveText,
          start: target.start,
          end: target.end,
          sourceLanguage,
          targetLanguage,
        })
      ) {
        return { ok: false, operation: 'TRANSLATE', stale: true }
      }

      const commit = session.canCommit(generation, requestId)
      if (!commit.ok) {
        return {
          ok: false,
          operation: 'TRANSLATE',
          stale: commit.reason === 'stale-generation' || commit.reason === 'stale-request',
          aborted: commit.reason === 'aborted',
          error: commit.reason,
        }
      }

      const write = writeReplacement(editable, target.start, target.end, outcome.translation, {
        origin: 'TRANSLATE',
        session,
        requestId,
        expectedGeneration: generation,
        placeCaretAfter: true,
        allowActiveEdit: true,
      })

      if (write.verdict !== 'written') {
        return { ok: false, operation: 'TRANSLATE', stale: true, error: write.reason ?? 'stale' }
      }

      void recordHistory({
        operation: 'TRANSLATE',
        element: editable,
        sourceText: target.text,
        resultText: outcome.translation,
        mode: 'manual',
        metadata: { sourceLanguage, targetLanguage },
      })

      return { ok: true, operation: 'TRANSLATE', data: { applied: true, mode: target.mode } }
    },
  }
}

export type { TranslationFeature }
