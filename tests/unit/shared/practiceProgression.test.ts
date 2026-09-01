import { describe, expect, it } from 'vitest'
import type { LearningEvent, PracticeSessionRecord, PracticeTargetPattern } from '@flowlary/shared'
import {
  adjustRecommendationPatternForProgression,
  buildTargetAttemptOutcomes,
  computeAllTargetPracticeProgressions,
  computeTargetPracticeProgression,
  deprioritizeStablePatterns,
  inferTargetPracticeBatchIds,
} from '@flowlary/shared'

const TARGET: PracticeTargetPattern = {
  category: 'spelling',
  normalizedOriginal: 'recieved',
  displayOriginal: 'recieved',
  displayCorrected: 'received',
  count: 3,
}

function practiceEvent(
  patch: Partial<LearningEvent> & Pick<LearningEvent, 'batchId'>,
  action: 'detected' | 'accepted' | 'rejected' = 'detected',
): LearningEvent {
  return {
    id: patch.id ?? patch.batchId,
    version: 1,
    timestamp: patch.timestamp ?? Date.now(),
    batchId: patch.batchId,
    source: 'practice',
    category: patch.category ?? TARGET.category,
    original: patch.original ?? TARGET.displayOriginal,
    corrected: patch.corrected ?? TARGET.displayCorrected,
    normalizedOriginal: patch.normalizedOriginal ?? TARGET.normalizedOriginal,
    normalizedCorrected: patch.normalizedCorrected ?? 'received',
    action,
    sampleWordCount: patch.sampleWordCount ?? 10,
    sampleHash: patch.sampleHash ?? `hash-${patch.batchId}`,
  }
}

function completedSession(
  id: string,
  itemsCompleted: number,
  startedAt = 1_000,
): PracticeSessionRecord {
  return {
    id,
    version: 1,
    startedAt,
    completedAt: startedAt + 60_000,
    focus: 'recommended',
    targetPattern: TARGET,
    itemsAttempted: itemsCompleted,
    itemsCompleted,
    correctionsDetected: 0,
    correctionsAccepted: 0,
    correctionsRejected: 0,
    wordsWritten: itemsCompleted * 5,
    status: 'completed',
  }
}

describe('practice progression (WL-4E)', () => {
  it('returns new when there are no practice attempts', () => {
    const result = computeTargetPracticeProgression(TARGET, [], [])
    expect(result.state).toBe('new')
    expect(result.practiceAttempts).toBe(0)
    expect(result.evidenceQuality).toBe('insufficient')
  })

  it('returns insufficient after a single attempt', () => {
    const sessions = [completedSession('s1', 1)]
    const result = computeTargetPracticeProgression(TARGET, [], sessions)
    expect(result.state).toBe('insufficient')
    expect(result.practiceAttempts).toBe(1)
  })

  it('treats zero-change practice items as clean attempts', () => {
    const sessions = [completedSession('s1', 2)]
    const events = [
      practiceEvent({ batchId: 'practice-s1-0' }),
    ]
    const outcomes = buildTargetAttemptOutcomes(TARGET, events, sessions)
    expect(outcomes).toHaveLength(2)
    expect(outcomes[0]?.hadTargetError).toBe(true)
    expect(outcomes[1]?.hadTargetError).toBe(false)
  })

  it('marks successful practice when target error is absent', () => {
    const sessions = [completedSession('s1', 2), completedSession('s2', 2)]
    const result = computeTargetPracticeProgression(TARGET, [], sessions)
    expect(result.cleanAttempts).toBe(4)
    expect(result.targetErrorAttempts).toBe(0)
    expect(['practicing', 'stable']).toContain(result.state)
  })

  it('marks needs_attention after repeated target errors in practice', () => {
    const sessions = [completedSession('s1', 2), completedSession('s2', 2)]
    const events = [
      practiceEvent({ batchId: 'practice-s1-0' }),
      practiceEvent({ batchId: 'practice-s1-1' }),
      practiceEvent({ batchId: 'practice-s2-0' }),
    ]
    const result = computeTargetPracticeProgression(TARGET, events, sessions)
    expect(result.targetErrorAttempts).toBeGreaterThanOrEqual(2)
    expect(result.state).toBe('needs_attention')
  })

  it('detects improving when recent performance beats prior', () => {
    const sessions = [
      completedSession('s1', 2, 1_000),
      completedSession('s2', 2, 2_000),
      completedSession('s3', 2, 3_000),
      completedSession('s4', 2, 4_000),
    ]
    const events = [
      practiceEvent({ batchId: 'practice-s1-0', timestamp: 1_100 }),
      practiceEvent({ batchId: 'practice-s2-0', timestamp: 2_100 }),
      practiceEvent({ batchId: 'practice-s3-0', timestamp: 3_100 }),
    ]
    const result = computeTargetPracticeProgression(TARGET, events, sessions)
    expect(result.state).toBe('improving')
    expect(result.evidenceQuality).toBe('ready')
  })

  it('detects stable after repeated clean attempts', () => {
    const sessions = [
      completedSession('s1', 1, 1_000),
      completedSession('s2', 1, 2_000),
      completedSession('s3', 1, 3_000),
    ]
    const result = computeTargetPracticeProgression(TARGET, [], sessions)
    expect(result.state).toBe('stable')
    expect(result.cleanRate).toBe(1)
  })

  it('excludes layout category from progression identity parsing', () => {
    const batchIds = inferTargetPracticeBatchIds(
      { ...TARGET, category: 'layout' as never },
      [completedSession('s1', 1)],
    )
    expect(batchIds).toEqual([])
  })

  it('deprioritizes stable patterns but keeps at least one target', () => {
    const grammarTarget: PracticeTargetPattern = {
      category: 'grammar',
      normalizedOriginal: 'he go',
      displayOriginal: 'He go',
      displayCorrected: 'He goes',
      count: 2,
    }
    const progressions = computeAllTargetPracticeProgressions(
      [TARGET, grammarTarget],
      [],
      [completedSession('s1', 3), completedSession('g1', 1)],
    )
    const stableId = progressions.find((item) => item.state === 'stable')?.targetPatternId
    expect(stableId).toBeTruthy()
    const filtered = deprioritizeStablePatterns([TARGET, grammarTarget], progressions)
    expect(filtered.some((pattern) => pattern.normalizedOriginal === 'recieved')).toBe(false)
    expect(filtered).toHaveLength(1)
  })

  it('adjusts recommendation away from stable target when another exists', () => {
    const grammarTarget: PracticeTargetPattern = {
      category: 'grammar',
      normalizedOriginal: 'he go',
      displayOriginal: 'He go',
      displayCorrected: 'He goes',
      count: 2,
    }
    const sessions = [completedSession('s1', 3), completedSession('g1', 2)]
    const progressions = computeAllTargetPracticeProgressions([TARGET, grammarTarget], [], sessions)
    const adjusted = adjustRecommendationPatternForProgression(
      { state: 'ready', focus: 'spelling', pattern: TARGET },
      progressions,
      [TARGET, grammarTarget],
    )
    expect(adjusted.pattern?.normalizedOriginal).toBe('he go')
  })

  it('does not count writing events as practice attempts', () => {
    const writingOnly: LearningEvent = {
      id: 'w1',
      version: 1,
      timestamp: Date.now(),
      batchId: 'writing-1',
      source: 'writing',
      category: 'spelling',
      original: 'recieved',
      corrected: 'received',
      normalizedOriginal: 'recieved',
      normalizedCorrected: 'received',
      action: 'accepted',
      sampleWordCount: 20,
      sampleHash: 'hash-w1',
    }
    const result = computeTargetPracticeProgression(TARGET, [writingOnly], [])
    expect(result.practiceAttempts).toBe(0)
    expect(result.writingRecurrence).toBe(1)
  })
})
