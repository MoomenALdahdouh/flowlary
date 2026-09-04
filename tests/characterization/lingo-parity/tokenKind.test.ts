import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { skipReasonForToken } from '../../../extension/src/core/safety/tokenKind.ts'

type TokenFixture = {
  token: string
  context: string
  expect: string | null
}

const fixtures = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../fixtures/lingo/tokenKind.json'), 'utf8'),
) as TokenFixture[]

describe('lingo parity: tokenKind', () => {
  it.each(fixtures)('skipReasonForToken($token) → $expect', (fixture) => {
    expect(skipReasonForToken(fixture.token, fixture.context, fixture.token)).toBe(fixture.expect)
  })
})
