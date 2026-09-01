import { COMMANDS } from '@flowlary/shared'

export { COMMANDS }

export type CommandDispatchResult = {
  sent: boolean
  handlerExecuted: boolean
  reason?: string
}

export async function sendCommandToActiveTab(
  operation: 'TRANSLATE' | 'FIX_LAYOUT' | 'CORRECT' | 'SPEED_BOX',
  api: Pick<typeof chrome, 'tabs'> = chrome,
): Promise<CommandDispatchResult> {
  try {
    const tabs = await api.tabs.query({ active: true, currentWindow: true })
    const tabId = tabs[0]?.id
    if (tabId == null) {
      return { sent: false, handlerExecuted: false, reason: 'no_tab' }
    }
    const response = (await api.tabs.sendMessage(tabId, {
      type: 'RUN_COMMAND',
      operation,
    })) as { handlerExecuted?: boolean; status?: string; reason?: string } | undefined
    const handlerExecuted = response?.handlerExecuted === true
    return {
      sent: true,
      handlerExecuted,
      reason: handlerExecuted ? undefined : (response?.reason ?? response?.status ?? 'not_executed'),
    }
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
