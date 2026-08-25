import { describe, expect, it, vi } from 'vitest'
import {
  commandFromChromeCommand,
  sendCommandToActiveTab,
} from '../../extension/src/background/commands.ts'

describe('background command routing', () => {
  it('maps chrome command names', () => {
    expect(commandFromChromeCommand('TRANSLATE')).toBe('TRANSLATE')
    expect(commandFromChromeCommand('FIX_LAYOUT')).toBe('FIX_LAYOUT')
    expect(commandFromChromeCommand('SPEED_BOX')).toBeNull()
  })

  it('forwards RUN_COMMAND to the active tab', async () => {
    const sendMessage = vi.fn().mockResolvedValue(undefined)
    const api = {
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 42 }]),
        sendMessage,
      },
    } as unknown as Pick<typeof chrome, 'tabs'>
    const sent = await sendCommandToActiveTab('TRANSLATE', api)
    expect(sent).toBe('sent')
    expect(sendMessage).toHaveBeenCalledWith(42, {
      type: 'RUN_COMMAND',
      operation: 'TRANSLATE',
    })
  })
})
