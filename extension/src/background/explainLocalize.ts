import {
  applyLocalizedPresentation,
  buildExplanationLocalizeCacheKey,
  canRequestAiExplanationLocalization,
  getStaticTrustedRulePresentation,
  getTrustedRuleById,
  hasProProductExperience,
  isUiLocaleCode,
  type ExplanationLocalizeRequest,
  type LocalizedPresentationFields,
  type RuleExplanation,
  type UiLocaleCode,
} from '@flowlary/shared'
import { FLOWLARY_API_BASE } from '../config/endpoints.ts'
import { prepareManagedAiRequest } from '../config/auth.ts'
import { getEntitlementService } from '../entitlement/service.ts'
import { isCorrectionAiReady } from '../features/correction/readiness.ts'
import { stateManager } from '../core/state/StateManager.ts'
import { flowlaryStorage } from '../storage/index.ts'
import { activeAccountContext } from '../storage/activeAccountContext.ts'
import type {
  LocalizeExplanationRequest,
  LocalizeExplanationResponse,
} from '../features/correction/explainLocalizeClient.ts'

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const presentationCache = new Map<string, { expiresAt: number; fields: LocalizedPresentationFields }>()
const inflight = new Map<string, Promise<LocalizedPresentationFields | null>>()

function cacheGet(key: string): LocalizedPresentationFields | null {
  const entry = presentationCache.get(key)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    presentationCache.delete(key)
    return null
  }
  return entry.fields
}

function cacheSet(key: string, fields: LocalizedPresentationFields): void {
  presentationCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, fields })
}

function resolveRuleVersion(explanation: RuleExplanation, provided?: string): string {
  if (provided?.trim()) return provided.trim()
  const rule = explanation.ruleId ? getTrustedRuleById(explanation.ruleId) : undefined
  return rule?.version ?? '1.0'
}

function buildPayload(
  explanation: RuleExplanation,
  locale: UiLocaleCode,
  ruleVersion: string,
): ExplanationLocalizeRequest | null {
  if (!explanation.ruleId || !explanation.ruleTitle) return null
  return {
    locale,
    ruleId: explanation.ruleId,
    ruleVersion,
    ruleTitle: explanation.ruleTitle,
    summary: explanation.summary,
    why: explanation.why,
  }
}

async function fetchFromBackend(
  payload: ExplanationLocalizeRequest,
  accountSnapshot: ReturnType<typeof activeAccountContext.snapshot>,
): Promise<LocalizedPresentationFields | null> {
  if (!isCorrectionAiReady(stateManager.correction)) return null

  const entitlement = await getEntitlementService(flowlaryStorage).getSnapshot()
  if (!hasProProductExperience(entitlement)) return null

  const headers = await prepareManagedAiRequest(flowlaryStorage)

  const response = await fetch(`${FLOWLARY_API_BASE}/api/ai/explanation-localize`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })

  if (!activeAccountContext.matches(accountSnapshot)) return null

  if (!response.ok) return null
  const body = (await response.json()) as {
    ok?: boolean
    data?: LocalizedPresentationFields
  }
  if (!body.ok || !body.data) return null
  return body.data
}

export async function handleLocalizeExplanation(
  message: LocalizeExplanationRequest,
): Promise<LocalizeExplanationResponse> {
  const { requestId, locale, explanation, ruleVersion: providedVersion } = message

  if (!isUiLocaleCode(locale)) {
    return { type: 'LOCALIZE_EXPLANATION_RESULT', ok: false, requestId, error: 'invalid_locale' }
  }

  if (!canRequestAiExplanationLocalization(explanation, locale)) {
    return { type: 'LOCALIZE_EXPLANATION_RESULT', ok: false, requestId, error: 'not_eligible' }
  }

  if (getStaticTrustedRulePresentation(explanation.ruleId, locale)) {
    return { type: 'LOCALIZE_EXPLANATION_RESULT', ok: false, requestId, error: 'static_available' }
  }

  const ruleVersion = resolveRuleVersion(explanation, providedVersion)
  const cacheKey = buildExplanationLocalizeCacheKey(explanation.ruleId!, ruleVersion, locale)
  const cached = cacheGet(cacheKey)
  if (cached) {
    return {
      type: 'LOCALIZE_EXPLANATION_RESULT',
      ok: true,
      requestId,
      fields: cached,
      fromCache: true,
    }
  }

  const accountSnapshot = activeAccountContext.snapshot()
  const existing = inflight.get(cacheKey)
  if (existing) {
    const fields = await existing
    if (!fields) {
      return { type: 'LOCALIZE_EXPLANATION_RESULT', ok: false, requestId, error: 'upstream' }
    }
    return {
      type: 'LOCALIZE_EXPLANATION_RESULT',
      ok: true,
      requestId,
      fields,
      fromCache: false,
    }
  }

  const payload = buildPayload(explanation, locale, ruleVersion)
  if (!payload) {
    return { type: 'LOCALIZE_EXPLANATION_RESULT', ok: false, requestId, error: 'invalid_payload' }
  }

  const task = fetchFromBackend(payload, accountSnapshot)
    .then((fields) => {
      if (fields) cacheSet(cacheKey, fields)
      return fields
    })
    .finally(() => {
      inflight.delete(cacheKey)
    })

  inflight.set(cacheKey, task)
  const fields = await task
  if (!fields) {
    return { type: 'LOCALIZE_EXPLANATION_RESULT', ok: false, requestId, error: 'upstream' }
  }

  return {
    type: 'LOCALIZE_EXPLANATION_RESULT',
    ok: true,
    requestId,
    fields,
    fromCache: false,
  }
}

/** Test helper */
export function clearExplanationLocalizeCache(): void {
  presentationCache.clear()
  inflight.clear()
}

/** Test helper */
export function peekExplanationLocalizeCache(key: string): LocalizedPresentationFields | null {
  return cacheGet(key)
}

/** Test helper */
export function seedExplanationLocalizeCache(
  ruleId: string,
  ruleVersion: string,
  locale: UiLocaleCode,
  fields: LocalizedPresentationFields,
): void {
  cacheSet(buildExplanationLocalizeCacheKey(ruleId, ruleVersion, locale), fields)
}

export function presentLocalizedExplanation(
  explanation: RuleExplanation,
  locale: UiLocaleCode,
  fields?: LocalizedPresentationFields | null,
): RuleExplanation {
  const base = getStaticTrustedRulePresentation(explanation.ruleId, locale)
    ? applyLocalizedPresentation(
        explanation,
        getStaticTrustedRulePresentation(explanation.ruleId, locale)!,
      )
    : explanation
  if (!fields) return base
  return applyLocalizedPresentation(base, fields)
}
