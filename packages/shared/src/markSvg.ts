import { FLOWLARY_MARK, FLOWLARY_MARK_COLORS } from './brand.ts'

export type MarkTheme = 'light' | 'dark'

function markColors(theme: MarkTheme): { accent: string; onAccent: string } {
  if (theme === 'light') {
    return {
      accent: FLOWLARY_MARK_COLORS.light.accent,
      onAccent: FLOWLARY_MARK_COLORS.light.onAccent,
    }
  }
  return {
    accent: FLOWLARY_MARK_COLORS.accent,
    onAccent: FLOWLARY_MARK_COLORS.onAccent,
  }
}

/** Solid mark SVG for a resolved theme (favicon, toolbar PNG source). */
export function flowlaryFaviconSvg(theme: MarkTheme): string {
  const { accent, onAccent } = markColors(theme)
  const { radius, f, caret } = FLOWLARY_MARK
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="${radius}" fill="${accent}"/>
  <path d="${f}" fill="${onAccent}"/>
  <rect x="${caret.x}" y="${caret.y}" width="${caret.width}" height="${caret.height}" rx="${caret.rx}" fill="${onAccent}"/>
</svg>`
}

/** Static favicon with prefers-color-scheme fallback (crawlers, no JS). */
export function flowlaryFaviconSvgAdaptive(): string {
  const { radius, f, caret } = FLOWLARY_MARK
  const { accent, onAccent, light } = FLOWLARY_MARK_COLORS
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <style>
    .mark { fill: ${light.accent}; }
    .glyph { fill: ${light.onAccent}; }
    @media (prefers-color-scheme: dark) {
      .mark { fill: ${accent}; }
      .glyph { fill: ${onAccent}; }
    }
  </style>
  <rect class="mark" width="32" height="32" rx="${radius}"/>
  <path class="glyph" d="${f}"/>
  <rect x="${caret.x}" y="${caret.y}" width="${caret.width}" height="${caret.height}" rx="${caret.rx}"/>
</svg>`
}

/** Gradient stops aligned with website Logo and extension popup mark. */
export const FLOWLARY_LOGO_GRADIENT_STOPS = [
  { offset: 0, color: '#19c7e8' },
  { offset: 1, color: '#ec4899' },
] as const

/** Raster-ready mark SVG (gradient tile + on-accent glyph) for extension PNG icons. */
export function flowlaryMarkSvgPng(size: number): string {
  const scale = size / 32
  const r = FLOWLARY_MARK.radius * scale
  const { f, caret } = FLOWLARY_MARK
  const onAccent = FLOWLARY_MARK_COLORS.onAccent
  const stops = FLOWLARY_LOGO_GRADIENT_STOPS.map(
    (stop) => `<stop offset="${stop.offset}" stop-color="${stop.color}"/>`,
  ).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="fl-mark-grad" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
      ${stops}
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${r}" fill="url(#fl-mark-grad)"/>
  <g transform="scale(${scale})">
    <path d="${f}" fill="${onAccent}"/>
    <rect x="${caret.x}" y="${caret.y}" width="${caret.width}" height="${caret.height}" rx="${caret.rx}" fill="${onAccent}"/>
  </g>
</svg>`
}

export function flowlaryFaviconDataUri(theme: MarkTheme): string {
  return `data:image/svg+xml,${encodeURIComponent(flowlaryFaviconSvg(theme))}`
}

/** Shared gradient id for inline UI logos (website header, extension popup). */
export const FLOWLARY_LOGO_GRADIENT_ID = 'fl-logo-grad'
