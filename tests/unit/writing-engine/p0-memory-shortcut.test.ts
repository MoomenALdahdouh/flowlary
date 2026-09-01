import { describe, expect, it } from 'vitest'
import { hashWritingSample } from '@flowlary/shared'
import { vocabularyHashesFromEvents } from '../../../extension/src/features/layout/profile/trust.ts'
import { ACCEPTED_VOCAB_THRESHOLD } from '../../../extension/src/features/layout/profile/types.ts'
import { shortcutRangeForOperation } from '../../../extension/src/core/engine/shortcutRange.ts'
import { applyLayoutProfileToMemory } from '../../../extension/src/features/layout/profile/index.ts'
import { DEFAULT_PROFILE } from '../../../extension/src/features/layout/layouts/profile.ts'
import { stateManager } from '../../../extension/src/core/state/StateManager.ts'

describe('thresholded personal vocabulary', () => {
  it('ignores a single accept and hashes after the threshold', () => {
    const token = 'Flowlary'
    const once = vocabularyHashesFromEvents([
      { kind: 'accepted', token, ts: 1 },
    ])
    expect(once).toEqual([])
    const enough = Array.from({ length: ACCEPTED_VOCAB_THRESHOLD }, (_, index) => ({
      kind: 'accepted' as const,
      token,
      ts: index,
    }))
    expect(vocabularyHashesFromEvents(enough)).toEqual([hashWritingSample(token.toLocaleLowerCase())])
  })

  it('copies exceptions and hashes onto writing memory', () => {
    applyLayoutProfileToMemory({
      layoutProfile: DEFAULT_PROFILE,
      personalExceptions: ['deploy'],
      events: Array.from({ length: ACCEPTED_VOCAB_THRESHOLD }, (_, index) => ({
        kind: 'accepted' as const,
        token: 'Changelog',
        ts: index,
      })),
    })
    expect(stateManager.personalExceptions).toEqual(['deploy'])
    expect(stateManager.vocabularyHashes).toContain(hashWritingSample('changelog'))
    stateManager.personalExceptions = []
    stateManager.vocabularyHashes = []
  })
})

describe('shortcut range from shared analysis', () => {
  it('keeps an explicit selection', () => {
    const range = shortcutRangeForOperation('hello world', 'FIX_LAYOUT', { start: 0, end: 5 })
    expect(range).toEqual({ start: 0, end: 5 })
  })

  it('does not chain translation onto a layout span', () => {
    const text = 'hello please '
    const layout = shortcutRangeForOperation(text, 'FIX_LAYOUT', null)
    const translate = shortcutRangeForOperation(text, 'TRANSLATE', null)
    expect(layout).toBeTruthy()
    expect(translate).toBeTruthy()
  })
})
