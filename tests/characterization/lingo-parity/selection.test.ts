import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { resolveTranslateTarget, targetLooksProtected } from '../../../extension/src/features/translation/selection.ts'

type SelectionFixture = {
  description: string
  text: string
  selectionStart: number
  selectionEnd: number
  expect?: { text: string; mode: 'selection' | 'context' } | null
  protected?: boolean
}

const fixtures = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../fixtures/lingo/selection.json'), 'utf8'),
) as SelectionFixture[]

describe('lingo parity: selection', () => {
  it.each(fixtures)('$description', (fixture) => {
    const target = resolveTranslateTarget(
      fixture.text,
      fixture.selectionStart,
      fixture.selectionEnd,
    )
    if (fixture.protected) {
      expect(target).not.toBeNull()
      expect(targetLooksProtected(target!.text)).toBe(true)
      return
    }
    if (fixture.expect === null) {
      expect(target).toBeNull()
      return
    }
    expect(target).not.toBeNull()
    expect(target!.text).toBe(fixture.expect!.text)
    expect(target!.mode).toBe(fixture.expect!.mode)
  })
})
