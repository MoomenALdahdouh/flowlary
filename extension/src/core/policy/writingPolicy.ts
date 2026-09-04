/**
 * Intent-first user writing policy. Feature flags are a compatibility projection.
 */

import { stateManager } from '../state/StateManager.ts'
import type {
  CorrectionSettings,
  FlowlarySettings,
  HelpStyle,
  LayoutSettings,
  TranslationSettings,
} from '../state/StateManager.ts'

export type { HelpStyle }

export type OperatingState = 'normal' | 'translation' | 'manual'

export type UserWritingPolicy = {
  helpStyle: HelpStyle
  assistantEnabled: boolean
  fixWrongTyping: boolean
  improveEnglish: boolean
  arabicToEnglishMode: boolean
  polishAfterTranslate: boolean
  improveEnglishAfterTranslate: boolean
  aiAdvisorEnabled: boolean
  aiWritingReviewEnabled: boolean
  operatingState: OperatingState
  derived: boolean
}

export type WritingPolicySnapshot = UserWritingPolicy & {
  liveTranslation: boolean
}

export type WritingPolicyPatch = {
  helpStyle?: HelpStyle | null
  fixWrongTyping?: boolean
  improveEnglish?: boolean
  arabicToEnglishMode?: boolean
  polishAfterTranslate?: boolean
  improveEnglishAfterTranslate?: boolean
  aiAdvisorEnabled?: boolean
  aiWritingReviewEnabled?: boolean
}

/** First-run / onboarding capability answers (not a global helpStyle). */
export type FirstWinCapabilityAnswers = {
  fixWrongTyping: boolean
  improveEnglishAuto: boolean
  arabicToEnglishMode: boolean
}

export type FirstWinPolicyMapping = {
  policy: WritingPolicyPatch
  /** English Direct vs Card. `box` means English is not automatic. */
  correctionMode: 'box' | 'direct'
}

const HELP_STYLES: readonly HelpStyle[] = ['auto', 'suggestions', 'shortcuts_only']

export function isHelpStyle(value: unknown): value is HelpStyle {
  return typeof value === 'string' && (HELP_STYLES as readonly string[]).includes(value)
}

function optionalBoolean(value: boolean | null | undefined, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function modeForHelpStyle(helpStyle: HelpStyle): 'box' | 'direct' {
  return helpStyle === 'suggestions' ? 'box' : 'direct'
}

export function deriveHelpStyle(
  correction = stateManager.correction,
  translation = stateManager.translation,
  layout = stateManager.layout,
): HelpStyle {
  const layoutAuto = layout.autoEnabled && layout.mode === 'direct'
  const correctionAuto = correction.enabled && correction.mode === 'direct'
  const liveAuto =
    translation.shortcutEnabled && translation.liveEnabled && translation.mode === 'direct'

  if (layoutAuto || correctionAuto || liveAuto) return 'auto'

  const layoutSuggest = layout.autoEnabled && layout.mode === 'box'
  const correctionSuggest = correction.enabled && correction.mode === 'box'
  const translationSuggest = translation.shortcutEnabled && translation.mode === 'box'
  if (layoutSuggest || correctionSuggest || translationSuggest) return 'suggestions'

  return 'shortcuts_only'
}

export function resolveHelpStyle(
  correction = stateManager.correction,
  translation = stateManager.translation,
  layout = stateManager.layout,
  settings = stateManager.settings,
): HelpStyle {
  if (isHelpStyle(settings.helpStyle)) return settings.helpStyle
  return deriveHelpStyle(correction, translation, layout)
}

export function resolveOperatingState(
  helpStyle: HelpStyle,
  arabicToEnglishMode: boolean,
): OperatingState {
  if (helpStyle === 'shortcuts_only') return 'manual'
  if (arabicToEnglishMode) return 'translation'
  return 'normal'
}

export function resolveWritingPolicy(
  correction = stateManager.correction,
  translation = stateManager.translation,
  layout = stateManager.layout,
  settings = stateManager.settings,
): WritingPolicySnapshot {
  const helpStyle = resolveHelpStyle(correction, translation, layout, settings)
  const fixWrongTyping = optionalBoolean(settings.fixWrongTyping, layout.autoEnabled)
  const improveEnglish = optionalBoolean(settings.improveEnglish, correction.enabled)
  const arabicToEnglishMode = optionalBoolean(settings.arabicToEnglishMode, translation.liveEnabled)
  const polishAfterTranslate = optionalBoolean(
    settings.polishAfterTranslate,
    settings.improveEnglishAfterTranslate === true,
  )
  return {
    helpStyle,
    assistantEnabled: stateManager.isActive(),
    fixWrongTyping,
    improveEnglish,
    arabicToEnglishMode,
    polishAfterTranslate,
    improveEnglishAfterTranslate: polishAfterTranslate,
    liveTranslation: arabicToEnglishMode && helpStyle !== 'shortcuts_only',
    aiAdvisorEnabled: optionalBoolean(settings.aiAdvisorEnabled, true),
    aiWritingReviewEnabled: optionalBoolean(settings.aiWritingReviewEnabled, true),
    operatingState: resolveOperatingState(helpStyle, arabicToEnglishMode),
    derived: !isHelpStyle(settings.helpStyle),
  }
}

export function isShortcutsOnly(): boolean {
  return resolveHelpStyle() === 'shortcuts_only'
}

export function allowAutomaticNetworkAssist(): boolean {
  return stateManager.isActive() && !isShortcutsOnly()
}

export function projectPolicyOntoFeatures(policy: UserWritingPolicy): {
  settings: FlowlarySettings
  layout: LayoutSettings
  correction: CorrectionSettings
  translation: TranslationSettings
} {
  const mode = modeForHelpStyle(policy.helpStyle)
  const autoOn = policy.helpStyle !== 'shortcuts_only'
  return {
    settings: {
      ...stateManager.settings,
      helpStyle: policy.helpStyle,
      fixWrongTyping: policy.fixWrongTyping,
      improveEnglish: policy.improveEnglish,
      arabicToEnglishMode: policy.arabicToEnglishMode,
      polishAfterTranslate: policy.polishAfterTranslate,
      improveEnglishAfterTranslate: policy.polishAfterTranslate,
      aiAdvisorEnabled: policy.aiAdvisorEnabled,
      aiWritingReviewEnabled: policy.aiWritingReviewEnabled,
    },
    layout: {
      ...stateManager.layout,
      autoEnabled: policy.fixWrongTyping && autoOn,
      mode,
    },
    correction: {
      ...stateManager.correction,
      enabled: policy.improveEnglish,
      mode,
    },
    translation: {
      ...stateManager.translation,
      shortcutEnabled: true,
      liveEnabled: policy.arabicToEnglishMode && policy.helpStyle !== 'shortcuts_only',
      mode,
    },
  }
}

export function applyUserPolicyToMemory(policy: UserWritingPolicy): void {
  const next = projectPolicyOntoFeatures(policy)
  Object.assign(stateManager.settings, next.settings)
  Object.assign(stateManager.layout, next.layout)
  Object.assign(stateManager.correction, next.correction)
  Object.assign(stateManager.translation, next.translation)
}

export function extractPolicyPatch(patch: Record<string, unknown>): WritingPolicyPatch {
  const next: WritingPolicyPatch = {}
  if (isHelpStyle(patch.helpStyle) || patch.helpStyle === null) next.helpStyle = patch.helpStyle
  if (typeof patch.fixWrongTyping === 'boolean') next.fixWrongTyping = patch.fixWrongTyping
  if (typeof patch.improveEnglish === 'boolean') next.improveEnglish = patch.improveEnglish
  if (typeof patch.arabicToEnglishMode === 'boolean') {
    next.arabicToEnglishMode = patch.arabicToEnglishMode
  }
  if (typeof patch.polishAfterTranslate === 'boolean') {
    next.polishAfterTranslate = patch.polishAfterTranslate
  }
  if (typeof patch.improveEnglishAfterTranslate === 'boolean') {
    next.improveEnglishAfterTranslate = patch.improveEnglishAfterTranslate
  }
  if (typeof patch.aiAdvisorEnabled === 'boolean') next.aiAdvisorEnabled = patch.aiAdvisorEnabled
  if (typeof patch.aiWritingReviewEnabled === 'boolean') {
    next.aiWritingReviewEnabled = patch.aiWritingReviewEnabled
  }
  return next
}

export function policyPatchHasKeys(patch: WritingPolicyPatch): boolean {
  return Object.keys(patch).length > 0
}

export function applyUserWritingPolicy(patch: WritingPolicyPatch): WritingPolicySnapshot {
  const current = resolveWritingPolicy()
  const helpStyle =
    patch.helpStyle === null ? deriveHelpStyle() : (patch.helpStyle ?? current.helpStyle)
  const polishAfterTranslate =
    patch.polishAfterTranslate ??
    patch.improveEnglishAfterTranslate ??
    current.polishAfterTranslate
  const next: UserWritingPolicy = {
    ...current,
    helpStyle,
    fixWrongTyping: patch.fixWrongTyping ?? current.fixWrongTyping,
    improveEnglish: patch.improveEnglish ?? current.improveEnglish,
    arabicToEnglishMode: patch.arabicToEnglishMode ?? current.arabicToEnglishMode,
    polishAfterTranslate,
    improveEnglishAfterTranslate: polishAfterTranslate,
    aiAdvisorEnabled: patch.aiAdvisorEnabled ?? current.aiAdvisorEnabled,
    aiWritingReviewEnabled: patch.aiWritingReviewEnabled ?? current.aiWritingReviewEnabled,
    operatingState: resolveOperatingState(
      helpStyle,
      patch.arabicToEnglishMode ?? current.arabicToEnglishMode,
    ),
  }
  applyUserPolicyToMemory(next)
  return resolveWritingPolicy()
}

/** Single read model for popup/debug: policy + site + advisor + exceptions. */
export function resolveProductControls() {
  const policy = resolveWritingPolicy()
  return {
    ...policy,
    excludedDomains: [...stateManager.settings.excludedDomains],
    personalExceptions: [...stateManager.personalExceptions],
    aiAdvisorEnabled: policy.aiAdvisorEnabled,
    aiWritingReviewEnabled: policy.aiWritingReviewEnabled,
  }
}

export function policyPatchKeys(patch: Record<string, unknown>): boolean {
  return policyPatchHasKeys(extractPolicyPatch(patch))
}

/**
 * Map First Win / onboarding answers without using global shortcuts_only
 * when layout or translation should stay automatic.
 */
export function policyPatchFromFirstWin(answers: FirstWinCapabilityAnswers): FirstWinPolicyMapping {
  const anotherAuto = answers.fixWrongTyping || answers.arabicToEnglishMode
  if (!answers.improveEnglishAuto && !anotherAuto) {
    return {
      policy: {
        helpStyle: 'shortcuts_only',
        fixWrongTyping: false,
        improveEnglish: true,
        arabicToEnglishMode: false,
      },
      correctionMode: 'direct',
    }
  }
  return {
    policy: {
      helpStyle: 'auto',
      fixWrongTyping: answers.fixWrongTyping,
      improveEnglish: true,
      arabicToEnglishMode: answers.arabicToEnglishMode,
    },
    correctionMode: answers.improveEnglishAuto ? 'direct' : 'box',
  }
}
