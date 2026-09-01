/**
 * Production writing review client. Never writes.
 */
import type { WritingReviewPacket, WritingReviewResponse } from '@flowlary/shared'
import { setWritingReview, type WritingReviewFn } from './writingReview.ts'

export type ReviewWritingMessage = {
  type: 'REVIEW_WRITING'
  packet: WritingReviewPacket
}

export type ReviewWritingResponse =
  | { type: 'REVIEW_WRITING_RESULT'; ok: true; review: WritingReviewResponse }
  | { type: 'REVIEW_WRITING_RESULT'; ok: false; error: string }

export const productionWritingReview: WritingReviewFn = async (packet, options) => {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    throw new Error('unavailable')
  }
  if (options?.signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  const messagePromise = chrome.runtime.sendMessage({
    type: 'REVIEW_WRITING',
    packet,
  }) as Promise<ReviewWritingResponse | undefined>
  let abortListener: (() => void) | undefined
  const response = await (options?.signal
    ? Promise.race([
        messagePromise,
        new Promise<never>((_resolve, reject) => {
          abortListener = () => {
            void chrome.runtime.sendMessage({
              type: 'CANCEL_REVIEW_WRITING',
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
  return response.review
}

export function registerProductionWritingReview(): void {
  setWritingReview(productionWritingReview)
}
