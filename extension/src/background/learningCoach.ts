import {
  isUiLocaleCode,
  type LearningCoachContext,
  type LearningCoachResponse,
  type UiLocaleCode,
} from '@flowlary/shared'
import { FLOWLARY_API_BASE } from '../config/endpoints.ts'
import { managedFetchTimeoutSignal } from '../config/fetchTimeout.ts'
import { prepareManagedAiRequest } from '../config/auth.ts'
import { flowlaryStorage } from '../storage/index.ts'
import { activeAccountContext } from '../storage/activeAccountContext.ts'
import { isCorrectionAiReady } from '../features/correction/readiness.ts'
import { stateManager } from '../core/state/StateManager.ts'

export async function fetchLearningCoachNarration(
  context: LearningCoachContext,
  locale: UiLocaleCode,
  accountSnapshot: ReturnType<typeof activeAccountContext.snapshot>,
): Promise<LearningCoachResponse | null> {
  if (!isUiLocaleCode(locale)) return null
  if (!isCorrectionAiReady(stateManager.correction)) return null

  const headers = await prepareManagedAiRequest(flowlaryStorage)

  try {
    const response = await fetch(`${FLOWLARY_API_BASE}/api/ai/learning-coach`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ locale, context }),
      signal: managedFetchTimeoutSignal(),
    })

    if (!activeAccountContext.matches(accountSnapshot)) return null
    if (!response.ok) return null

    const body = (await response.json()) as {
      ok?: boolean
      data?: LearningCoachResponse
    }
    if (!body.ok || !body.data) return null
    return body.data
  } catch {
    return null
  }
}
