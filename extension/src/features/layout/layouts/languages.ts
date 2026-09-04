import { PRODUCT_LAYOUT_IDS, type LayoutId } from './types.ts'

const LANGUAGE_TO_LAYOUT: Record<string, LayoutId> = {
  en: 'en-US-qwerty',
  ar: 'ar-101',
}

export function layoutsFromLanguages(languages: string[]): LayoutId[] {
  const product = new Set<string>(PRODUCT_LAYOUT_IDS)
  const found = new Set<LayoutId>()
  for (const language of languages) {
    const base = language.toLowerCase().split('-')[0] ?? ''
    const layoutId = LANGUAGE_TO_LAYOUT[base]
    if (layoutId && product.has(layoutId)) found.add(layoutId)
  }
  if (!found.has('en-US-qwerty')) found.add('en-US-qwerty')
  return [...found]
}
