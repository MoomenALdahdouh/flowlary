import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  configureStorePath,
  createAccount,
  findAccountById,
  resetStoreForTests,
} from '../../../backend/src/db/store.ts'

describe('JSON account store', () => {
  const dirs: string[] = []

  afterEach(() => {
    resetStoreForTests()
    configureStorePath(':memory:')
    for (const dir of dirs) {
      try {
        rmSync(dir, { recursive: true, force: true })
      } catch {
        /* ignore */
      }
    }
    dirs.length = 0
  })

  it('persists accounts across configureStorePath reloads', () => {
    const dir = mkdtempSync(join(tmpdir(), 'flowlary-store-'))
    dirs.push(dir)
    const path = join(dir, 'flowlary-store.json')
    configureStorePath(path)

    const created = createAccount({
      email: 'persist@flowlary.com',
      passwordHash: 'hash',
      plan: 'free',
      status: 'active',
      trialEndsAt: null,
      usageBalanceMs: 1000,
    })

    const raw = JSON.parse(readFileSync(path, 'utf8')) as { accounts: Record<string, { email: string }> }
    expect(raw.accounts[created.id]?.email).toBe('persist@flowlary.com')

    configureStorePath(':memory:')
    configureStorePath(path)
    expect(findAccountById(created.id)?.email).toBe('persist@flowlary.com')
  })
})
