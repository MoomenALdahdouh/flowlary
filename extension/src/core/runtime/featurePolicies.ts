import { CORRECTION_DEFAULTS } from '@flowlary/shared'
import { debounceOptionsForMode, getDebounceDelay } from '../../features/correction/debounce.ts'
import { shouldWholeFieldOwnEnglishCorrection } from '../../features/correction/liveAssist.ts'
import { LIVE_PAUSE_MS } from '../../features/translation/pauseGate.ts'
import { REVIEW_PAUSE_MS } from '../engine/writingReview.ts'
import { resolveWritingPolicy, type HelpStyle } from '../policy/writingPolicy.ts'
import type { SchedulerFeature } from './IdleScheduler.ts'

export const ENGLISH_NETWORK_SPACING_MS = CORRECTION_DEFAULTS.LIVE_CORRECTION_MIN_INTERVAL_MS

const ARABIC_LETTER = /[\u0600-\u06FF]/

export type FeaturePolicyInput = {
  text: string
  now: number
  lastInputAt: number
  lastEnglishNetworkAt: number
  composing: boolean
  focusOut: boolean
  helpStyle: HelpStyle
  englishMode: 'box' | 'direct'
  fixWrongTyping: boolean
  improveEnglish: boolean
  liveTranslation: boolean
  wholeFieldEnglish: boolean
  reviewEnabled: boolean
}

export function mayContainArabic(text: string): boolean {
  return ARABIC_LETTER.test(text)
}

export function englishDelayMs(text: string, mode: 'box' | 'direct'): number {
  return getDebounceDelay(text, debounceOptionsForMode(mode))
}

export function computeFeatureDeadlines(input: FeaturePolicyInput): Map<SchedulerFeature, number> {
  const deadlines = new Map<SchedulerFeature, number>()
  if (input.composing) return deadlines
  if (input.lastInputAt <= 0 && !input.focusOut) return deadlines

  const shortcuts = input.helpStyle === 'shortcuts_only'
  const delay = englishDelayMs(input.text, input.englishMode)
  const englishBoundaryDue = input.lastInputAt + delay

  if (!shortcuts && input.fixWrongTyping) {
    // Same delay as English for the current mode — not a separate 400ms layout retry.
    deadlines.set('layout', englishBoundaryDue)
  }

  if (!shortcuts && input.improveEnglish) {
    const spaced =
      input.lastEnglishNetworkAt > 0
        ? Math.max(englishBoundaryDue, input.lastEnglishNetworkAt + ENGLISH_NETWORK_SPACING_MS)
        : englishBoundaryDue
    deadlines.set('english', spaced)
  }

  if (!shortcuts && input.liveTranslation) {
    if (input.focusOut) {
      deadlines.set('translate', input.now)
    } else if (mayContainArabic(input.text)) {
      deadlines.set('translate', input.lastInputAt + LIVE_PAUSE_MS)
    }
  }

  if (!shortcuts && input.reviewEnabled && !input.wholeFieldEnglish) {
    deadlines.set('review', input.lastInputAt + REVIEW_PAUSE_MS)
  }

  return deadlines
}

export function resolveLivePolicyInput(options: {
  text: string
  now: number
  lastInputAt: number
  lastEnglishNetworkAt: number
  composing: boolean
  focusOut: boolean
}): FeaturePolicyInput {
  const policy = resolveWritingPolicy()
  const helpStyle = policy.helpStyle
  const englishMode = helpStyle === 'suggestions' ? 'box' : 'direct'
  return {
    text: options.text,
    now: options.now,
    lastInputAt: options.lastInputAt,
    lastEnglishNetworkAt: options.lastEnglishNetworkAt,
    composing: options.composing,
    focusOut: options.focusOut,
    helpStyle,
    englishMode,
    fixWrongTyping: policy.fixWrongTyping,
    improveEnglish: policy.improveEnglish,
    liveTranslation: policy.liveTranslation,
    wholeFieldEnglish: shouldWholeFieldOwnEnglishCorrection(),
    reviewEnabled:
      policy.assistantEnabled &&
      policy.aiWritingReviewEnabled !== false &&
      helpStyle !== 'shortcuts_only',
  }
}
