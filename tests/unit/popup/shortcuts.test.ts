import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  COMMAND_SUGGESTED_KEYS,
  getShortcutLabels,
} from '../../../extension/src/popup/shortcuts.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..')

function readManifestCommands(relativePath: string) {
  const raw = JSON.parse(readFileSync(join(root, relativePath), 'utf8')) as {
    commands: Record<string, { suggested_key: { default: string; mac: string } }>
  }
  return raw.commands
}

describe('popup shortcuts', () => {
  it('uses Command on macOS', () => {
    const labels = getShortcutLabels('MacIntel')
    expect(labels.modifier).toBe('⌘')
    expect(labels.translate).toBe('⌘ + Shift + Y')
    expect(labels.fixWriting).toBe('⌘ + Shift + E')
    expect(labels.fixLayout).toBe('⌘ + Shift + P')
    expect(labels.speedBox).toBe('⌘ + Shift + L')
  })

  it('uses Ctrl on other platforms', () => {
    const labels = getShortcutLabels('Win32')
    expect(labels.modifier).toBe('Ctrl')
    expect(labels.translate).toBe('Ctrl + Shift + Y')
    expect(labels.fixWriting).toBe('Ctrl + Shift + E')
    expect(labels.fixLayout).toBe('Ctrl + Shift + P')
    expect(labels.speedBox).toBe('Ctrl + Shift + L')
  })

  it('matches manifest suggested_key chords for each tool command', () => {
    for (const file of ['extension/manifest.json', 'extension/manifest.prod.json']) {
      const commands = readManifestCommands(file)
      for (const [command, suggested] of Object.entries(COMMAND_SUGGESTED_KEYS)) {
        expect(commands[command]?.suggested_key, `${file} ${command}`).toEqual(suggested)
      }
    }
  })
})
