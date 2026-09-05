/** Content-script shortcut ids. These also exist as MV3 commands. */
export type ShortcutCommand = 'TRANSLATE' | 'FIX_LAYOUT' | 'CORRECT' | 'SPEED_BOX'

export function isModifiedShortcut(event: Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>): boolean {
  const modifier = event.ctrlKey || event.metaKey
  return Boolean(modifier && event.shiftKey && !event.altKey)
}

/**
 * Physical key codes (not `event.key`) so shortcuts survive wrong keyboard layouts.
 * Matches the manifest: KeyY (translate), KeyP, KeyE, KeyL.
 * Comma remains accepted as a legacy translate chord (old ⌘⇧, binding).
 */
export function detectShortcut(event: KeyboardEvent): ShortcutCommand | null {
  if (!isModifiedShortcut(event)) return null
  switch (event.code) {
    case 'KeyY':
    case 'Comma':
      return 'TRANSLATE'
    case 'KeyP':
      return 'FIX_LAYOUT'
    case 'KeyE':
      return 'CORRECT'
    case 'KeyL':
      return 'SPEED_BOX'
    default:
      return null
  }
}
