import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMockChromeStorage } from '../../helpers/mockChromeStorage.ts'
import { resetBackgroundStartupForTests, handleMessage } from '../../../extension/src/background/index.ts'
import * as commands from '../../../extension/src/background/commands.ts'

vi.mock('../../../extension/src/background/commands.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof commands>()
  return {
    ...actual,
    sendCommandToActiveTab: vi.fn(),
  }
})

const mockSendCommand = vi.mocked(commands.sendCommandToActiveTab)

describe('chrome.commands integration', () => {
  const store = createMockChromeStorage()

  beforeEach(() => {
    store.reset()
    store.install()
    resetBackgroundStartupForTests()
    mockSendCommand.mockReset()
  })

  it('routes SPEED_BOX through the shared runCommandOnActiveTab path', async () => {
    mockSendCommand.mockResolvedValue({ sent: true, handlerExecuted: true })
    const result = await handleMessage({ type: 'RUN_COMMAND', operation: 'SPEED_BOX' })
    expect(result).toEqual({ ok: true })
    expect(mockSendCommand).toHaveBeenCalledWith('SPEED_BOX')
  })

  it('returns no_tab when there is no active tab', async () => {
    mockSendCommand.mockResolvedValue({ sent: false, handlerExecuted: false, reason: 'no_tab' })
    const result = await handleMessage({ type: 'RUN_COMMAND', operation: 'FIX_LAYOUT' })
    expect(result).toEqual({ ok: false, error: 'no_tab' })
  })
})
