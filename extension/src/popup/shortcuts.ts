/** Human-readable shortcut labels for the popup. */

export type ShortcutLabels = {
  modifier: '⌘' | 'Ctrl'
  fixWriting: string
  translate: string
  fixLayout: string
  speedBox: string
}

export function getShortcutLabels(platform?: string): ShortcutLabels {
  const isMac = (platform ?? detectPlatform()).includes('Mac')
  const mod = isMac ? '⌘' : 'Ctrl'
  return {
    modifier: mod,
    fixWriting: `${mod} + Shift + E`,
    translate: `${mod} + Shift + ,`,
    fixLayout: `${mod} + Shift + P`,
    speedBox: `${mod} + Shift + L`,
  }
}

function detectPlatform(): string {
  if (typeof navigator !== 'undefined' && navigator.platform) {
    return navigator.platform
  }
  return ''
}
