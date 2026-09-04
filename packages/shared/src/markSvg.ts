import { FLOWLARY_MARK, FLOWLARY_MARK_COLORS } from './brand.ts'

export type MarkTheme = 'light' | 'dark'

/** Gradient stops aligned with website Logo and extension popup mark. */
export const FLOWLARY_LOGO_GRADIENT_STOPS = [
  { offset: 0, color: '#0ea5e9' },
  { offset: 1, color: '#14b8a6' },
] as const

function gradientStopsXml(): string {
  return FLOWLARY_LOGO_GRADIENT_STOPS.map(
    (stop) => `<stop offset="${stop.offset}" stop-color="${stop.color}"/>`,
  ).join('')
}

function markGlyphXml(fill: string): string {
  const { f, caret } = FLOWLARY_MARK
  return `<path d="${f}" fill="${fill}"/>
  <rect x="${caret.x}" y="${caret.y}" width="${caret.width}" height="${caret.height}" rx="${caret.rx}" fill="${fill}"/>`
}

/** Brand tile: sky→teal gradient + white glyph. Same asset for favicon, OG, and extension. */
export function flowlaryBrandTileSvg(size = 32): string {
  const scale = size / 32
  const r = FLOWLARY_MARK.radius * scale
  const glyph = FLOWLARY_MARK_COLORS.onGradient
  const sizeAttrs = size === 32 ? '' : ` width="${size}" height="${size}"`
  return `<svg xmlns="http://www.w3.org/2000/svg"${sizeAttrs} viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="fl-mark-grad" x1="${4 * scale}" y1="${4 * scale}" x2="${28 * scale}" y2="${28 * scale}" gradientUnits="userSpaceOnUse">
      ${gradientStopsXml()}
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${r}" fill="url(#fl-mark-grad)"/>
  <g transform="scale(${scale})">
    ${markGlyphXml(glyph)}
  </g>
</svg>`
}

/** Favicon for a resolved theme — brand tile is theme-independent. */
export function flowlaryFaviconSvg(_theme?: MarkTheme): string {
  return flowlaryBrandTileSvg()
}

/** Static favicon (crawlers, no JS). Same tile as light/dark so tab and extension match. */
export function flowlaryFaviconSvgAdaptive(): string {
  return flowlaryBrandTileSvg()
}

/** Raster-ready mark SVG (gradient tile + white glyph) for extension PNG icons. */
export function flowlaryMarkSvgPng(size: number): string {
  return flowlaryBrandTileSvg(size)
}

export function flowlaryFaviconDataUri(theme: MarkTheme): string {
  return `data:image/svg+xml,${encodeURIComponent(flowlaryFaviconSvg(theme))}`
}

/** Shared gradient id for inline UI logos (website header, extension popup). */
export const FLOWLARY_LOGO_GRADIENT_ID = 'fl-logo-grad'
