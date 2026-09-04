import { evaluateFieldSafety } from '../safety/index.ts'
import { allowsAutomaticFieldWrite } from '../safety/autoWrite.ts'
import { isValueEditable, resolveEditableKind } from '../dom/read.ts'
import { looksLikeCodeEditor } from '../safety/codeEditor.ts'
import { resolveHelpStyle, resolveWritingPolicy } from '../policy/writingPolicy.ts'
import { stateManager } from '../state/StateManager.ts'
import { fieldKindFromElement } from '../observability/writeTelemetry.ts'
import { shouldEmitTranslationHypothesis } from '../../features/translation/pauseGate.ts'
import { isCorrectionSchedulerEligible } from '../../features/correction/liveAssist.ts'
import type { FieldSession } from '../session/FieldSession.ts'
import type { EditorTier, FieldContext, InputSource, TextRange } from './types.ts'

function editorTier(element: Element, safetyAllowed: boolean): EditorTier {
  if (!safetyAllowed) return 4
  if (element instanceof HTMLElement && looksLikeCodeEditor(element)) return 4
  if (isValueEditable(element)) return 1
  if (resolveEditableKind(element) === 'contenteditable') return 2
  return 4
}

export function buildFieldContext(options: {
  element: Element
  session: FieldSession
  cycleId: string
  composing: boolean
  textLength: number
  inputSource?: InputSource
  selection?: TextRange | null
}): FieldContext {
  const hostname = typeof location !== 'undefined' ? location.hostname : ''
  const safety = evaluateFieldSafety(options.element, {
    hostname,
    excludedDomains: stateManager.settings.excludedDomains,
  })
  const tier = editorTier(options.element, safety.allowed)
  const policy = resolveWritingPolicy()
  const autoWrite = allowsAutomaticFieldWrite(options.element) && safety.allowed && tier <= 2

  return {
    fieldId: options.session.field.id,
    generation: options.session.getGeneration(),
    cycleId: options.cycleId,
    editorTier: tier,
    capabilities: {
      autoWrite,
      suggestion: tier <= 2 && safety.allowed,
      manualShortcut: safety.allowed && tier <= 2,
    },
    safetyAllowed: safety.allowed,
    safetyReason: safety.reason,
    composing: options.composing || options.session.isComposing(),
    mutexHeld: options.session.getActiveRequest() !== null,
    translationSessionId: options.session.isTranslationPaused()
      ? null
      : options.session.getTranslationSessionId(),
    hostname,
    fieldKind: fieldKindFromElement(options.element),
    helpStyle: resolveHelpStyle(),
    assistantEnabled: policy.assistantEnabled,
    layoutAuto: policy.fixWrongTyping && policy.helpStyle === 'auto',
    correctionEnabled: policy.improveEnglish,
    aiAdvisorEnabled: policy.aiAdvisorEnabled,
    aiWritingReviewEnabled: policy.aiWritingReviewEnabled,
    liveTranslation: policy.liveTranslation,
    arabicToEnglishMode: policy.arabicToEnglishMode,
    translationPauseReady: shouldEmitTranslationHypothesis(
      options.session,
      policy.liveTranslation,
      { bypassPause: options.session.consumeBlurTranslationPass() },
    ),
    translatedRanges: [...options.session.getTranslatedRanges()],
    polishAfterTranslate: policy.polishAfterTranslate,
    liveWholeFieldCorrection: isCorrectionSchedulerEligible(),
    cooldownActive: options.session.isInCooldown(),
    textLength: options.textLength,
    inputSource: options.inputSource ?? options.session.getInputSource(),
    selection: options.selection ?? null,
  }
}
