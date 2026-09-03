import { mapLayout, ARABIC_GOLDEN } from '@flowlary/layout-registry'

export type LayoutDemoExample = {
  id: string
  typed: string
  intended: string
  detectedLayout: string
}

const EN_TO_AR = 'en-US-qwerty' as const
const AR_LAYOUT = 'ar-101' as const

function mustMap(typed: string): string {
  return mapLayout(typed, EN_TO_AR, AR_LAYOUT) ?? typed
}

/** Deterministic keyboard-fix examples from the real extension engine. */
export function buildLayoutExamples(): LayoutDemoExample[] {
  const golden = ARABIC_GOLDEN.map(([typed, intended], index) => ({
    id: `golden-${index}`,
    typed,
    intended,
    detectedLayout: 'English keyboard layout',
  }))

  const featured: LayoutDemoExample[] = [
    {
      id: 'house',
      typed: 'hgfdj',
      intended: mustMap('hgfdj'),
      detectedLayout: 'English keyboard layout',
    },
    {
      id: 'iraq',
      typed: 'hguvhr',
      intended: mustMap('hguvhr'),
      detectedLayout: 'English keyboard layout',
    },
  ]

  const seen = new Set<string>()
  return [...featured, ...golden].filter((ex) => {
    if (seen.has(ex.typed)) return false
    seen.add(ex.typed)
    return ex.intended.length > 0
  })
}

export function repairLayoutText(typed: string): string {
  return mustMap(typed)
}

export const PRIMARY_LAYOUT_EXAMPLE: LayoutDemoExample = {
  id: 'house',
  typed: 'hgfdj',
  intended: mustMap('hgfdj'),
  detectedLayout: 'English keyboard layout',
}

/** Homepage problem + keyboard-fix sections — illustrative marketing example. */
export const MARKETING_LAYOUT_EXAMPLE: LayoutDemoExample = {
  id: 'here',
  typed: 'lgh hgkhs',
  intended: 'أنا هنا',
  detectedLayout: 'English keyboard layout',
}
