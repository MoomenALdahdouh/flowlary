import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  currentParagraph,
  lastCompletedSegment,
  liveSegmentOnPause,
} from '../../../extension/src/features/translation/segments.ts'

type SegmentFixture = {
  description: string
  text: string
  caret: number
  fn: 'lastCompletedSegment' | 'liveSegmentOnPause' | 'currentParagraph'
  options?: { requireBoundary?: boolean; allowPhraseBoundary?: boolean }
  expect: { text: string; complete?: boolean } | null
}

const fixtures = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../fixtures/lingo/segments.json'), 'utf8'),
) as SegmentFixture[]

function runSegmentFixture(fixture: SegmentFixture) {
  if (fixture.fn === 'currentParagraph') {
    return currentParagraph(fixture.text, fixture.caret)
  }
  if (fixture.fn === 'liveSegmentOnPause') {
    return liveSegmentOnPause(fixture.text, fixture.caret)
  }
  return lastCompletedSegment(fixture.text, fixture.caret, fixture.options ?? {})
}

describe('lingo parity: segments', () => {
  it.each(fixtures)('$description', (fixture) => {
    const segment = runSegmentFixture(fixture)
    if (fixture.expect === null) {
      expect(segment).toBeNull()
      return
    }
    expect(segment).not.toBeNull()
    expect(segment!.text).toBe(fixture.expect.text)
    if (fixture.expect.complete !== undefined) {
      expect(segment!.complete).toBe(fixture.expect.complete)
    }
  })
})
