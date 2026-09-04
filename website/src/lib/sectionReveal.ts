export const SECTION_REVEAL_CLASS = 'fl-section-reveal'

const SKIP_INNER = ':scope .reveal, :scope .fl-stagger, :scope .animate-fade-up'

export function shouldObserveSection(section: Element): boolean {
  if (!(section instanceof HTMLElement)) return false
  if (section.classList.contains('is-in')) return false
  if (section.closest('.layout-app')) return false
  if (section.querySelector(SKIP_INNER)) return false
  return true
}

export function isSectionAlreadyVisible(section: HTMLElement, viewportHeight: number): boolean {
  const rect = section.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return false
  return rect.bottom > 0 && rect.top < viewportHeight * 0.9
}
