/**
 * Brief, non-focus-stealing cue after a safe Write Gate mutation.
 */
import type { DecisionAction } from '../engine/types.ts'
import type { EditableElement } from '../dom/types.ts'

const FLASH_MS = 1400
const STYLE_ID = 'flowlary-correction-flash-style'

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
    .fl-correction-flash {
      position: fixed;
      z-index: 2147483646;
      max-width: 16rem;
      padding: 0.35rem 0.6rem;
      border-radius: 999px;
      border: 1px solid rgba(15, 23, 42, 0.12);
      background: rgba(255, 255, 255, 0.96);
      color: #0f172a;
      font: 600 12px/1.3 system-ui, sans-serif;
      box-shadow: 0 6px 18px rgba(15, 23, 42, 0.12);
      pointer-events: none;
      opacity: 0;
      transform: translateY(4px);
      transition: opacity 120ms ease, transform 120ms ease;
    }
    .fl-correction-flash.is-on {
      opacity: 1;
      transform: translateY(0);
    }
  `
  document.documentElement.append(style)
}

function labelFor(action: DecisionAction): string {
  if (action === 'layout_fix') return 'Fixed typing'
  if (action === 'translation') return 'Translated'
  if (action === 'english_correction') return 'Improved English'
  return 'Updated'
}

export function showCorrectionFlash(element: EditableElement, action: DecisionAction): void {
  if (typeof document === 'undefined') return
  ensureStyle()
  document.querySelectorAll('.fl-correction-flash').forEach((node) => node.remove())
  const host = document.createElement('div')
  host.className = 'fl-correction-flash'
  host.setAttribute('role', 'status')
  host.setAttribute('aria-live', 'polite')
  host.dataset.flowlaryFlash = action
  host.textContent = labelFor(action)
  document.documentElement.append(host)
  const rect = element.getBoundingClientRect()
  host.style.left = `${Math.max(8, rect.left)}px`
  host.style.top = `${Math.max(8, rect.top - 28)}px`
  requestAnimationFrame(() => host.classList.add('is-on'))
  window.setTimeout(() => {
    host.classList.remove('is-on')
    window.setTimeout(() => host.remove(), 180)
  }, FLASH_MS)
}
