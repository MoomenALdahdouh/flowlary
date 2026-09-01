import { beforeEach, describe, expect, it } from 'vitest'
import { UPGRADE_PROMPT_SUPPRESS_MS } from '@flowlary/shared'
import type { FlowlaryStorage } from '../../../extension/src/storage/index.ts'
import {
  markContextualUpgradePromptShown,
  shouldShowContextualUpgradePrompt,
} from '../../../extension/src/ui/upgradePromptSuppression.ts'
import { getUpgradeUrl } from '../../../extension/src/config/upgrade.ts'

describe('upgrade prompt suppression', () => {
  const store = new Map<string, unknown>()
  const storage = {
    async get(key: string) {
      return store.get(key)
    },
    async set(key: string, value: Record<string, unknown>) {
      store.set(key, value)
    },
  } as unknown as FlowlaryStorage

  beforeEach(() => {
    store.clear()
  })

  it('allows the first contextual prompt', async () => {
    expect(await shouldShowContextualUpgradePrompt(storage, 1_000)).toBe(true)
  })

  it('suppresses identical prompts within the window', async () => {
    await markContextualUpgradePromptShown(storage, 1_000)
    expect(await shouldShowContextualUpgradePrompt(storage, 1_000 + 60_000)).toBe(false)
    expect(
      await shouldShowContextualUpgradePrompt(storage, 1_000 + UPGRADE_PROMPT_SUPPRESS_MS + 1),
    ).toBe(true)
  })
})

describe('getUpgradeUrl', () => {
  it('routes to a single canonical pricing destination', () => {
    expect(getUpgradeUrl()).toMatch(/\/pricing$/)
  })
})
