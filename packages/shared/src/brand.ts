/** Shared Flowlary mark geometry — keep favicon.svg and og.svg in sync. */
export const FLOWLARY_MARK = {
  radius: 8.5,
  f: 'M9.2 7.7h12.35v3.95h-8v2.05h7.15v3.75h-7.15V24.3H9.2V7.7Z',
  caret: { x: 22.2, y: 13.35, width: 2.35, height: 5.5, rx: 0.75 },
} as const

/** Static mark colors — align with shared tokens and og.svg. */
export const FLOWLARY_MARK_COLORS = {
  /** Default / dark accent — brand cyan for toolbar icons and OG mark. */
  accent: '#14d4ea',
  onAccent: '#061018',
  /** Glyph on the cyan→magenta brand tile (favicon, extension, header logo). */
  onGradient: '#ffffff',
  light: {
    accent: '#0891b2',
    onAccent: '#ffffff',
  },
} as const
