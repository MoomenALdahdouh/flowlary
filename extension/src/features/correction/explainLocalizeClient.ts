import {
  applyLocalizedPresentation,
  buildExplanationLocalizeCacheKey,
  canRequestAiExplanationLocalization,
  getStaticTrustedRulePresentation,
  resolveLocalizedPresentation,
  type LocalizedPresentationFields,
  type RuleExplanation,
  type UiLocaleCode,
} from '@flowlary/shared'

export type LocalizeExplanationRequest = {
  type: 'LOCALIZE_EXPLANATION'
  requestId: string
  locale: UiLocaleCode
  explanation: RuleExplanation
  ruleVersion?: string
}

export type LocalizeExplanationResponse =
  | {
      type: 'LOCALIZE_EXPLANATION_RESULT'
      ok: true
      requestId: string
      fields: LocalizedPresentationFields
      fromCache: boolean
    }
  | {
      type: 'LOCALIZE_EXPLANATION_RESULT'
      ok: false
      requestId: string
      error: string
    }

export function presentExplanationForLocale(
  explanation: RuleExplanation,
  locale: UiLocaleCode,
): RuleExplanation {
  return resolveLocalizedPresentation(explanation, locale)
}

export function needsAiExplanationLocalization(
  explanation: RuleExplanation,
  locale: UiLocaleCode,
): boolean {
  if (!canRequestAiExplanationLocalization(explanation, locale)) return false
  return !getStaticTrustedRulePresentation(explanation.ruleId, locale)
}

export async function requestExplanationLocalization(
  explanation: RuleExplanation,
  locale: UiLocaleCode,
  ruleVersion?: string,
): Promise<LocalizedPresentationFields | null> {
  if (!needsAiExplanationLocalization(explanation, locale)) return null

  const requestId = `explain-${Date.now()}-${Math.random().toString(16).slice(2)}`
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return null

  try {
    const response = (await chrome.runtime.sendMessage({
      type: 'LOCALIZE_EXPLANATION',
      requestId,
      locale,
      explanation,
      ruleVersion,
    })) as LocalizeExplanationResponse | undefined

    if (!response || response.type !== 'LOCALIZE_EXPLANATION_RESULT' || !response.ok) {
      return null
    }
    return response.fields
  } catch {
    return null
  }
}

export function mergeLocalizedFields(
  explanation: RuleExplanation,
  fields: LocalizedPresentationFields,
): RuleExplanation {
  return applyLocalizedPresentation(explanation, fields)
}
