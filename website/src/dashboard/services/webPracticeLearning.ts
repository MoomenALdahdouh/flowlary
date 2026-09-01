import {
  countWords,
  hashWritingSample,
  type CorrectionResponse,
  type LearningEventIngestInput,
} from '@flowlary/shared'
import { ingestLearningEvents } from '../../account/learningEventsClient.ts'

function validChanges(segment: string, response: CorrectionResponse) {
  return response.changes.filter(
    (change) => segment.includes(change.original) && change.original !== change.corrected,
  )
}

export function buildPracticeLearningInputs(
  batchId: string,
  segment: string,
  response: CorrectionResponse,
  action: 'detected' | 'accepted' | 'rejected',
): LearningEventIngestInput[] {
  const sampleWordCount = countWords(segment)
  const sampleHash = hashWritingSample(segment)
  return validChanges(segment, response).map((change) => ({
    batchId,
    category: change.type,
    original: change.original,
    corrected: change.corrected,
    action,
    source: 'practice' as const,
    sampleWordCount,
    sampleHash,
  }))
}

export async function syncPracticeLearningEvent(
  batchId: string,
  segment: string,
  response: CorrectionResponse,
  action: 'detected' | 'accepted' | 'rejected',
): Promise<boolean> {
  const events = buildPracticeLearningInputs(batchId, segment, response, action)
  if (events.length === 0) return true
  const result = await ingestLearningEvents(events)
  return result.ok
}
