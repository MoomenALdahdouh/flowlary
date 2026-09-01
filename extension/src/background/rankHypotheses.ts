import { FLOWLARY_API_BASE } from '../config/endpoints.ts'
import { prepareManagedAiRequest } from '../config/auth.ts'
import { flowlaryStorage } from '../storage/index.ts'
import type { AdvisorPacket } from '../core/engine/advisor.ts'
import type { RankHypothesesResponse } from '../core/engine/hypothesisAdvisorClient.ts'

const ADVISOR_CLIENT_TIMEOUT_MS = 1_800
const activeAdvisorRequests = new Map<string, AbortController>()

export async function handleRankHypotheses(packet: AdvisorPacket): Promise<RankHypothesesResponse> {
  if (!packet.cycleId || packet.hypotheses.length === 0) {
    return { type: 'RANK_HYPOTHESES_RESULT', ok: false, error: 'invalid_request' }
  }
  const controller = new AbortController()
  activeAdvisorRequests.get(packet.cycleId)?.abort()
  activeAdvisorRequests.set(packet.cycleId, controller)
  try {
    const headers = await prepareManagedAiRequest(flowlaryStorage)
    const timer = setTimeout(() => controller.abort(), ADVISOR_CLIENT_TIMEOUT_MS)
    let response: Response
    try {
      response = await fetch(`${FLOWLARY_API_BASE}/api/ai/hypothesis-advisor`, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          cycleId: packet.cycleId,
          snippet: packet.snippet,
          allowedIntents: packet.allowedIntents,
          hypotheses: packet.hypotheses.map((item) => ({
            id: item.id,
            intent: item.intent,
            localScore: item.localScore,
            risk: item.risk,
            needsLLM: item.needsLLM,
            conflicts: item.conflicts,
            evidence: item.evidence,
          })),
        }),
      })
    } finally {
      clearTimeout(timer)
    }
    if (!response.ok) {
      return { type: 'RANK_HYPOTHESES_RESULT', ok: false, error: `http_${response.status}` }
    }
    const payload = (await response.json()) as {
      rankedHypothesisIds?: string[]
      ambiguityClass?: string
      reasonCode?: string
    }
    if (
      !Array.isArray(payload.rankedHypothesisIds)
      || payload.rankedHypothesisIds.length === 0
      || typeof payload.ambiguityClass !== 'string'
      || typeof payload.reasonCode !== 'string'
    ) {
      return { type: 'RANK_HYPOTHESES_RESULT', ok: false, error: 'invalid_response' }
    }
    return {
      type: 'RANK_HYPOTHESES_RESULT',
      ok: true,
      vote: {
        rankedHypothesisIds: payload.rankedHypothesisIds,
        ambiguityClass: payload.ambiguityClass,
        reasonCode: payload.reasonCode,
      },
    }
  } catch {
    return { type: 'RANK_HYPOTHESES_RESULT', ok: false, error: 'network' }
  } finally {
    if (activeAdvisorRequests.get(packet.cycleId) === controller) {
      activeAdvisorRequests.delete(packet.cycleId)
    }
  }
}

export function cancelRankHypotheses(cycleId: string): void {
  activeAdvisorRequests.get(cycleId)?.abort()
}

export function resetRankHypothesesForTests(): void {
  for (const controller of activeAdvisorRequests.values()) controller.abort()
  activeAdvisorRequests.clear()
}
