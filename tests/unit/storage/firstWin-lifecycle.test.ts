import { beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEYS } from '@flowlary/shared'
import { createMockChromeStorage } from '../../helpers/mockChromeStorage.ts'
import {
  getFirstWinState,
  normalizeFirstWinState,
  setFirstWinState,
} from '../../../extension/src/storage/ui/firstWin.ts'
import { flowlaryStorage } from '../../../extension/src/storage/index.ts'
import { handleMessage, resetBackgroundStartupForTests } from '../../../extension/src/background/index.ts'
import * as commands from '../../../extension/src/background/commands.ts'

vi.mock('../../../extension/src/background/commands.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof commands>()
  return {
    ...actual,
    sendCommandToActiveTab: vi.fn(),
  }
})

const mockSendCommand = vi.mocked(commands.sendCommandToActiveTab)

describe('first-win lifecycle', () => {
  const store = createMockChromeStorage()

  beforeEach(async () => {
    store.reset()
    store.install()
    resetBackgroundStartupForTests()
    mockSendCommand.mockReset()
    await flowlaryStorage.remove(STORAGE_KEYS.uiFirstWin, 'local')
  })

  it('starts incomplete on fresh install', async () => {
    const state = await getFirstWinState(flowlaryStorage)
    expect(state).toEqual({
      completed: false,
      localSuccess: false,
      aiSuccess: false,
    })
  })

  it('marks SHOWN → COMPLETED on explicit dismiss without local success', async () => {
    await setFirstWinState(flowlaryStorage, { completed: true })
    const state = await getFirstWinState(flowlaryStorage)
    expect(state.completed).toBe(true)
    expect(state.localSuccess).toBe(false)
  })

  it('marks COMPLETED with localSuccess after successful layout command ack', async () => {
    mockSendCommand.mockResolvedValue({ sent: true, handlerExecuted: true })
    const result = await handleMessage({ type: 'RUN_COMMAND', operation: 'FIX_LAYOUT' })
    expect(result).toEqual({ ok: true })
    const state = await getFirstWinState(flowlaryStorage)
    expect(state).toMatchObject({ completed: true, localSuccess: true })
  })

  it('does not mark success when handler did not execute', async () => {
    mockSendCommand.mockResolvedValue({ sent: true, handlerExecuted: false, reason: 'no_target' })
    const result = await handleMessage({ type: 'RUN_COMMAND', operation: 'FIX_LAYOUT' })
    expect(result).toEqual({ ok: false, error: 'no_target' })
    const state = await getFirstWinState(flowlaryStorage)
    expect(state.completed).toBe(false)
  })

  it('normalizes persisted completion across reload', () => {
    expect(
      normalizeFirstWinState({
        completed: false,
        localSuccess: true,
        aiSuccess: false,
        completedAt: 1,
      }).completed,
    ).toBe(true)
  })

  it('remains install-scoped (not account-keyed)', async () => {
    await setFirstWinState(flowlaryStorage, { localSuccess: true })
    const raw = await flowlaryStorage.get(STORAGE_KEYS.uiFirstWin, 'local')
    expect(raw).toBeTruthy()
    expect(raw).not.toHaveProperty('accountId')
  })
})
