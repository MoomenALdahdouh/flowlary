/** Derive correction-row visuals from a live host input. No brand palette. */

export type HostSurface = {
  background: string
  backgroundHover: string
  backgroundActive: string
  color: string
  muted: string
  fontFamily: string
  fontSize: string
  fontWeight: string
  lineHeight: string
  letterSpacing: string
  paddingTop: string
  paddingRight: string
  paddingBottom: string
  paddingLeft: string
  borderTopWidth: string
  borderRightWidth: string
  borderBottomWidth: string
  borderLeftWidth: string
  borderStyle: string
  borderColor: string
  borderTopLeftRadius: string
  borderTopRightRadius: string
  borderBottomRightRadius: string
  borderBottomLeftRadius: string
  hasVisibleBorder: boolean
  gapPx: number
}

const HOST_ATTR = 'data-flowlary-correction-host'
const FALLBACK_LIGHT_BG = 'rgb(255, 255, 255)'
const FALLBACK_DARK_BG = 'rgb(24, 24, 27)'
const MIN_PAD_Y = 10
const MIN_PAD_X = 12
const DEFAULT_GAP_PX = 8

export function findVisualChrome(target: HTMLElement): HTMLElement {
  const self = window.getComputedStyle(target)
  if (hasVisualBox(target, self)) return target

  let node: HTMLElement | null = target.parentElement
  let depth = 0
  while (node && depth < 6) {
    if (node === document.body || node === document.documentElement) break
    if (node.hasAttribute(HOST_ATTR)) {
      node = node.parentElement
      depth++
      continue
    }
    const s = window.getComputedStyle(node)
    if (hasVisualBox(node, s)) return node
    node = node.parentElement
    depth++
  }
  return target
}

function hasVisualBox(el: HTMLElement, s: CSSStyleDeclaration): boolean {
  const radii = resolveRadii(el, s)
  const hasRadius =
    parseFloat(radii.tl) > 0 ||
    parseFloat(radii.tr) > 0 ||
    parseFloat(radii.br) > 0 ||
    parseFloat(radii.bl) > 0
  const topW = parseFloat(s.borderTopWidth || '0') || 0
  const hasBorder =
    topW > 0 &&
    s.borderTopStyle !== 'none' &&
    !isTransparent(s.borderTopColor) &&
    !isTransparent(s.borderColor)
  const hasFill = !isTransparent(s.backgroundColor)
  return hasRadius || hasBorder || hasFill
}

export function readHostSurface(target: HTMLElement): HostSurface {
  const chrome = findVisualChrome(target)
  const textStyles = window.getComputedStyle(target)
  const chromeStyles = chrome === target ? textStyles : window.getComputedStyle(chrome)

  const fg = textStyles.color || chromeStyles.color || 'rgb(17, 24, 39)'
  const lightText = isDarkColor(fg)

  const rawBg = !isTransparent(textStyles.backgroundColor)
    ? textStyles.backgroundColor
    : chromeStyles.backgroundColor
  const baseBg = resolveBackground(rawBg, lightText)

  const topW = parseFloat(chromeStyles.borderTopWidth || '0') || 0
  const rightW = parseFloat(chromeStyles.borderRightWidth || '0') || 0
  const bottomW = parseFloat(chromeStyles.borderBottomWidth || '0') || 0
  const leftW = parseFloat(chromeStyles.borderLeftWidth || '0') || 0
  const hasVisibleBorder =
    (topW > 0 || rightW > 0 || bottomW > 0 || leftW > 0) &&
    chromeStyles.borderTopStyle !== 'none' &&
    !isTransparent(chromeStyles.borderTopColor) &&
    !isTransparent(chromeStyles.borderColor)

  const borderColor = !isTransparent(chromeStyles.borderTopColor)
    ? chromeStyles.borderTopColor
    : !isTransparent(chromeStyles.borderColor)
      ? chromeStyles.borderColor
      : lightText
        ? 'rgba(17, 24, 39, 0.14)'
        : 'rgba(255, 255, 255, 0.16)'

  const bg = shade(baseBg, lightText ? -0.05 : 0.06)
  const backgroundHover = shade(bg, lightText ? -0.03 : 0.04)
  const backgroundActive = shade(bg, lightText ? -0.05 : 0.07)

  let radii = resolveRadii(chrome, chromeStyles)
  if (chrome !== target && isInside(chrome, target)) {
    radii = insetRadii(radii, chromeStyles)
  }

  const pad = resolvePadding(textStyles, chromeStyles, chrome !== target)

  return {
    background: bg,
    backgroundHover,
    backgroundActive,
    color: fg,
    muted: fade(fg, 0.55),
    fontFamily: textStyles.fontFamily,
    fontSize: textStyles.fontSize,
    fontWeight: textStyles.fontWeight,
    lineHeight: textStyles.lineHeight,
    letterSpacing: textStyles.letterSpacing,
    paddingTop: pad.top,
    paddingRight: pad.right,
    paddingBottom: pad.bottom,
    paddingLeft: pad.left,
    borderTopWidth: hasVisibleBorder ? chromeStyles.borderTopWidth : '0px',
    borderRightWidth: hasVisibleBorder ? chromeStyles.borderRightWidth : '0px',
    borderBottomWidth: hasVisibleBorder ? chromeStyles.borderBottomWidth : '0px',
    borderLeftWidth: hasVisibleBorder ? chromeStyles.borderLeftWidth : '0px',
    borderStyle: hasVisibleBorder ? chromeStyles.borderTopStyle || 'solid' : 'none',
    borderColor: hasVisibleBorder ? borderColor : 'transparent',
    borderTopLeftRadius: radii.tl,
    borderTopRightRadius: radii.tr,
    borderBottomRightRadius: radii.br,
    borderBottomLeftRadius: radii.bl,
    hasVisibleBorder,
    gapPx: DEFAULT_GAP_PX,
  }
}

function isInside(ancestor: HTMLElement, node: HTMLElement): boolean {
  return ancestor.contains(node) && ancestor !== node
}

function insetRadii(
  radii: { tl: string; tr: string; br: string; bl: string },
  chromeStyles: CSSStyleDeclaration,
): { tl: string; tr: string; br: string; bl: string } {
  const pad = Math.max(
    parseFloat(chromeStyles.paddingLeft || '0') || 0,
    parseFloat(chromeStyles.paddingTop || '0') || 0,
    8,
  )
  const shrink = (v: string) => {
    const n = parseFloat(v) || 0
    if (n <= 0) return '0px'
    return `${Math.max(6, n - pad * 0.35)}px`
  }
  return {
    tl: shrink(radii.tl),
    tr: shrink(radii.tr),
    br: shrink(radii.br),
    bl: shrink(radii.bl),
  }
}

function resolvePadding(
  textStyles: CSSStyleDeclaration,
  chromeStyles: CSSStyleDeclaration,
  nestedInChrome: boolean,
): { top: string; right: string; bottom: string; left: string } {
  const pick = (a: string, b: string, min: number) => {
    const n = Math.max(parseFloat(a) || 0, parseFloat(b) || 0, min)
    return `${n}px`
  }
  return {
    top: pick(textStyles.paddingTop, nestedInChrome ? '0px' : chromeStyles.paddingTop, MIN_PAD_Y),
    right: pick(textStyles.paddingRight, nestedInChrome ? '0px' : chromeStyles.paddingRight, MIN_PAD_X),
    bottom: pick(textStyles.paddingBottom, nestedInChrome ? '0px' : chromeStyles.paddingBottom, MIN_PAD_Y),
    left: pick(textStyles.paddingLeft, nestedInChrome ? '0px' : chromeStyles.paddingLeft, MIN_PAD_X),
  }
}

function resolveRadii(
  target: HTMLElement,
  s: CSSStyleDeclaration,
): { tl: string; tr: string; br: string; bl: string } {
  const computed = {
    tl: s.borderTopLeftRadius || '0px',
    tr: s.borderTopRightRadius || '0px',
    br: s.borderBottomRightRadius || '0px',
    bl: s.borderBottomLeftRadius || '0px',
  }
  if (computed.tl !== '0px' || computed.tr !== '0px' || computed.br !== '0px' || computed.bl !== '0px') {
    return computed
  }

  const inline =
    target.style.borderTopLeftRadius ||
    target.style.borderRadius ||
    target.getAttribute('style')?.match(/border-radius\s*:\s*([^;]+)/i)?.[1]?.trim() ||
    ''
  if (inline) {
    const parts = inline.split(/\s+/).filter(Boolean)
    if (parts.length === 1) {
      const v = parts[0]!
      return { tl: v, tr: v, br: v, bl: v }
    }
    if (parts.length === 2) {
      return { tl: parts[0]!, tr: parts[1]!, br: parts[0]!, bl: parts[1]! }
    }
    if (parts.length === 3) {
      return { tl: parts[0]!, tr: parts[1]!, br: parts[2]!, bl: parts[1]! }
    }
    if (parts.length >= 4) {
      return { tl: parts[0]!, tr: parts[1]!, br: parts[2]!, bl: parts[3]! }
    }
  }
  return computed
}

export function applyHostSurface(el: HTMLElement, surface: HostSurface): void {
  el.style.fontFamily = surface.fontFamily
  el.style.fontSize = surface.fontSize
  el.style.fontWeight = surface.fontWeight
  el.style.lineHeight = surface.lineHeight
  el.style.letterSpacing = surface.letterSpacing
  el.style.color = surface.color
  el.style.background = surface.background
  el.style.paddingTop = surface.paddingTop
  el.style.paddingRight = surface.paddingRight
  el.style.paddingBottom = surface.paddingBottom
  el.style.paddingLeft = surface.paddingLeft
  el.style.borderTopWidth = surface.borderTopWidth
  el.style.borderRightWidth = surface.borderRightWidth
  el.style.borderBottomWidth = surface.borderBottomWidth
  el.style.borderLeftWidth = surface.borderLeftWidth
  el.style.borderStyle = surface.borderStyle
  el.style.borderColor = surface.borderColor
  el.style.borderTopLeftRadius = surface.borderTopLeftRadius
  el.style.borderTopRightRadius = surface.borderTopRightRadius
  el.style.borderBottomRightRadius = surface.borderBottomRightRadius
  el.style.borderBottomLeftRadius = surface.borderBottomLeftRadius
  el.style.setProperty('--flowlary-bg', surface.background)
  el.style.setProperty('--flowlary-bg-hover', surface.backgroundHover)
  el.style.setProperty('--flowlary-bg-active', surface.backgroundActive)
  el.style.setProperty('--flowlary-muted', surface.muted)
  el.style.setProperty('--flowlary-fg', surface.color)
}

function resolveBackground(raw: string, lightText: boolean): string {
  if (!isTransparent(raw)) return toRgb(raw)
  return lightText ? FALLBACK_LIGHT_BG : FALLBACK_DARK_BG
}

export function shade(color: string, amount: number): string {
  const rgb = parseRgb(color)
  if (!rgb) return color
  const target = amount < 0 ? 0 : 255
  const t = Math.abs(amount)
  const r = Math.round(rgb.r * (1 - t) + target * t)
  const g = Math.round(rgb.g * (1 - t) + target * t)
  const b = Math.round(rgb.b * (1 - t) + target * t)
  return `rgb(${r}, ${g}, ${b})`
}

function fade(color: string, alpha: number): string {
  const rgb = parseRgb(color)
  if (!rgb) return color
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
}

function toRgb(color: string): string {
  const rgb = parseRgb(color)
  if (!rgb) return color
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`
}

function parseRgb(color: string): { r: number; g: number; b: number } | null {
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i)
  if (!m) return null
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) }
}

export function isTransparent(color: string): boolean {
  return (
    color === 'transparent' ||
    color === 'rgba(0, 0, 0, 0)' ||
    color === 'rgba(0,0,0,0)'
  )
}

export function isDarkColor(color: string): boolean {
  const rgb = parseRgb(color)
  if (!rgb) return true
  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255
  return luminance < 0.55
}
