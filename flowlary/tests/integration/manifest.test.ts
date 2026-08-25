import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const manifestPath = resolve(import.meta.dirname, '../../extension/manifest.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
  manifest_version: number
  content_scripts: Array<{ js: string[]; all_frames?: boolean }>
  background: { service_worker: string }
  action: { default_popup: string }
  commands: Record<string, unknown>
}

describe('Extension manifest (single entry points)', () => {
  it('is Manifest V3', () => {
    expect(manifest.manifest_version).toBe(3)
  })

  it('has exactly ONE content script entry', () => {
    expect(manifest.content_scripts).toHaveLength(1)
    expect(manifest.content_scripts[0].js).toEqual(['src/content_script.ts'])
  })

  it('has exactly ONE service worker', () => {
    expect(manifest.background.service_worker).toBe('src/background/index.ts')
  })

  it('has exactly ONE popup entry', () => {
    expect(manifest.action.default_popup).toBe('src/popup/index.html')
  })

  it('declares TRANSLATE and FIX_LAYOUT commands', () => {
    expect(manifest.commands).toHaveProperty('TRANSLATE')
    expect(manifest.commands).toHaveProperty('FIX_LAYOUT')
    expect(manifest.commands).not.toHaveProperty('TRANSLATE_CURRENT_TEXT')
  })

  it('uses all_frames with documented iframe policy', () => {
    expect(manifest.content_scripts[0].all_frames).toBe(true)
  })
})
