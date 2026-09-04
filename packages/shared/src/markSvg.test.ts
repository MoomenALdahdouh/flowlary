import { describe, expect, it } from 'vitest'
import { FLOWLARY_MARK, FLOWLARY_MARK_COLORS } from './brand.ts'
import {
  FLOWLARY_LOGO_GRADIENT_ID,
  FLOWLARY_LOGO_GRADIENT_STOPS,
  flowlaryFaviconSvg,
  flowlaryFaviconSvgAdaptive,
  flowlaryMarkSvgPng,
} from './markSvg.ts'

describe('markSvg', () => {
  it('renders the same gradient tile for light and dark favicons', () => {
    const dark = flowlaryFaviconSvg('dark')
    const light = flowlaryFaviconSvg('light')
    expect(dark).toBe(light)
    expect(dark).toBe(flowlaryFaviconSvgAdaptive())
    expect(dark).toContain(FLOWLARY_MARK.f)
    expect(dark).toContain(FLOWLARY_MARK_COLORS.onGradient)
    expect(dark).toContain(FLOWLARY_LOGO_GRADIENT_STOPS[0].color)
    expect(dark).toContain(FLOWLARY_LOGO_GRADIENT_STOPS[1].color)
    expect(dark).not.toContain(FLOWLARY_MARK_COLORS.onAccent)
  })

  it('uses one gradient id for UI logos', () => {
    expect(FLOWLARY_LOGO_GRADIENT_ID).toBe('fl-logo-grad')
  })

  it('renders gradient PNG source from shared mark', () => {
    const png = flowlaryMarkSvgPng(128)
    expect(png).toContain('fl-mark-grad')
    expect(png).toContain(FLOWLARY_MARK.f)
    expect(png).toContain('#14b8a6')
    expect(png).toContain(FLOWLARY_MARK_COLORS.onGradient)
  })
})
