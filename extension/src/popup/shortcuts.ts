/**
 * Display labels for Chrome command suggested keys.
 * Keep in sync with `extension/manifest.json` → `commands.*.suggested_key`
 * and `extension/manifest.prod.json` (same chord bindings).
 *
 * Commands:
 * - TRANSLATE → KeyY
 * - FIX_LAYOUT → KeyP
 * - CORRECT → KeyE
 * - SPEED_BOX → KeyL
 */
export type ShortcutLabels = {
  modifier: '⌘' | 'Ctrl'
  fixWriting: string
  translate: string
  fixLayout: string
  speedBox: string
}

/** Manifest `suggested_key` values used to build popup labels. */
export const COMMAND_SUGGESTED_KEYS = {
  TRANSLATE: { default: 'Ctrl+Shift+Y', mac: 'Command+Shift+Y' },
  FIX_LAYOUT: { default: 'Ctrl+Shift+P', mac: 'Command+Shift+P' },
  CORRECT: { default: 'Ctrl+Shift+E', mac: 'Command+Shift+E' },
  SPEED_BOX: { default: 'Ctrl+Shift+L', mac: 'Command+Shift+L' },
} as const

function chordKeyLetter(suggested: { default: string; mac: string }): string {
  const last = suggested.default.split('+').at(-1)
  if (!last) throw new Error('Invalid suggested_key')
  return last
}

function formatChord(mod: '⌘' | 'Ctrl', key: string): string {
  return `${mod} + Shift + ${key}`
}

export function getShortcutLabels(platform?: string): ShortcutLabels {
  const isMac = (platform ?? detectPlatform()).includes('Mac')
  const mod = isMac ? '⌘' : 'Ctrl'
  return {
    modifier: mod,
    // CORRECT — Command/Ctrl+Shift+E
    fixWriting: formatChord(mod, chordKeyLetter(COMMAND_SUGGESTED_KEYS.CORRECT)),
    // TRANSLATE — Command/Ctrl+Shift+Y
    translate: formatChord(mod, chordKeyLetter(COMMAND_SUGGESTED_KEYS.TRANSLATE)),
    // FIX_LAYOUT — Command/Ctrl+Shift+P
    fixLayout: formatChord(mod, chordKeyLetter(COMMAND_SUGGESTED_KEYS.FIX_LAYOUT)),
    // SPEED_BOX — Command/Ctrl+Shift+L
    speedBox: formatChord(mod, chordKeyLetter(COMMAND_SUGGESTED_KEYS.SPEED_BOX)),
  }
}

function detectPlatform(): string {
  if (typeof navigator !== 'undefined' && navigator.platform) {
    return navigator.platform
  }
  return ''
}
