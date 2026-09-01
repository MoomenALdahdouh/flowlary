import { FLOWLARY_API_BASE } from '../config/endpoints.ts'
import { prepareManagedAiRequest } from '../config/auth.ts'
import { flowlaryStorage } from '../storage/index.ts'
import { parseWritingReviewContent, type WritingReviewPacket } from '@flowlary/shared'
import type { ReviewWritingResponse } from '../core/engine/writingReviewClient.ts'

const REVIEW_CLIENT_TIMEOUT_MS = 5_200
const activeReviewRequests = new Map<string, AbortController>()

export async function handleReviewWriting(packet: WritingReviewPacket): Promise<ReviewWritingResponse> {
  if (!packet.cycleId || !packet.snippet.trim()) {
    return { type: 'REVIEW_WRITING_RESULT', ok: false, error: 'invalid_request' }
  }
  const controller = new AbortController()
  activeReviewRequests.get(packet.cycleId)?.abort()
  activeReviewRequests.set(packet.cycleId, controller)
  try {
    const headers = await prepareManagedAiRequest(flowlaryStorage)
    const timer = setTimeout(() => controller.abort(), REVIEW_CLIENT_TIMEOUT_MS)
    let response: Response
    try {
      response = await fetch(`${FLOWLARY_API_BASE}/api/ai/writing-review`, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          cycleId: packet.cycleId,
          snippet: packet.snippet,
          contextBefore: packet.contextBefore,
          contextAfter: packet.contextAfter,
          allowedKinds: packet.allowedKinds,
        }),
      })
    } finally {
      clearTimeout(timer)
    }
    if (!response.ok) {
      return { type: 'REVIEW_WRITING_RESULT', ok: false, error: `http_${response.status}` }
    }
    const payload = await response.json() as Record<string, unknown>
    const parsed = parseWritingReviewContent(JSON.stringify({
      verdict: payload.verdict,
      ambiguityClass: payload.ambiguityClass,
      reasonCode: payload.reasonCode,
      edits: payload.edits,
    }), packet.snippet)
    if (!parsed.ok) {
      return { type: 'REVIEW_WRITING_RESULT', ok: false, error: parsed.reason }
    }
    return {
      type: 'REVIEW_WRITING_RESULT',
      ok: true,
      review: parsed.value,
    }
  } catch {
    return { type: 'REVIEW_WRITING_RESULT', ok: false, error: 'network' }
  } finally {
    if (activeReviewRequests.get(packet.cycleId) === controller) {
      activeReviewRequests.delete(packet.cycleId)
    }
  }
}

export function cancelReviewWriting(cycleId: string): void {
  activeReviewRequests.get(cycleId)?.abort()
}

export function resetReviewWritingForTests(): void {
  for (const controller of activeReviewRequests.values()) controller.abort()
  activeReviewRequests.clear()
}
