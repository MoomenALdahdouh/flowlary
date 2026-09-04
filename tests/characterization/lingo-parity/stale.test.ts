import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { isStaleTicket } from '../../../extension/src/features/translation/stale.ts'
import type { TranslationTicket } from '../../../extension/src/features/translation/types.ts'

type StaleFixture = {
  description: string
  ticket: TranslationTicket
  live: {
    generation: number
    text: string
    start: number
    end: number
    sourceLanguage: TranslationTicket['sourceLanguage']
    targetLanguage: TranslationTicket['targetLanguage']
  }
  expectStale: boolean
}

const fixtures = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../fixtures/lingo/stale.json'), 'utf8'),
) as StaleFixture[]

describe('lingo parity: stale tickets', () => {
  it.each(fixtures)('$description', (fixture) => {
    expect(isStaleTicket(fixture.ticket, fixture.live)).toBe(fixture.expectStale)
  })
})
