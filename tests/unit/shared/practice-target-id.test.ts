import { describe, expect, it } from 'vitest'
import { parsePracticeTargetPatternId, practiceTargetPatternId } from '@flowlary/shared'

describe('parsePracticeTargetPatternId', () => {
  it('parses category and normalized token', () => {
    expect(parsePracticeTargetPatternId('spelling:recieved')).toEqual({
      category: 'spelling',
      normalizedOriginal: 'recieved',
    })
  })

  it('rejects layout and malformed ids', () => {
    expect(parsePracticeTargetPatternId('layout:hello')).toBeNull()
    expect(parsePracticeTargetPatternId('spelling')).toBeNull()
    expect(parsePracticeTargetPatternId('')).toBeNull()
  })

  it('round-trips with practiceTargetPatternId', () => {
    const id = practiceTargetPatternId({
      category: 'grammar',
      normalizedOriginal: 'he go',
      displayOriginal: 'He go',
      displayCorrected: 'He goes',
      count: 2,
    })
    expect(parsePracticeTargetPatternId(id)).toEqual({
      category: 'grammar',
      normalizedOriginal: 'he go',
    })
  })
})
