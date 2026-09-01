import { describe, expect, it } from 'vitest'
import {
  LEARNING_EVENT_STORE_VERSION,
  LEARNING_EVENT_VERSION,
  type LearningEvent,
  type LearningEventStoreV1,
} from '@flowlary/shared'
import { mergeLearningEventStores } from '../../extension/src/storage/learning/events/remoteSync.ts'

function event(partial: Partial<LearningEvent> & Pick<LearningEvent, 'batchId' | 'category' | 'original'>): LearningEvent {
  return {
    id: partial.id ?? 'id-1',
    version: LEARNING_EVENT_VERSION,
    timestamp: partial.timestamp ?? Date.now(),
    batchId: partial.batchId,
    source: partial.source ?? 'writing',
    category: partial.category,
    original: partial.original,
    corrected: partial.corrected ?? 'fixed',
    normalizedOriginal: partial.normalizedOriginal ?? partial.original.toLowerCase(),
    normalizedCorrected: partial.normalizedCorrected ?? 'fixed',
    action: partial.action ?? 'detected',
    sampleWordCount: partial.sampleWordCount ?? 5,
    sampleHash: partial.sampleHash ?? 'hash-1',
  }
}

function store(events: LearningEvent[]): LearningEventStoreV1 {
  return { version: LEARNING_EVENT_STORE_VERSION, events, samples: [] }
}

describe('mergeLearningEventStores', () => {
  it('merges remote website events into local extension store without duplicates', () => {
    const local = store([
      event({ batchId: 'ext-1', category: 'grammar', original: 'go', normalizedOriginal: 'go' }),
    ])
    const remote = store([
      event({ batchId: 'web-1', category: 'grammar', original: 'has', normalizedOriginal: 'has' }),
      event({ batchId: 'ext-1', category: 'grammar', original: 'go', normalizedOriginal: 'go' }),
    ])

    const merged = mergeLearningEventStores(local, remote)
    expect(merged.events).toHaveLength(2)
  })
})
