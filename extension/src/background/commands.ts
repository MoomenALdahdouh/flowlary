import { COMMANDS } from '@flowlary/shared'

export { COMMANDS }

export type CommandDispatch = 'sent' | 'noop'

export async function sendCommandToActiveTab(
  operation: 'TRANSLATE' | 'FIX_LAYOUT' | 'CORRECT',
  api: Pick<typeof chrome, 'tabs'> = chrome,
): Promise<CommandDispatch> {
  try {
    const tabs = await api.tabs.query({ active: true, currentWindow: true })
    const tabId = tabs[0]?.id
    if (tabId == null) return 'noop'
    await api.tabs.sendMessage(tabId, { type: 'RUN_COMMAND', operation })
    return 'sent'
  } catch {
    return 'noop'
  }
}

export function isTranslateCommand(command: string): boolean {
  return command === COMMANDS.translate
}

export function isFixLayoutCommand(command: string): boolean {
  return command === COMMANDS.fixLayout
}

export function commandFromChromeCommand(
  command: string,
): 'TRANSLATE' | 'FIX_LAYOUT' | null {
  if (isTranslateCommand(command)) return 'TRANSLATE'
  if (isFixLayoutCommand(command)) return 'FIX_LAYOUT'
  return null
}
