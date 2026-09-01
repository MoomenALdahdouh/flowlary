import { describe, expect, it } from 'vitest'
import { getShortcutLabels } from '../../../extension/src/popup/shortcuts.ts'

describe('popup shortcuts', () => {
  it('uses Command on macOS', () => {
    const labels = getShortcutLabels('MacIntel')
    expect(labels.modifier).toBe('⌘')
    expect(labels.translate).toContain('⌘')
    expect(labels.fixWriting).toContain('E')
    expect(labels.fixLayout).toContain('P')
    expect(labels.speedBox).toContain('L')
  })

  it('uses Ctrl on other platforms', () => {
    const labels = getShortcutLabels('Win32')
    expect(labels.modifier).toBe('Ctrl')
    expect(labels.translate).toContain('Ctrl')
  })
})
