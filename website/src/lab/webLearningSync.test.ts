import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CorrectionResponse } from '@flowlary/shared'
import { hashWritingSample } from '@flowlary/shared'
import {
  readLearningEventQueue,
  resetWebLearningSyncForTests,
  syncWritingLabCorrection,
  writeLearningEventQueue,
} from './webLearningSync.ts'
import * as learningEventsClient from '../account/learningEventsClient.ts'
import { recordWebCorrectionLearning, readWebLearningStore } from './webLearningStore.ts'
import { acceptAllCookies } from '../cookies/consent.ts'

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
  ],
}

describe('webLearningSync', () => {
  beforeEach(() => {
    localStorage.clear()
    acceptAllCookies()
    resetWebLearningSyncForTests()
    vi.restoreAllMocks()
  })

  it('queues events when ingestion fails and retries safely', async () => {
    vi.spyOn(learningEventsClient, 'ingestLearningEvents')
      .mockResolvedValueOnce({ ok: false, code: 'network' })
      .mockResolvedValueOnce({ ok: true, accepted: 1, deduplicated: 0, rejected: 0 })

    const status = await syncWritingLabCorrection('acc-a', 'batch-1', sampleResponse.originalText, sampleResponse)
    expect(status).toBe('pending')
    expect(readLearningEventQueue('acc-a')).toHaveLength(1)

    const flushed = await learningEventsClient.ingestLearningEvents(readLearningEventQueue('acc-a'))
    expect(flushed.ok).toBe(true)
  })

  it('does not duplicate queued events on retry', async () => {
    vi.spyOn(learningEventsClient, 'ingestLearningEvents').mockResolvedValue({ ok: false, code: 'network' })

    await syncWritingLabCorrection('acc-a', 'batch-1', sampleResponse.originalText, sampleResponse)
    await syncWritingLabCorrection('acc-a', 'batch-1', sampleResponse.originalText, sampleResponse)
    expect(readLearningEventQueue('acc-a')).toHaveLength(1)
  })

  it('syncs successfully without blocking correction flow semantics', async () => {
    vi.spyOn(learningEventsClient, 'ingestLearningEvents').mockResolvedValue({
      ok: true,
      accepted: 1,
      deduplicated: 0,
      rejected: 0,
    })

    const status = await syncWritingLabCorrection('acc-a', 'batch-1', sampleResponse.originalText, sampleResponse)
    expect(status).toBe('synced')
    expect(readLearningEventQueue('acc-a')).toHaveLength(0)
  })

  it('reports already recorded when server deduplicates ingest', async () => {
    vi.spyOn(learningEventsClient, 'ingestLearningEvents').mockResolvedValue({
      ok: true,
      accepted: 0,
      deduplicated: 1,
      rejected: 0,
    })

    const status = await syncWritingLabCorrection('acc-a', 'batch-2', sampleResponse.originalText, sampleResponse)
    expect(status).toBe('already_recorded')
  })
})

describe('legacy local migration inputs', () => {
  beforeEach(() => {
    localStorage.clear()
    acceptAllCookies()
    resetWebLearningSyncForTests()
    vi.restoreAllMocks()
  })

  it('builds ingest payloads from legacy local events without raw textarea', async () => {
    recordWebCorrectionLearning('acc-a', 'batch-legacy', sampleResponse.originalText, sampleResponse)
    const event = readWebLearningStore('acc-a').events[0]
    expect(event?.sampleHash).toBe(hashWritingSample(sampleResponse.originalText))
    expect(event?.original).toBe('go')

    const ingestSpy = vi.spyOn(learningEventsClient, 'ingestLearningEvents').mockResolvedValue({
      ok: true,
      accepted: 1,
      deduplicated: 0,
      rejected: 0,
    })

    const { migrateLocalWebLearningEvents } = await import('./webLearningSync.ts')
    await migrateLocalWebLearningEvents('acc-a')

    expect(ingestSpy).toHaveBeenCalled()
    const payload = ingestSpy.mock.calls[0]?.[0]?.[0]
    expect(payload?.source).toBe('writing')
    expect(payload?.action).toBe('detected')
    expect(payload?.sampleHash).toBeTruthy()
    expect(JSON.stringify(payload)).not.toContain(sampleResponse.originalText)
  })
})

describe('queue persistence', () => {
  beforeEach(() => {
    localStorage.clear()
    acceptAllCookies()
    resetWebLearningSyncForTests()
  })

  it('persists and clears queue per account', () => {
    writeLearningEventQueue('acc-a', [
      {
        batchId: 'b1',
        category: 'grammar',
        original: 'go',
        corrected: 'went',
        action: 'detected',
        source: 'writing',
        sampleWordCount: 5,
        sampleHash: hashWritingSample('sample'),
      },
    ])
    expect(readLearningEventQueue('acc-a')).toHaveLength(1)
    expect(readLearningEventQueue('acc-b')).toHaveLength(0)
    writeLearningEventQueue('acc-a', [])
    expect(readLearningEventQueue('acc-a')).toHaveLength(0)
  })
})
