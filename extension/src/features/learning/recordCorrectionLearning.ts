import type { CorrectionChange, CorrectionResponse, LearningEventSource } from '@flowlary/shared'
import { countWords, tightenCorrectionPair } from '@flowlary/shared'
import { flowlaryStorage } from '../../storage/index.ts'
import { recordLearningEvents, type LearningEventInput } from '../../storage/learning/events/index.ts'

function validChanges(segment: string, changes: CorrectionChange[]): CorrectionChange[] {
  return changes.filter((change) => segment.includes(change.original) && change.original !== change.corrected)
}

function toInputs(
  batchId: string,
  segment: string,
  changes: CorrectionChange[],
  action: LearningEventInput['action'],
  source: LearningEventSource = 'writing',
): LearningEventInput[] {
  const sampleWordCount = countWords(segment)
  return validChanges(segment, changes).map((change) => {
    const tight = tightenCorrectionPair(change.original, change.corrected)
    return {
      batchId,
      sampleText: segment,
      sampleWordCount,
      category: change.type,
      original: tight.original,
      corrected: tight.corrected,
      action,
      source,
    }
  })
}

function record(
  batchId: string,
  segment: string,
  response: CorrectionResponse,
  action: LearningEventInput['action'],
  source: LearningEventSource = 'writing',
): void {
  const inputs = toInputs(batchId, segment, response.changes, action, source)
  if (inputs.length === 0) return
  void recordLearningEvents(flowlaryStorage, inputs)
}

export function recordCorrectionDetected(
  batchId: string,
  segment: string,
  response: CorrectionResponse,
  source: LearningEventSource = 'writing',
): void {
  record(batchId, segment, response, 'detected', source)
}

export function recordCorrectionAccepted(
  batchId: string,
  segment: string,
  response: CorrectionResponse,
  source: LearningEventSource = 'writing',
): void {
  record(batchId, segment, response, 'accepted', source)
}

export function recordCorrectionRejected(
  batchId: string,
  segment: string,
  response: CorrectionResponse,
  source: LearningEventSource = 'writing',
): void {
  record(batchId, segment, response, 'rejected', source)
}

export function recordPracticeDetected(
  batchId: string,
  segment: string,
  response: CorrectionResponse,
): void {
  recordCorrectionDetected(batchId, segment, response, 'practice')
}

export function recordPracticeAccepted(
  batchId: string,
  segment: string,
  response: CorrectionResponse,
): void {
  recordCorrectionAccepted(batchId, segment, response, 'practice')
}

export function recordPracticeRejected(
  batchId: string,
  segment: string,
  response: CorrectionResponse,
): void {
  recordCorrectionRejected(batchId, segment, response, 'practice')
}
