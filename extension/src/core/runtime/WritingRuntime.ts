import { isEditableElement, readFieldText } from '../dom/read.ts'
import type { NormalizedInputEvent } from '../events/EventBus.ts'
import { isEnforceEngineEnabled } from '../engine/flag.ts'
import type { InputEngine } from '../input/InputEngine.ts'
import { markOperationCompleted, markOperationFailed, markOperationRunning } from './Operation.ts'
import { flushDeferredAutomaticCommits, hasDeferredCandidate } from './arbitration.ts'
import type { Operation } from './types.ts'
import { isOperationLive } from './types.ts'
import { computeFeatureDeadlines, resolveLivePolicyInput } from './featurePolicies.ts'
import { IdleScheduler, type SchedulerFeature } from './IdleScheduler.ts'
import { isLegacyImmediateCycle } from './legacyImmediateCycle.ts'
import { runFieldCycle } from '../writeGate/pipeline.ts'
import { hidePipelineSuggestion } from '../writeGate/pipelineSuggest.ts'
import type { EditableElement } from '../dom/types.ts'
import { registerSameRevisionReanalyze } from './revisionBump.ts'

const TRIGGER_KEYS = new Set([' ', 'Enter', 'Tab'])

export type EnglishIdleAnalyzer = (
  element: EditableElement,
  operation: Operation,
) => void | Promise<void>

let runtime: WritingRuntime | null = null
let englishIdleAnalyzer: EnglishIdleAnalyzer | null = null

export function registerEnglishIdleAnalyzer(analyzer: EnglishIdleAnalyzer | null): void {
  englishIdleAnalyzer = analyzer
}

export function getWritingRuntime(): WritingRuntime | null {
  return runtime
}

export function startWritingRuntimeScheduler(engine: InputEngine): WritingRuntime {
  if (runtime) return runtime
  runtime = new WritingRuntime(engine)
  runtime.start()
  return runtime
}

export function stopWritingRuntimeScheduler(): void {
  runtime?.stop()
  runtime = null
}

export class WritingRuntime {
  private readonly scheduler: IdleScheduler
  private readonly elements = new Map<string, Element>()
  private unsubscribe: (() => void) | null = null
  private readonly analysisStarts: Array<{ fieldId: string; revision: number; feature: SchedulerFeature }> = []

  constructor(private readonly engine: InputEngine) {
    this.scheduler = new IdleScheduler({
      onWake: (wake) => {
        void this.onWake(wake)
      },
    })
  }

  start(): void {
    if (this.unsubscribe) return
    this.unsubscribe = this.engine.eventBus.subscribe((event) => this.handleEvent(event))
    registerSameRevisionReanalyze((fieldId) => {
      const element = this.elements.get(fieldId)
      if (!element || !isEditableElement(element)) return
      const session = this.engine.sessions.get(element)
      this.syncFromSession(element, session, { focusOut: false })
    })
  }

  stop(): void {
    this.unsubscribe?.()
    this.unsubscribe = null
    registerSameRevisionReanalyze(null)
    this.scheduler.stop()
    this.elements.clear()
  }

  getScheduler(): IdleScheduler {
    return this.scheduler
  }

  takeAnalysisStartsForTests() {
    const copy = [...this.analysisStarts]
    this.analysisStarts.length = 0
    return copy
  }

  handleEvent(event: NormalizedInputEvent): void {
    if (isLegacyImmediateCycle()) return
    if (!isEnforceEngineEnabled()) return
    if (event.origin === 'SYSTEM') return
    if (event.type === 'composition-start' || event.type === 'composition-update') return
    if (event.type === 'input') {
      if (event.composing) return
      this.syncFromSession(event.target, event.session, { focusOut: false })
      return
    }
    if (event.type === 'composition-end') {
      this.syncFromSession(event.target, event.session, { focusOut: false })
      return
    }
    if (event.type === 'keyup' && event.target && TRIGGER_KEYS.has(event.key)) {
      this.syncFromSession(event.target, event.session, { focusOut: false })
      return
    }
    if (event.type === 'focus-out' && event.target) {
      const session = event.session ?? this.engine.sessions.getOrCreate(event.target)
      session.requestCommitOpenToken()
      session.noteBlurTranslationPass()
      this.syncFromSession(event.target, session, { focusOut: true })
    }
  }

  private syncFromSession(
    target: Element | null | undefined,
    session: {
      getRevision(): number
      field: { id: string }
      getLastInputAt(): number
      getLastEnglishNetworkAt(): number
      isComposing(): boolean
      isPasteAssistanceSuppressed?: (now?: number) => boolean
    } | undefined,
    options: { focusOut: boolean },
  ): void {
    if (!target || !isEditableElement(target)) return
    const live = session ?? this.engine.sessions.getOrCreate(target)
    this.elements.set(live.field.id, target)
    const now = Date.now()
    const lastInputAt = live.getLastInputAt() || now
    const text = readFieldText(target)
    const pasteSuppressed = live.isPasteAssistanceSuppressed?.() === true
    const empty = text.trim().length === 0
    if (pasteSuppressed || empty) {
      hidePipelineSuggestion(live.field.id)
      this.scheduler.recompute({
        fieldId: live.field.id,
        revision: live.getRevision(),
        lastInputAt,
        snapshotText: text,
        composing: live.isComposing(),
        focusOut: options.focusOut,
        deadlines: new Map(),
      })
      return
    }
    let deadlines = computeFeatureDeadlines(
      resolveLivePolicyInput({
        text,
        now,
        lastInputAt,
        lastEnglishNetworkAt: live.getLastEnglishNetworkAt(),
        composing: live.isComposing(),
        focusOut: options.focusOut,
      }),
    )
    if (options.focusOut) {
      const translateAt = deadlines.get('translate')
      deadlines = new Map()
      if (translateAt !== undefined) deadlines.set('translate', translateAt)
    }
    this.scheduler.recompute({
      fieldId: live.field.id,
      revision: live.getRevision(),
      lastInputAt,
      snapshotText: text,
      composing: live.isComposing(),
      focusOut: options.focusOut,
      deadlines,
    })
  }

  private async onWake(wake: {
    fieldId: string
    revision: number
    due: SchedulerFeature[]
    now: number
    focusOut: boolean
  }): Promise<void> {
    const element = this.elements.get(wake.fieldId)
    if (!element || !isEditableElement(element) || !element.isConnected) return
    const session = this.engine.sessions.get(element)
    if (!session) return
    if (session.getRevision() !== wake.revision) return
    if (session.isComposing()) return

    const text = readFieldText(element)
    if (session.isPasteAssistanceSuppressed() || !text.trim()) {
      hidePipelineSuggestion(session.field.id)
      return
    }
    const scheduled = this.scheduler.getSnapshot(wake.fieldId)
    if (scheduled && scheduled.snapshotText !== text) {
      for (const operation of session.operations.list()) {
        if (
          operation.revision === session.getRevision()
          && isOperationLive(operation)
          && operation.snapshotFullText !== text
        ) {
          markOperationFailed(operation)
        }
      }
      hidePipelineSuggestion(session.field.id)
      if (!session.trySameRevisionReanalysis()) return
    }

    const fresh = new Set<SchedulerFeature>()
    const operations: Partial<Record<'layout' | 'english' | 'translate' | 'review', Operation>> = {}
    for (const feature of wake.due) {
      const mapped = feature === 'review' ? 'pipeline' : feature
      const operation = session.operations.begin({
        fieldId: session.field.id,
        revision: wake.revision,
        feature: mapped === 'pipeline' ? 'pipeline' : mapped,
        purpose: wake.focusOut && feature === 'translate' ? 'focus-out' : 'auto-analysis',
        trigger: wake.focusOut && feature === 'translate' ? 'focus_out' : 'auto',
        snapshotFullText: text,
      })
      if (operation.state !== 'pending' || operation.revision !== wake.revision) continue
      markOperationRunning(operation)
      if (feature === 'layout' || feature === 'english' || feature === 'translate' || feature === 'review') {
        operations[feature] = operation
      }
      fresh.add(feature)
      this.analysisStarts.push({ fieldId: wake.fieldId, revision: wake.revision, feature })
    }
    if (fresh.size === 0) return

    const pipelineDue = new Set<'layout' | 'english' | 'translate' | 'review'>()
    for (const feature of fresh) {
      if (feature === 'english' && englishIdleAnalyzer) continue
      pipelineDue.add(feature)
    }

    try {
      // Idle wake means the user paused — treat the caret token as finished
      // so the last wrong-layout word is included (same idea as English idle repair).
      if (!wake.focusOut) {
        session.requestCommitOpenToken()
      }
      if (pipelineDue.size > 0) {
        const pipelineOps = { ...operations }
        if (englishIdleAnalyzer) delete pipelineOps.english
        await runFieldCycle(element, session, {
          dueFeatures: pipelineDue,
          translationPauseBypass: pipelineDue.has('translate'),
          operations: pipelineOps,
        })
      }
      if (fresh.has('english') && englishIdleAnalyzer && operations.english) {
        await englishIdleAnalyzer(element, operations.english)
      }
      for (const operation of Object.values(operations)) {
        if (!operation) continue
        if (hasDeferredCandidate(operation.operationId, session)) continue
        if (operation.state === 'running' && operation.revision === session.getRevision()) {
          markOperationCompleted(operation)
        }
      }
      flushDeferredAutomaticCommits(session)
    } catch {
      /* analysis errors must not stick the mutex; execute paths use finally */
    }
  }
}
