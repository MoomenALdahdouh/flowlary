import { describe, expect, it } from 'vitest'
import {
  applyHostSurface,
  findVisualChrome,
  readHostSurface,
  shade,
} from '../../../extension/src/features/correction/ui/hostStyleAdapter.ts'

describe('hostStyleAdapter', () => {
  it('shades white slightly darker for the correction surface', () => {
    expect(shade('rgb(255, 255, 255)', -0.05)).toBe('rgb(242, 242, 242)')
  })

  it('copies border, radius, font, and padding from a bordered field', () => {
    document.body.innerHTML = `
      <textarea id="t" style="
        width:400px;height:80px;
        background:#ffffff;color:#111827;
        border:2px solid rgb(37, 99, 235);
        border-radius:12px;
        padding:14px 16px;
        font-family:Georgia, serif;
        font-size:18px;
        font-weight:600;
        letter-spacing:0.02em;
      "></textarea>
    `
    const ta = document.getElementById('t') as HTMLTextAreaElement
    const surface = readHostSurface(ta)
    expect(surface.hasVisibleBorder).toBe(true)
    expect(surface.borderColor).toContain('37')
    expect(surface.borderTopWidth).toBe('2px')
    expect(surface.borderTopLeftRadius).toBe('12px')
    expect(surface.borderBottomRightRadius).toBe('12px')
    expect(surface.fontFamily).toContain('Georgia')
    expect(surface.fontSize).toBe('18px')
    expect(surface.paddingTop).toBe('14px')
    expect(surface.background).not.toMatch(/rgb\(255,\s*255,\s*255\)/)

    const row = document.createElement('div')
    applyHostSurface(row, surface)
    expect(row.style.borderTopLeftRadius).toBe('12px')
    expect(row.style.borderBottomLeftRadius).toBe('12px')
    expect(row.style.fontSize).toBe('18px')
    expect(row.style.paddingLeft).toBe('16px')
  })

  it('does not invent a border when the host has none', () => {
    document.body.innerHTML = `
      <div id="ce" contenteditable="true" style="
        width:400px;min-height:60px;
        background:#ffffff;color:#111;
        border:0;border-radius:24px;padding:16px;
      "></div>
    `
    const el = document.getElementById('ce') as HTMLElement
    const surface = readHostSurface(el)
    expect(surface.hasVisibleBorder).toBe(false)
    expect(surface.borderStyle).toBe('none')
    expect(surface.borderTopWidth).toBe('0px')
    expect(surface.borderTopLeftRadius).toBe('24px')
  })

  it('adapts a dark host surface', () => {
    document.body.innerHTML = `
      <textarea id="t" style="
        background:rgb(24,24,27);color:#fafafa;
        border:1px solid rgb(63,63,70);border-radius:8px;padding:10px;
      "></textarea>
    `
    const ta = document.getElementById('t') as HTMLTextAreaElement
    const surface = readHostSurface(ta)
    expect(surface.color.toLowerCase()).toMatch(/250|fafafa/)
    expect(surface.hasVisibleBorder).toBe(true)
    const m = surface.background.match(/rgb\((\d+),\s*(\d+),\s*(\d+)/)
    expect(m).toBeTruthy()
    expect(Number(m![1])).toBeGreaterThanOrEqual(23)
  })

  it('uses parent chrome corners when the editable itself is square', () => {
    document.body.innerHTML = `
      <div id="shell" style="background:#ffffff;border-radius:28px;padding:16px;">
        <div id="ce" contenteditable="true" style="border:0;background:transparent;color:#111;padding:0;font-size:16px;"></div>
      </div>
    `
    const ce = document.getElementById('ce') as HTMLElement
    const shell = document.getElementById('shell') as HTMLElement
    expect(findVisualChrome(ce)).toBe(shell)
    const surface = readHostSurface(ce)
    expect(parseFloat(surface.borderTopLeftRadius)).toBeGreaterThan(0)
    expect(parseFloat(surface.paddingTop)).toBeGreaterThanOrEqual(10)
    expect(parseFloat(surface.paddingLeft)).toBeGreaterThanOrEqual(12)
    expect(surface.gapPx).toBe(8)
  })
})
