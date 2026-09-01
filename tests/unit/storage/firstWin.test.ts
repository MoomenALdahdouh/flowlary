import { describe, expect, it, vi } from 'vitest'
import {
  getFirstWinState,
  hasFirstProductSuccess,
  normalizeFirstWinState,
  setFirstWinState,
} from '../../../extension/src/storage/ui/firstWin.ts'
import type { FlowlaryStorage } from '../../../extension/src/storage/index.ts'

function mockStorage(initial: Record<string, unknown> = {}): FlowlaryStorage {
  const local = new Map<string, unknown>(Object.entries(initial))
  return {
    get: vi.fn(async (key: string, area: string) => {
      if (area === 'local') return local.get(key) ?? null
      return null
    }),
    set: vi.fn(async (key: string, value: Record<string, unknown>, area: string) => {
      if (area === 'local') local.set(key, value)
    }),
    remove: vi.fn(async (key: string, area: string) => {
      if (area === 'local') local.delete(key)
    }),
  } as unknown as FlowlaryStorage
}

describe('firstWin storage', () => {
  it('normalizes empty state', () => {
    expect(normalizeFirstWinState(null)).toEqual({
      completed: false,
      localSuccess: false,
      aiSuccess: false,
    })
  })

  it('marks completed when local or AI success is set', () => {
    expect(normalizeFirstWinState({ localSuccess: true })).toMatchObject({
      completed: true,
      localSuccess: true,
    })
    expect(normalizeFirstWinState({ aiSuccess: true })).toMatchObject({
      completed: true,
      aiSuccess: true,
    })
  })

  it('persists install-scoped state', async () => {
    const storage = mockStorage()
    const next = await setFirstWinState(storage, { localSuccess: true })
    expect(next.completed).toBe(true)
    expect(next.localSuccess).toBe(true)
    const loaded = await getFirstWinState(storage)
    expect(loaded).toMatchObject({ completed: true, localSuccess: true })
  })

  it('hasFirstProductSuccess reflects completion paths', () => {
    expect(hasFirstProductSuccess({ completed: false, localSuccess: false, aiSuccess: false })).toBe(
      false,
    )
    expect(hasFirstProductSuccess({ completed: true, localSuccess: false, aiSuccess: false })).toBe(
      true,
    )
    expect(hasFirstProductSuccess({ completed: false, localSuccess: true, aiSuccess: false })).toBe(
      true,
    )
  })
})
