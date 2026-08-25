/** Content-script shortcut ids. TRANSLATE / FIX_LAYOUT also exist as MV3 commands. */
export type ShortcutCommand = 'TRANSLATE' | 'FIX_LAYOUT' | 'SPEED_BOX'

export function isModifiedShortcut(event: Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>): boolean {
  const modifier = event.ctrlKey || event.metaKey
  return Boolean(modifier && event.shiftKey && !event.altKey)
}

/**
 * Physical key codes (not `event.key`) so shortcuts survive wrong keyboard layouts.
 * Matches Layfix/Lingo: Comma, KeyP, KeyL.
 */
export function detectShortcut(event: KeyboardEvent): ShortcutCommand | null {
  if (!isModifiedShortcut(event)) return null
  switch (event.code) {
    case 'Comma':
      return 'TRANSLATE'
    case 'KeyP':
      return 'FIX_LAYOUT'
    case 'KeyL':
      return 'SPEED_BOX'
    default:
      return null
  }
}
