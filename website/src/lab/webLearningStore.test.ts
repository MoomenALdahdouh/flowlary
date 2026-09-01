import { describe, expect, it, beforeEach } from 'vitest'
import type { CorrectionResponse } from '@flowlary/shared'
import {
  buildWebLearningInputs,
  clearWebLearningStore,
  readWebLearningStore,
  recordWebCorrectionLearning,
} from './webLearningStore.ts'
import { computeWebRecurringPatterns } from './webLearningInsights.ts'

const sampleResponse: CorrectionResponse = {
  originalText: 'Yesterday I go to university.',
  correctedText: 'Yesterday I went to university.',
  changes: [
    {
      type: 'grammar',
      original: 'go',
      corrected: 'went',
      start: 11,
      end: 13,
    },
    {
      type: 'layout',
      original: 'ghbdtn',
      corrected: 'hello',
      start: 0,
      end: 6,
    },
  ],
}

describe('webLearningStore', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('excludes layout changes from learning inputs', () => {
    const inputs = buildWebLearningInputs('batch-1', sampleResponse.originalText, sampleResponse)
    expect(inputs).toHaveLength(1)
    expect(inputs[0]?.category).toBe('grammar')
  })

  it('dedupes events for the same batch/category/original', () => {
    const addedFirst = recordWebCorrectionLearning('acc-a', 'batch-1', sampleResponse.originalText, sampleResponse)
    const addedSecond = recordWebCorrectionLearning('acc-a', 'batch-1', sampleResponse.originalText, sampleResponse)
    expect(addedFirst).toBe(1)
    expect(addedSecond).toBe(0)
    expect(readWebLearningStore('acc-a').events).toHaveLength(1)
  })

  it('isolates learning stores by account', () => {
    recordWebCorrectionLearning('acc-a', 'batch-1', sampleResponse.originalText, sampleResponse)
    recordWebCorrectionLearning('acc-b', 'batch-2', sampleResponse.originalText, sampleResponse)
    expect(readWebLearningStore('acc-a').events).toHaveLength(1)
    expect(readWebLearningStore('acc-b').events).toHaveLength(1)
    clearWebLearningStore('acc-a')
    expect(readWebLearningStore('acc-a').events).toHaveLength(0)
    expect(readWebLearningStore('acc-b').events).toHaveLength(1)
  })
})

describe('computeWebRecurringPatterns', () => {
  it('returns a pattern after two distinct batches', () => {
    recordWebCorrectionLearning('acc-a', 'batch-1', sampleResponse.originalText, sampleResponse)
    recordWebCorrectionLearning('acc-a', 'batch-2', sampleResponse.originalText, sampleResponse)
    const patterns = computeWebRecurringPatterns(readWebLearningStore('acc-a').events)
    expect(patterns).toHaveLength(1)
    expect(patterns[0]?.count).toBe(2)
    expect(patterns[0]?.displayOriginal).toBe('go')
  })
})
