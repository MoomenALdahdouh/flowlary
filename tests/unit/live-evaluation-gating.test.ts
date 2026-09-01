import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../..')

describe('live evaluation gating', () => {
  it('excludes every eval harness from the normal extension suite', () => {
    const config = readFileSync(resolve(root, 'extension/vitest.config.ts'), 'utf8')
    expect(config).toContain("exclude: ['../tests/**/*.eval.test.ts']")
    expect(config).not.toContain("'../tests/audit/evaluation/**/*.eval.test.ts',")
  })

  it('requires an explicit Gemini full-live flag before executing the holdout eval', () => {
    const harness = readFileSync(
      resolve(root, 'tests/audit/evaluation/gemini-3.5-flash-lite-full-live.eval.test.ts'),
      'utf8',
    )
    expect(harness).toContain("process.env.FLOWLARY_GEMINI_FULL_LIVE === 'true'")
    expect(harness).toContain('it.skipIf(!LIVE_ENABLED)')
    expect(harness).toContain('const TARGET_VALID = 200')
    expect(harness).toContain("geminiAdvisorEnabled: true")
    expect(harness).not.toContain('advisorFallbackEnabled: true')
  })

  it('requires an explicit Gemini live flag before executing the probe', () => {
    const probe = readFileSync(
      resolve(root, 'tests/unit/backend/geminiAdvisorProvider.live.test.ts'),
      'utf8',
    )
    expect(probe).toContain("process.env.FLOWLARY_GEMINI_LIVE === 'true'")
    expect(probe).toContain('describe.skipIf(!LIVE_ENABLED)')
    expect(probe).toContain('const REQUEST_COUNT = 5')
  })
})
