import { describe, expect, it } from 'vitest'
import { FLOWLARY_MARK, FLOWLARY_MARK_COLORS } from './brand.ts'
import {
  FLOWLARY_LOGO_GRADIENT_ID,
  flowlaryFaviconSvg,
  flowlaryFaviconSvgAdaptive,
  flowlaryMarkSvgPng,
} from './markSvg.ts'

describe('markSvg', () => {
  it('renders theme favicons from shared colors', () => {
    const dark = flowlaryFaviconSvg('dark')
    const light = flowlaryFaviconSvg('light')
    expect(dark).toContain(FLOWLARY_MARK.f)
    expect(dark).toContain(FLOWLARY_MARK_COLORS.accent)
    expect(dark).toContain(FLOWLARY_MARK_COLORS.onAccent)
    expect(light).toContain(FLOWLARY_MARK_COLORS.light.accent)
    expect(light).toContain(FLOWLARY_MARK_COLORS.light.onAccent)
    expect(flowlaryFaviconSvgAdaptive()).toContain('@media (prefers-color-scheme: dark)')
  })

  it('uses one gradient id for UI logos', () => {
    expect(FLOWLARY_LOGO_GRADIENT_ID).toBe('fl-logo-grad')
  })

  it('renders gradient PNG source from shared mark', () => {
    const png = flowlaryMarkSvgPng(128)
    expect(png).toContain('fl-mark-grad')
    expect(png).toContain(FLOWLARY_MARK.f)
    expect(png).toContain('#ec4899')
  })
})
