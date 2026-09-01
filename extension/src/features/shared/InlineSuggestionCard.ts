import { resolveCardActionStrings } from './cardStrings.ts'

export type InlineSuggestionBinding = {
  element: HTMLElement
  start: number
  end: number
  suggestion: string
}

export type InlineSuggestionCardOptions = {
  label: string
  onApply: (binding: InlineSuggestionBinding) => void
  onDismiss: () => void
}

const HOST_ATTR = 'data-flowlary-suggestion-host'
const GAP_PX = 8

export class InlineSuggestionCard {
  private host: HTMLElement
  private shadow: ShadowRoot
  private contentEl: HTMLElement
  private applyEl: HTMLButtonElement
  private dismissEl: HTMLButtonElement
  private target: HTMLElement | null = null
  private binding: InlineSuggestionBinding | null = null
  private onScroll: (() => void) | null = null
  private scrollTargets: EventTarget[] = []

  constructor(private readonly options: InlineSuggestionCardOptions) {
    const cardStrings = resolveCardActionStrings()
    this.host = document.createElement('div')
    this.host.setAttribute(HOST_ATTR, 'true')
    this.host.setAttribute('aria-live', 'polite')
    this.applyHostBaseStyle()
    this.shadow = this.host.attachShadow({ mode: 'open' })
    this.shadow.innerHTML = `
      <style>
        :host { all: initial; display: block; }
        * { box-sizing: border-box; }
        .row {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          width: 100%;
          margin: 0;
          pointer-events: auto;
          background: var(--flowlary-bg, #fafafa);
          color: var(--flowlary-fg, #111827);
          overflow: auto;
        }
        .label {
          font: 600 11px/1.2 system-ui, sans-serif;
          opacity: 0.72;
          flex: 0 0 auto;
        }
        .content {
          flex: 1 1 auto;
          min-width: 0;
          white-space: pre-wrap;
          word-break: break-word;
          font: 13px/1.45 system-ui, sans-serif;
        }
        .actions { display: flex; gap: 6px; flex: 0 0 auto; }
        button {
          font: 600 12px/1 system-ui, sans-serif;
          border: 1px solid color-mix(in srgb, var(--flowlary-fg, #111827) 18%, transparent);
          background: var(--flowlary-bg, #fafafa);
          color: var(--flowlary-fg, #111827);
          border-radius: 6px;
          padding: 6px 10px;
          cursor: pointer;
        }
        button.primary {
          background: var(--flowlary-fg, #111827);
          color: var(--flowlary-bg, #fafafa);
        }
      </style>
      <div class="row" hidden>
        <span class="label"></span>
        <div class="content"></div>
        <div class="actions">
          <button type="button" class="primary" data-action="apply">${cardStrings.apply}</button>
          <button type="button" data-action="dismiss">${cardStrings.dismiss}</button>
        </div>
      </div>
    `
    const row = this.shadow.querySelector('.row') as HTMLElement
    const labelEl = this.shadow.querySelector('.label') as HTMLElement
    labelEl.textContent = options.label
    this.contentEl = this.shadow.querySelector('.content') as HTMLElement
    this.applyEl = this.shadow.querySelector('[data-action="apply"]') as HTMLButtonElement
    this.dismissEl = this.shadow.querySelector('[data-action="dismiss"]') as HTMLButtonElement
    this.applyEl.addEventListener('click', () => {
      if (this.binding) this.options.onApply(this.binding)
    })
    this.dismissEl.addEventListener('click', () => {
      this.hide()
      this.options.onDismiss()
    })
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        if (this.binding) this.options.onApply(this.binding)
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        this.hide()
        this.options.onDismiss()
      }
    })
  }

  attach(target: HTMLElement): void {
    this.detachScroll()
    this.target = target
    this.attachInline()
    this.bindScroll()
  }

  show(binding: InlineSuggestionBinding, dir: 'ltr' | 'rtl' | 'auto' = 'auto'): void {
    this.binding = binding
    this.target = binding.element
    this.contentEl.textContent = binding.suggestion
    this.contentEl.dir = dir
    const row = this.shadow.querySelector('.row') as HTMLElement
    row.hidden = false
    this.attachInline()
    this.host.style.display = 'block'
    this.bindScroll()
  }

  hide(): void {
    this.binding = null
    const row = this.shadow.querySelector('.row') as HTMLElement
    row.hidden = true
    this.host.style.display = 'none'
    this.host.remove()
    this.detachScroll()
  }

  private applyHostBaseStyle(): void {
    this.host.style.display = 'none'
    this.host.style.boxSizing = 'border-box'
    this.host.style.position = 'relative'
    this.host.style.margin = `${GAP_PX}px 0 0 0`
    this.host.style.padding = '0'
    this.host.style.border = '0'
    this.host.style.maxWidth = '100%'
    this.host.style.zIndex = '2147483000'
  }

  private attachInline(): void {
    if (!this.target) return
    if (this.host.isConnected && this.host.previousElementSibling === this.target) return
    this.target.insertAdjacentElement('afterend', this.host)
  }

  private bindScroll(): void {
    if (!this.target || this.onScroll) return
    this.onScroll = () => {
      if (this.binding) this.attachInline()
    }
    this.scrollTargets = [window]
    let node: Element | null = this.target
    while (node) {
      this.scrollTargets.push(node)
      node = node.parentElement
    }
    for (const target of this.scrollTargets) {
      target.addEventListener('scroll', this.onScroll, { passive: true })
    }
  }

  private detachScroll(): void {
    if (!this.onScroll) return
    for (const target of this.scrollTargets) {
      target.removeEventListener('scroll', this.onScroll)
    }
    this.scrollTargets = []
    this.onScroll = null
  }
}

export function isSuggestionHost(node: Node | null): boolean {
  return node instanceof HTMLElement && node.hasAttribute(HOST_ATTR)
}
