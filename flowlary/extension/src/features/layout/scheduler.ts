import type { InputEngine } from '../../core/input/InputEngine.ts'
import { evaluateFieldSafety } from '../../core/safety/index.ts'
import {
  isInsideMarkdownCode,
  isSafeToken,
  lastCompletedToken,
  MAX_FIELD_CHARS,
  MAX_FIELD_TOKENS,
  tokenizeText,
} from '../../core/safety/index.ts'
import { readCaret, readFieldText, isEditableElement } from '../../core/dom/read.ts'
import type { EditableElement } from '../../core/dom/types.ts'
import { stateManager } from '../../core/state/StateManager.ts'
import {
  canCommitMismatch,
  localClassificationHint,
  planFieldFixes,
  type UserLayoutProfile,
} from './layouts/index.ts'
import { isExceptedToken } from './profile/exceptions.ts'
import { applyLayoutFix } from './fixCurrentText.ts'
import type { LayoutClassifier } from './classifier/LayoutClassifier.ts'
import type { SpeedBox } from './speedBox.ts'
import type { LayoutMetrics } from './metrics.ts'

const TRIGGER_KEYS = new Set([' ', 'Enter', 'Tab'])

export type LayoutSchedulerOptions = {
  engine: InputEngine
  classifier: LayoutClassifier
  metrics: LayoutMetrics
  getProfile: () => UserLayoutProfile
  getExceptions: () => readonly string[]
  getSpeedBox: () => SpeedBox
}

export class LayoutScheduler {
  private unsubscribe: (() => void) | null = null

  constructor(private options: LayoutSchedulerOptions) {}

  start(): void {
    if (this.unsubscribe) return
    this.unsubscribe = this.options.engine.eventBus.subscribe((event) => {
      if (this.options.getSpeedBox().isOpen()) return

      if (event.type === 'keydown') {
        if (event.key === 'Escape') {
          this.options.getSpeedBox().handleEscape()
        }
        if (event.key === 'Enter' || event.key === 'Tab') {
          this.evaluate(event.target, true)
        }
      }

      if (event.type === 'keyup' && TRIGGER_KEYS.has(event.key)) {
        this.evaluate(event.target, event.key !== ' ')
      }

      if (event.type === 'input') {
        const inputType = event.inputType
        if (inputType === 'insertFromPaste' || inputType === 'insertFromDrop') return
        if (inputType === 'insertLineBreak') this.evaluate(event.target, false)
      }

      if (event.type === 'focus-out') {
        this.evaluate(event.target, true)
      }
    })
  }

  stop(): void {
    this.unsubscribe?.()
    this.unsubscribe = null
  }

  private shouldRun(element: Element): element is EditableElement {
    if (!stateManager.isActive() || !stateManager.layout.autoEnabled) return false
    if (!isEditableElement(element)) return false
    const text = readFieldText(element)
    const safety = evaluateFieldSafety(element, {
      hostname: typeof location !== 'undefined' ? location.hostname : undefined,
      excludedDomains: stateManager.settings.excludedDomains,
      text,
    })
    if (!safety.allowed) {
      this.options.metrics.layout_blocked += 1
      return false
    }
    const session = this.options.engine.sessions.get(element)
    if (session?.isComposing()) return false
    return true
  }

  private evaluate(element: Element | null | undefined, finalizeAll: boolean): void {
    if (!element || !this.shouldRun(element)) return

    const profile = this.options.getProfile()
    const personalExceptions = this.options.getExceptions()
    const session = this.options.engine.sessions.getOrCreate(element)
    const generation = session.getGeneration()

    this.applyLocalFixes(element, session, profile, personalExceptions, finalizeAll, generation)
    void this.evaluateRemote(
      element,
      session,
      profile,
      personalExceptions,
      finalizeAll,
      generation,
    )
  }

  private applyLocalFixes(
    element: EditableElement,
    session: ReturnType<InputEngine['sessions']['getOrCreate']>,
    profile: UserLayoutProfile,
    personalExceptions: readonly string[],
    finalizeAll: boolean,
    generation: number,
  ): void {
    const text = readFieldText(element)
    const caret = readCaret(element) ?? text.length
    const oversized =
      text.length > MAX_FIELD_CHARS || tokenizeText(text).tokens.length > MAX_FIELD_TOKENS

    let fixes = planFieldFixes(text, profile, {
      finalizeAll: finalizeAll && !oversized,
      caret,
      personalExceptions,
    })

    if (oversized) {
      const last = lastCompletedToken(text, caret, !finalizeAll)
      fixes = last
        ? planFieldFixes(text, profile, {
            finalizeAll: true,
            caret,
            personalExceptions,
          }).filter((fix) => fix.start === last.start)
        : []
    }

    for (const fix of [...fixes].sort((a, b) => b.start - a.start)) {
      if (session.getGeneration() !== generation) {
        this.options.metrics.layout_stale_results += 1
        return
      }
      if (!canCommitMismatch(profile, fix.word, fix.targetLayout, fix.corrected, text)) {
        continue
      }
      if (applyLayoutFix(element, session, fix, generation, undefined, { historyMode: 'automatic' })) {
        this.options.metrics.layout_local_hits += 1
      }
    }
  }

  private async evaluateRemote(
    element: EditableElement,
    session: ReturnType<InputEngine['sessions']['getOrCreate']>,
    profile: UserLayoutProfile,
    personalExceptions: readonly string[],
    finalizeAll: boolean,
    generation: number,
  ): Promise<void> {
    const text = readFieldText(element)
    const caret = readCaret(element) ?? text.length
    const oversized =
      text.length > MAX_FIELD_CHARS || tokenizeText(text).tokens.length > MAX_FIELD_TOKENS
    const last = lastCompletedToken(text, caret, !finalizeAll)

    const remaining = tokenizeText(text).tokens.flatMap((span) => {
      if (!span.token) return []
      if (isExceptedToken(span.token, personalExceptions)) return []
      if (!isSafeToken(span.token, span.context, span.raw)) return []
      if (isInsideMarkdownCode(text, span.start)) return []
      const closed = finalizeAll || /\s/.test(text.slice(span.end, span.end + 1))
      if (!closed) return []
      if (oversized && last && span.start !== last.start) return []
      if (localClassificationHint(span.token, profile, text) !== null) return []
      return [{ word: span.token, start: span.start, end: span.end }]
    })

    for (const item of [...remaining].reverse()) {
      if (session.getGeneration() !== generation) {
        this.options.metrics.layout_stale_results += 1
        return
      }

      const cached = this.options.classifier.decideFromCache(item.word, profile, text)
      if (cached?.kind === 'LAYOUT_MISMATCH' && cached.targetLayout && cached.corrected) {
        if (
          this.options.classifier.canApply(
            profile,
            item.word,
            cached.targetLayout,
            cached.corrected,
            text,
          )
        ) {
          applyLayoutFix(
            element,
            session,
            {
              start: item.start,
              end: item.end,
              word: item.word,
              corrected: cached.corrected,
              sourceLayout: cached.sourceLayout,
              targetLayout: cached.targetLayout,
            },
            generation,
            undefined,
            { historyMode: 'automatic' },
          )
        }
        continue
      }
      if (cached?.kind === 'VALID') continue

      const result = await this.options.classifier.classify(item.word, profile, text)
      if (session.getGeneration() !== generation) {
        this.options.metrics.layout_stale_results += 1
        return
      }
      if (!result.ok || result.verdict.kind !== 'LAYOUT_MISMATCH' || !result.verdict.targetLayout) {
        continue
      }
      const corrected = result.verdict.corrected
      if (
        !corrected ||
        !this.options.classifier.canApply(
          profile,
          item.word,
          result.verdict.targetLayout,
          corrected,
          text,
        )
      ) {
        continue
      }
      applyLayoutFix(
        element,
        session,
        {
          start: item.start,
          end: item.end,
          word: item.word,
          corrected,
          sourceLayout: result.verdict.sourceLayout,
          targetLayout: result.verdict.targetLayout,
        },
        generation,
        undefined,
        { historyMode: 'automatic' },
      )
    }
  }
}
