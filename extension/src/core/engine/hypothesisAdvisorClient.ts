/**
 * Production advisor: ranks hypotheses via the existing background → API path.
 * Never writes. Never returns replacement text.
 */
import type { AdvisorFn, AdvisorPacket } from './advisor.ts'
import type { AdvisorVote } from './types.ts'
import { setAdvisorApplyMode, setHypothesisAdvisor } from './advisor.ts'

export type RankHypothesesMessage = {
  type: 'RANK_HYPOTHESES'
  packet: AdvisorPacket
}

export type RankHypothesesResponse =
  | { type: 'RANK_HYPOTHESES_RESULT'; ok: true; vote: AdvisorVote }
  | { type: 'RANK_HYPOTHESES_RESULT'; ok: false; error: string }

export const productionHypothesisAdvisor: AdvisorFn = async (packet, options) => {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    throw new Error('unavailable')
  }
  if (options?.signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  const messagePromise = chrome.runtime.sendMessage({
    type: 'RANK_HYPOTHESES',
    packet,
  }) as Promise<RankHypothesesResponse | undefined>
  let abortListener: (() => void) | undefined
  const response = await (options?.signal
    ? Promise.race([
        messagePromise,
        new Promise<never>((_resolve, reject) => {
          abortListener = () => {
            void chrome.runtime.sendMessage({
              type: 'CANCEL_RANK_HYPOTHESES',
              cycleId: packet.cycleId,
            }).catch(() => undefined)
            reject(new DOMException('Aborted', 'AbortError'))
          }
          options.signal!.addEventListener('abort', abortListener, { once: true })
          if (options.signal!.aborted) abortListener()
        }),
      ]).finally(() => {
        if (abortListener) options.signal!.removeEventListener('abort', abortListener)
      })
    : messagePromise)
  if (!response || !response.ok) throw new Error(response?.error || 'unavailable')
  return response.vote
}

export function registerProductionHypothesisAdvisor(): void {
  setHypothesisAdvisor(productionHypothesisAdvisor)
  setAdvisorApplyMode('apply')
}
