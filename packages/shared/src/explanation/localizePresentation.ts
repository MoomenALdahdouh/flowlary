import type { UiLocaleCode } from '../uiLocales.ts'
import type { RuleExplanation } from './index.ts'

export type LocalizedPresentationFields = {
  ruleTitle?: string
  summary?: string
  why?: string
}

export type ExplanationLocalizeRequest = {
  locale: UiLocaleCode
  ruleId: string
  ruleVersion: string
  ruleTitle: string
  summary: string
  why?: string
}

export type ExplanationLocalizeResponse = {
  ruleTitle: string
  summary: string
  why?: string
}

const MAX_PRESENTATION_FIELD_LENGTH = 500

export function buildExplanationLocalizeCacheKey(
  ruleId: string,
  ruleVersion: string,
  locale: UiLocaleCode,
): string {
  return `EXPLAIN_LOCALIZE:${ruleId}:${ruleVersion}:${locale}`
}

/** Merge localized presentation text without touching identity or English examples. */
export function applyLocalizedPresentation(
  explanation: RuleExplanation,
  fields: LocalizedPresentationFields,
): RuleExplanation {
  return {
    ...explanation,
    ruleTitle: fields.ruleTitle?.trim() || explanation.ruleTitle,
    summary: fields.summary?.trim() || explanation.summary,
    why: fields.why?.trim() || explanation.why,
  }
}

export function validateExplanationLocalizeRequest(value: unknown): value is ExplanationLocalizeRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const obj = value as Record<string, unknown>
  return (
    typeof obj.locale === 'string' &&
    typeof obj.ruleId === 'string' &&
    typeof obj.ruleVersion === 'string' &&
    typeof obj.ruleTitle === 'string' &&
    typeof obj.summary === 'string' &&
    obj.ruleId.trim().length > 0 &&
    obj.ruleVersion.trim().length > 0 &&
    obj.ruleTitle.trim().length > 0 &&
    obj.summary.trim().length > 0 &&
    (obj.why === undefined || typeof obj.why === 'string')
  )
}

export function validateExplanationLocalizeResponse(
  value: unknown,
  request: ExplanationLocalizeRequest,
): ExplanationLocalizeResponse | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const obj = value as Record<string, unknown>
  if (typeof obj.ruleTitle !== 'string' || typeof obj.summary !== 'string') return null
  const ruleTitle = obj.ruleTitle.trim()
  const summary = obj.summary.trim()
  if (!ruleTitle || !summary) return null
  if (ruleTitle.length > MAX_PRESENTATION_FIELD_LENGTH || summary.length > MAX_PRESENTATION_FIELD_LENGTH) {
    return null
  }
  let why: string | undefined
  if (typeof obj.why === 'string' && obj.why.trim()) {
    why = obj.why.trim()
    if (why.length > MAX_PRESENTATION_FIELD_LENGTH) return null
  }
  if (obj.ruleId !== undefined && obj.ruleId !== request.ruleId) return null
  if (obj.source !== undefined || obj.confidence !== undefined) return null
  return { ruleTitle, summary, why }
}

export function canRequestAiExplanationLocalization(
  explanation: RuleExplanation,
  locale: UiLocaleCode,
): boolean {
  return (
    locale !== 'en' &&
    explanation.source === 'trusted_rule' &&
    explanation.confidence === 'high' &&
    Boolean(explanation.ruleId?.trim())
  )
}
