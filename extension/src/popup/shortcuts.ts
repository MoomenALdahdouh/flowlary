/** Human-readable shortcut labels for the popup. */

export type ShortcutLabels = {
  modifier: '⌘' | 'Ctrl'
  translate: string
  fixLayout: string
  speedBox: string
}

export function getShortcutLabels(platform?: string): ShortcutLabels {
  const isMac = (platform ?? detectPlatform()).includes('Mac')
  const mod = isMac ? '⌘' : 'Ctrl'
  return {
    modifier: mod,
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
