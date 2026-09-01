import {
  buildGroqReportPayload,
  isUiLocaleCode,
  validateLearningReportNarration,
  type LearningAnalysisSnapshot,
  type LearningCoachContext,
  type LearningCoachResponse,
  type LearningReportNarrationResponse,
  type UiLocaleCode,
} from '@flowlary/shared'
import { resolvePublicApiUrl } from '../../config.ts'
import { ensureFreshWebSession } from '../../account/client.ts'
import { ensureWebInstall } from '../../account/webInstall.ts'

async function authHeaders(): Promise<Record<string, string> | null> {
  const session = await ensureFreshWebSession()
  if (!session) return null
  let install
  try {
    install = await ensureWebInstall()
  } catch {
    return null
  }
  return {
    Authorization: `Bearer ${session.accessToken}`,
    'X-Flowlary-Install-Id': install.installId,
    'X-Flowlary-Client': 'website',
    'Content-Type': 'application/json',
  }
}

export async function fetchWebLearningCoach(
  context: LearningCoachContext,
  locale: UiLocaleCode,
): Promise<LearningCoachResponse | null> {
  if (!isUiLocaleCode(locale)) return null
  const headers = await authHeaders()
  if (!headers) return null

  try {
    const response = await fetch(`${resolvePublicApiUrl()}/api/ai/learning-coach`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ locale, context }),
    })
    if (!response.ok) return null
    const body = (await response.json()) as { ok?: boolean; data?: LearningCoachResponse }
    if (!body.ok || !body.data) return null
    return body.data
  } catch {
    return null
  }
}

export async function fetchWebLearningReportNarration(
  snapshot: LearningAnalysisSnapshot,
  locale: UiLocaleCode,
): Promise<LearningReportNarrationResponse | null> {
  if (!isUiLocaleCode(locale)) return null
  const headers = await authHeaders()
  if (!headers) return null

  try {
    const response = await fetch(`${resolvePublicApiUrl()}/api/ai/learning-report-narrate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        locale,
        snapshot: buildGroqReportPayload(snapshot),
      }),
    })
    if (!response.ok) return null
    const body = (await response.json()) as { ok?: boolean; data?: unknown }
    if (!body.ok || !body.data) return null
    return validateLearningReportNarration(body.data, snapshot)
  } catch {
    return null
  }
}
