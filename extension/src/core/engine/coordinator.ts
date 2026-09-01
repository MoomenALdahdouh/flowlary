/**
 * Single EventBus observer for the shadow engine.
 * MUST NOT write, lock for mutation, or show UI.
 */
import type { InputEngine } from '../input/InputEngine.ts'
import { isEditableElement, readCaret, readFieldText } from '../dom/read.ts'
import { getEngineMode, isShadowEngineEnabled } from './flag.ts'
import { buildFieldContext } from './context.ts'
import { analyzeFieldText } from './chunks.ts'
import { candidatesFromHypotheses } from './candidates.ts'
import { collectHypotheses } from './hypotheses.ts'
import { decideWriting } from './decide.ts'
import { recordShadowDecision } from './telemetry.ts'
import type { FieldContext } from './types.ts'

const TRIGGER_KEYS = new Set([' ', 'Enter', 'Tab'])

let unsubscribe: (() => void) | null = null
let cycle = 0

export function startShadowCoordinator(engine: InputEngine): void {
  if (unsubscribe) return
  unsubscribe = engine.eventBus.subscribe((event) => {
    if (!isShadowEngineEnabled()) return
    if (event.origin === 'SYSTEM') return
    if (event.type === 'input') {
      if (event.composing) {
        observeGateOnly(event.target, event.session, true)
        return
      }
      runShadowCycle(event.target, event.session, event.composing)
      return
    }
    if (event.type === 'keyup' && TRIGGER_KEYS.has(event.key)) {
      runShadowCycle(event.target, event.session, event.composing)
    }
  })
}

export function stopShadowCoordinator(): void {
  unsubscribe?.()
  unsubscribe = null
}

function observeGateOnly(
  target: Element | null | undefined,
  session: ReturnType<InputEngine['sessions']['get']> | undefined,
  composing: boolean,
): void {
  if (!target || !session || !isEditableElement(target)) return
  if (getEngineMode() !== 'internal_shadow') return
  const context = buildFieldContext({
    element: target,
    session,
    cycleId: `sh-${++cycle}`,
    composing,
    textLength: 0,
  })
  const decision = decideWriting(context, null, [])
  recordShadowDecision({ context, analysis: null, candidates: [], decision, analyzed: false })
}

export function runShadowCycle(
  target: Element | null | undefined,
  session: ReturnType<InputEngine['sessions']['get']> | undefined,
  composing: boolean,
): void {
  if (!target || !session || !isEditableElement(target)) return
  if (getEngineMode() !== 'internal_shadow') return

  const context = buildFieldContext({
    element: target,
    session,
    cycleId: `sh-${++cycle}`,
    composing,
    textLength: 0,
  })

  if (shouldSkipAnalysis(context)) {
    const decision = decideWriting(context, null, [])
    recordShadowDecision({ context, analysis: null, candidates: [], decision, analyzed: false })
    return
  }

  const text = readFieldText(target)
  context.textLength = text.length
  const caret = document.activeElement === target
    ? (readCaret(target) ?? text.length)
    : text.length
  const analysis = analyzeFieldText(text, { caret })
  const hypotheses = collectHypotheses(text, caret, context, analysis)
  const candidates = candidatesFromHypotheses(hypotheses)
  const decision = decideWriting(context, analysis, candidates, { hypotheses })
  recordShadowDecision({ context, analysis, candidates, decision, analyzed: true })
}

function shouldSkipAnalysis(context: FieldContext): boolean {
  if (!context.assistantEnabled) return true
  if (context.helpStyle === 'shortcuts_only') return true
  if (!context.safetyAllowed) return true
  if (context.composing) return true
  if (context.mutexHeld) return true
  if (context.editorTier !== 1) return true
  return false
}

/** Test helper: run one cycle against an already-built context without EventBus. */
export function runShadowDecisionForTests(
  context: FieldContext,
  text: string,
  caret = text.length,
) {
  if (shouldSkipAnalysis(context)) {
    const decision = decideWriting(context, null, [])
    const event = recordShadowDecision({
      context,
      analysis: null,
      candidates: [],
      decision,
      analyzed: false,
    })
    return { decision, event, candidates: [], analysis: null }
  }
  const analysis = analyzeFieldText(text, { caret })
  const hypotheses = collectHypotheses(text, caret, context, analysis)
  const candidates = candidatesFromHypotheses(hypotheses)
  const decision = decideWriting(context, analysis, candidates, { hypotheses })
  const event = recordShadowDecision({ context, analysis, candidates, decision, analyzed: true })
  return { decision, event, candidates, analysis, hypotheses }
}
