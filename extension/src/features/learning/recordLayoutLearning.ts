import {
  changePresentInWritingSample,
  countWords,
  isValidLearningChange,
} from '@flowlary/shared'
import { flowlaryStorage } from '../../storage/index.ts'
import { recordLearningEvents } from '../../storage/learning/events/index.ts'

export function buildLayoutLearningBatchId(requestId: number | string): string {
  return `layout-manual-${requestId}`
}

/**
 * Record an accepted manual keyboard-layout correction as a learning event.
 * Side effect only — never throws; does not affect the layout write path.
 */
export function recordLayoutLearningAccepted(
  batchId: string,
  sampleText: string,
  original: string,
  corrected: string,
): void {
  if (!isValidLearningChange(original, corrected)) return
  if (!changePresentInWritingSample(sampleText, original)) return
  void recordLearningEvents(flowlaryStorage, [
    {
      batchId,
      sampleText,
      sampleWordCount: countWords(sampleText),
      category: 'layout',
      original,
      corrected,
      action: 'accepted',
      source: 'writing',
    },
  ])
}
