import { COMMANDS } from '@flowlary/shared'

export { COMMANDS }

export type CommandDispatchResult = {
  sent: boolean
  handlerExecuted: boolean
  reason?: string
}

export type CommandFrameTarget = {
  tabId: number
  frameId: number
}

const SESSION_KEY = 'flowlaryCommandTarget'

let memoryTarget: CommandFrameTarget | null = null

type TabsApi = Pick<typeof chrome, 'tabs'>

export function rememberCommandTarget(sender: {
  tab?: { id?: number }
  frameId?: number
}): CommandFrameTarget | null {
  const tabId = sender.tab?.id
  const frameId = sender.frameId
  if (tabId == null || frameId == null) return null
  memoryTarget = { tabId, frameId }
  const session = chrome.storage?.session
  if (session?.set) {
    void session.set({ [SESSION_KEY]: memoryTarget }).catch(() => undefined)
  }
  return memoryTarget
}

export function resetCommandTargetForTests(): void {
  memoryTarget = null
}

async function loadFrameId(tabId: number, api: TabsApi): Promise<number | undefined> {
  if (memoryTarget?.tabId === tabId) return memoryTarget.frameId
  const session = (api as typeof chrome).storage?.session
  if (!session?.get) return undefined
  try {
    const stored = await session.get(SESSION_KEY)
    const target = stored?.[SESSION_KEY] as CommandFrameTarget | undefined
    if (target?.tabId === tabId && typeof target.frameId === 'number') {
      memoryTarget = target
      return target.frameId
    }
  } catch {
    return undefined
  }
  return undefined
}

function uniqueFrameAttempts(preferred: number | undefined): Array<number | undefined> {
  const attempts: Array<number | undefined> = []
  const push = (value: number | undefined) => {
    if (attempts.includes(value)) return
    attempts.push(value)
  }
  if (preferred !== undefined) push(preferred)
  push(undefined)
  if (preferred !== 0) push(0)
  return attempts
}

async function sendRunCommand(
  api: TabsApi,
  tabId: number,
  operation: 'TRANSLATE' | 'FIX_LAYOUT' | 'CORRECT' | 'SPEED_BOX',
  frameId?: number,
): Promise<{ handlerExecuted?: boolean; status?: string; reason?: string } | undefined> {
  const payload = { type: 'RUN_COMMAND', operation }
  if (frameId === undefined) {
    return (await api.tabs.sendMessage(tabId, payload)) as
      | { handlerExecuted?: boolean; status?: string; reason?: string }
      | undefined
  }
  return (await api.tabs.sendMessage(tabId, payload, { frameId })) as
    | { handlerExecuted?: boolean; status?: string; reason?: string }
    | undefined
}

export async function sendCommandToActiveTab(
  operation: 'TRANSLATE' | 'FIX_LAYOUT' | 'CORRECT' | 'SPEED_BOX',
  api: TabsApi = chrome,
): Promise<CommandDispatchResult> {
  try {
    const tabs = await api.tabs.query({ active: true, currentWindow: true })
    const tabId = tabs[0]?.id
    if (tabId == null) {
      return { sent: false, handlerExecuted: false, reason: 'no_tab' }
    }
    const preferred = await loadFrameId(tabId, api)
    let last: CommandDispatchResult = {
      sent: false,
      handlerExecuted: false,
      reason: 'send_failed',
    }
    for (const frameId of uniqueFrameAttempts(preferred)) {
      try {
        const response = await sendRunCommand(api, tabId, operation, frameId)
        const handlerExecuted = response?.handlerExecuted === true
        last = {
          sent: true,
          handlerExecuted,
          reason: handlerExecuted ? undefined : (response?.reason ?? response?.status ?? 'not_executed'),
        }
        if (handlerExecuted) return last
      } catch {
        continue
      }
    }
    return last
  } catch {
    return { sent: false, handlerExecuted: false, reason: 'send_failed' }
  }
}

export function isTranslateCommand(command: string): boolean {
  return command === COMMANDS.translate
}

export function isFixLayoutCommand(command: string): boolean {
  return command === COMMANDS.fixLayout
}

export function isCorrectCommand(command: string): boolean {
  return command === COMMANDS.correct
}

export function commandFromChromeCommand(
  command: string,
): 'TRANSLATE' | 'FIX_LAYOUT' | 'CORRECT' | 'SPEED_BOX' | null {
  if (isTranslateCommand(command)) return 'TRANSLATE'
  if (isFixLayoutCommand(command)) return 'FIX_LAYOUT'
  if (isCorrectCommand(command)) return 'CORRECT'
  if (command === COMMANDS.speedBox) return 'SPEED_BOX'
  return null
}
