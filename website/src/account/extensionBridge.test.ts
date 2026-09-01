import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  FLOWLARY_EXT_SOURCE,
  FLOWLARY_WEB_SOURCE,
  probeExtensionBridge,
  publishOpenDashboard,
} from './extensionBridge.ts'

describe('extensionBridge', () => {
  let messageHandler: ((event: MessageEvent) => void) | null = null

  beforeEach(() => {
    messageHandler = null
  })

  afterEach(() => {
    if (messageHandler) {
      window.removeEventListener('message', messageHandler)
      messageHandler = null
    }
  })

  it('detects bridge when ready message fires', async () => {
    const probePromise = probeExtensionBridge(200)
    queueMicrotask(() => {
      window.postMessage({ source: FLOWLARY_EXT_SOURCE, type: 'bridge-ready' }, '*')
    })
    await expect(probePromise).resolves.toBe(true)
  })

  it('returns false when bridge does not respond', async () => {
    await expect(probeExtensionBridge(50)).resolves.toBe(false)
  })

  it('posts open-dashboard message with target', async () => {
    const seen = new Promise<{ section?: string; practiceTargetPatternId?: string }>((resolve) => {
      window.addEventListener('message', (event: MessageEvent) => {
        const data = event.data as {
          source?: string
          type?: string
          payload?: { section?: string; practiceTargetPatternId?: string }
        } | null
        if (data?.source === FLOWLARY_WEB_SOURCE && data.type === 'open-dashboard') {
          resolve(data.payload ?? {})
        }
      })
    })
    publishOpenDashboard('practice', 'spelling:recieved')
    await expect(seen).resolves.toEqual({
      section: 'practice',
      practiceTargetPatternId: 'spelling:recieved',
    })
  })
})
